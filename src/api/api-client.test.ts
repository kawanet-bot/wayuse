import assert from "node:assert/strict"
import {describe, it} from "node:test"
import {PNG_SIGNATURE, createFakeServer, fakeExec} from "../test-utils/fake-server.ts"
import {ApiError, createClient} from "./api-client.ts"

const TITLE = "api/api-client.test.ts"

// The client's functions against the real routes: each test covers both ends of one API.
describe(TITLE, () => {
    const server = createFakeServer()
    const client = createClient({url: "http://wayuse.test/", token: server.jwt, fetch: server.fetch})

    const refusal = (status: number, message: RegExp) => (error: unknown): boolean =>
        error instanceof ApiError && error.status === status && message.test(error.message)

    it("getMe() returns the claims of its own token", async () => {
        assert.deepEqual(await client.getMe(), {aud: "wayuse", sub: "user@example.com", iat: 1})
    })

    it("getConfig() returns the resolved configuration", async () => {
        assert.deepEqual(await client.getConfig(), server.config)
    })

    it("getSlots() returns every screen by number, with its windows", async () => {
        const slots = await client.getSlots()
        assert.deepEqual(slots.map(slot => slot.id), ["HEADLESS-1", "HEADLESS-2"])
        assert.deepEqual(slots.map(slot => slot.sway.windows.length), [0, 1])
        assert.deepEqual(slots.map(slot => slot.wayvnc.clients), [0, 0])
        assert.deepEqual(slots[0]!.sway.output.rect, {x: 0, y: 0, width: 1280, height: 960})
    })

    it("getSlot() returns one screen", async () => {
        const slot = await client.getSlot("HEADLESS-2")
        assert.equal(slot.id, "HEADLESS-2")
        assert.equal(slot.sway.windows[0]!.app_id, "google-chrome")
    })

    it("getSlot() rejects a screen that does not exist, and a name that is not a screen's", async () => {
        await assert.rejects(client.getSlot("HEADLESS-9"), refusal(404, /Slot not found: HEADLESS-9/))
        await assert.rejects(client.getSlot("DP-1"), refusal(400, /Invalid slot: DP-1/))
    })

    it("captureSlot() returns the PNG as bytes", async () => {
        assert.deepEqual(Buffer.from(await client.captureSlot("HEADLESS-1")), PNG_SIGNATURE)
        await assert.rejects(client.captureSlot("HEADLESS-9"), refusal(404, /unknown output/))
    })

    it("rejects with the server's own message when the token is refused", async () => {
        const anonymous = createClient({url: "http://wayuse.test/", fetch: server.fetch})
        await assert.rejects(anonymous.getSlots(), refusal(403, /^invalid token$/))
        await assert.rejects(anonymous.captureSlot("HEADLESS-1"), refusal(403, /^invalid token$/))
    })

    it("takes the token from a function, asked again for each request", async () => {
        let asked = 0
        const lazy = createClient({url: "http://wayuse.test/", token: async () => (++asked, server.jwt), fetch: server.fetch})
        await lazy.getMe()
        await lazy.getMe()
        assert.equal(asked, 2)
    })

    // A reverse proxy may serve the routes under a prefix, as /screen/self/ does for one deployment.
    it("keeps a path ahead of the routes, with or without its last slash", async () => {
        for (const url of ["http://wayuse.test/screen/self/", "http://wayuse.test/screen/self"]) {
            const paths: string[] = []
            const prefixed = createClient({
                url, token: server.jwt, fetch: (input, init) => {
                    paths.push(input.pathname)
                    return server.fetch(new URL(input.pathname.replace("/screen/self", ""), input), init)
                },
            })
            await prefixed.getSlot("HEADLESS-1")
            assert.deepEqual(paths, ["/screen/self/slot/HEADLESS-1"])
        }
    })

    it("answers 503 while sway cannot be reached", async () => {
        const broken = createFakeServer(async () => {
            throw new Error("Unable to connect")
        })
        const of = createClient({url: "http://wayuse.test/", token: broken.jwt, fetch: broken.fetch})
        await assert.rejects(of.getSlots(), refusal(503, /sway: Unable to connect/))
    })

    it("answers an error it did not expect with a 500, and logs the stack", async () => {
        const broken = createFakeServer(async (file, args) => {
            if (file === "wayvncctl") throw new Error("boom")
            return fakeExec(file, args)
        })
        const of = createClient({url: "http://wayuse.test/", token: broken.jwt, fetch: broken.fetch})
        await assert.rejects(of.getSlots(), refusal(500, /boom/))
        assert.match(broken.lines.join(""), /^Error: boom\n {4}at /m)
    })
})
