import assert from "node:assert/strict"
import {describe, it} from "node:test"
import {ApiError, createClient} from "../../api/api-client.ts"
import {createFakeServer, fakeExec} from "../../test-utils/fake-server.ts"
import type {Exec} from "../exec.ts"

const TITLE = "server/clipboard/clipboard-api.test.ts"

describe(TITLE, () => {
    // A clipboard in a variable, behind the two commands the server runs.
    const createClipboard = () => {
        let clipboard: string | undefined
        const calls: string[] = []
        const exec: Exec = async (file, args, input) => {
            if (file === "wl-copy") {
                calls.push(`${file} ${args.join(" ")}`)
                clipboard = input
                return Buffer.alloc(0)
            }
            if (file === "wl-paste") {
                calls.push(`${file} ${args.join(" ")}`)
                if (clipboard === undefined) throw new Error("Nothing is copied")
                return Buffer.from(clipboard)
            }
            return fakeExec(file, args)
        }
        const server = createFakeServer({exec})
        return {calls, client: createClient({url: "http://wayuse.test/", token: server.jwt, fetch: server.fetch})}
    }

    it("reads and writes the text through wl-paste and wl-copy", async () => {
        const {calls, client} = createClipboard()
        assert.equal(await client.setClipboard("https://example.org/ 日本語\n"), "https://example.org/ 日本語\n")
        assert.equal(await client.getClipboard(), "https://example.org/ 日本語\n")
        assert.equal(await client.setClipboard(""), "")
        assert.deepEqual([...new Set(calls)], ["wl-copy --type text/plain;charset=utf-8", "wl-paste --no-newline --type text"])
    })

    it("reads an empty clipboard as an empty text", async () => {
        assert.equal(await createClipboard().client.getClipboard(), "")
    })

    it("refuses a text that is not a string", async () => {
        const server = createFakeServer()
        const res = await server.fetch(new URL("http://wayuse.test/clipboard"), {method: "PUT", headers: {authorization: `Bearer ${server.jwt}`, "content-type": "application/json"}, body: `{"text": 1}`})
        assert.equal(res.status, 400)
        assert.deepEqual(await res.json(), {error: {message: "Invalid text: 1"}})
        assert.ok(!(res instanceof ApiError))
    })
})
