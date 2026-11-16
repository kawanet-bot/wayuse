import assert from "node:assert/strict"
import {describe, it} from "node:test"
import {runCLI} from "../client/cli.ts"
import {createFakeServer} from "../test-utils/fake-server.ts"
import {type Values, CLICKABLE, ENDPOINTS, cliOf, fieldsOf, keyOf, requestOf} from "./api-endpoints.ts"

const TITLE = "console/api-endpoints.test.ts"

const find = (key: string) => ENDPOINTS.find(endpoint => keyOf(endpoint) === key)!

// Splits a command as a POSIX shell would, for the words cliOf() writes: bare, or in single quotes.
const shellSplit = (command: string): string[] =>
    [...command.matchAll(/(?:'((?:[^']|'\\'')*)'|(\S+))/g)].map(([, quoted, bare]) => (quoted != null ? quoted.replaceAll(`'\\''`, "'") : bare!))

const VALUES: Values = {
    slot: "HEADLESS-2", id: "0123456789ABCDEF0123456789ABCDEF", url: "https://example.com/?a=1&b=2", width: "1024", height: "768", context: "temporary",
    x: "100", y: "200", button: "ctrl+button1", keys: "ctrl+l .. Return", text: "it's a text", expression: "document.title",
}

describe(TITLE, () => {
    it("puts the values into the path, and into the body as numbers where they are", () => {
        assert.deepEqual(requestOf(find("GET slot/:slot/capture.png"), VALUES), {method: "GET", path: "slot/HEADLESS-2/capture.png"})
        assert.deepEqual(requestOf(find("POST slot/:slot/click"), VALUES), {method: "POST", path: "slot/HEADLESS-2/click", body: {x: 100, y: 200, button: "ctrl+button1"}})
        assert.deepEqual(requestOf(find("PUT app/chrome/tab/"), VALUES).body, {url: VALUES.url, slot: "HEADLESS-2", width: 1024, height: 768, context: "temporary"})
    })

    it("leaves an empty value out of the body, for the server to fill in", () => {
        assert.deepEqual(requestOf(find("PUT app/chrome/tab/"), {url: "about:blank", slot: "", width: "", height: "", context: ""}).body, {url: "about:blank"})
    })

    it("writes the wayuse command, with quotes where a shell needs them", () => {
        assert.equal(cliOf(find("GET slot/"), VALUES), "npx wayuse slot list")
        assert.equal(cliOf(find("POST slot/:slot/key"), VALUES), "npx wayuse slot key 'ctrl+l .. Return' --slot HEADLESS-2")
        assert.equal(cliOf(find("PUT clipboard"), VALUES), `npx wayuse clipboard set 'it'\\''s a text'`)
        assert.equal(cliOf(find("POST app/chrome/tab/"), VALUES), "npx wayuse chrome open 'https://example.com/?a=1&b=2' --add --slot HEADLESS-2 --size 1024x768 --context temporary")
        assert.equal(cliOf(find("GET ok"), VALUES), undefined)
    })

    it("drops an option whose value is empty, and keeps an empty argument", () => {
        assert.equal(cliOf(find("PUT app/chrome/tab/"), {url: "about:blank", width: "1024"}), "npx wayuse chrome open about:blank")
        assert.equal(cliOf(find("PUT clipboard"), {text: ""}), "npx wayuse clipboard set ''")
    })

    it("lists each endpoint once, and takes only fields the form has", () => {
        assert.equal(new Set(ENDPOINTS.map(keyOf)).size, ENDPOINTS.length)
        for (const endpoint of ENDPOINTS) {
            for (const field of fieldsOf(endpoint)) assert.ok(field in VALUES, `${keyOf(endpoint)}: ${field}`)
        }
    })

    // Only the paths tie a capture to its click, so a renamed endpoint would leave a click on the picture doing nothing.
    it("sends a click on each clickable capture to an endpoint that takes it", () => {
        for (const [path, {field, click}] of Object.entries(CLICKABLE)) {
            const capture = ENDPOINTS.find(endpoint => endpoint.path === path)
            assert.equal(capture?.method, "GET", path)
            assert.equal(capture?.shows, "image", path)
            assert.ok(fieldsOf(capture!).includes(field), path)

            const target = ENDPOINTS.find(endpoint => keyOf(endpoint) === click)
            assert.ok(target, click)
            assert.ok(fieldsOf(target).includes(field), click)
            assert.ok(fieldsOf(target).includes("x"), click)
            assert.ok(fieldsOf(target).includes("y"), click)
        }
    })

    // The form promises that the command does what the request does, so each command is run and its request compared.
    it("shows for each endpoint a command that sends the very request shown beside it", async () => {
        const server = createFakeServer()
        const sent: {method: string, path: string, body?: unknown}[] = []
        const fetch: typeof server.fetch = async (input, init) => {
            sent.push({method: init?.method ?? "GET", path: input.pathname.slice(1), body: init?.body ? JSON.parse(String(init.body)) : undefined})
            return server.fetch(input, init)
        }

        for (const endpoint of ENDPOINTS) {
            const command = cliOf(endpoint, VALUES)
            if (!command) continue

            // Without "-o <file>" a capture goes to the standard output, and the test writes no file.
            const args = shellSplit(command).slice(2).filter((word, i, words) => word !== "-o" && words[i - 1] !== "-o")
            sent.length = 0
            await runCLI(args, {env: {WAYUSE_JWT: server.jwt}, stdout: {write: () => undefined}, stderr: {write: () => undefined}, fetch})

            const {method, path, body} = requestOf(endpoint, VALUES)
            assert.deepEqual(sent, [{method, path, body}], command)
        }
    })

    it("lists no endpoint the server does not have", async () => {
        const server = createFakeServer()
        for (const endpoint of ENDPOINTS) {
            const {method, path, body} = requestOf(endpoint, VALUES)
            const res = await server.fetch(new URL(path, "http://wayuse.test/"), {method, headers: {authorization: `Bearer ${server.jwt}`, "content-type": "application/json"}, body: body && JSON.stringify(body)})
            assert.notEqual(res.status, 404, keyOf(endpoint))
            assert.notEqual(res.status, 401, keyOf(endpoint))
        }
    })
})
