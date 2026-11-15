import assert from "node:assert/strict"
import {after, before, describe, it} from "node:test"
import {ApiError, createClient} from "../../api/api-client.ts"
import {createFakeServer} from "../../test-utils/fake-server.ts"
import {type FakeWayvnc, createFakeWayvnc} from "../../test-utils/fake-wayvnc.ts"
import {keyEventMessage, pointerEventMessage, qemuKeyEventMessage, setEncodingsMessage} from "./rfb-message.ts"

const TITLE = "server/wayvnc/vnc-input.test.ts"

const hex = (buf: Buffer): string => buf.toString("hex")

describe(TITLE, () => {
    it("writes each RFB message as the protocol lays it out", () => {
        assert.equal(hex(setEncodingsMessage()), "02000001fffffefe")
        assert.equal(hex(keyEventMessage(0xff0d, true)), "040100000000ff0d")
        assert.equal(hex(keyEventMessage(0x40, false)), "0400000000000040")
        assert.equal(hex(qemuKeyEventMessage(0x61, true, 0x1e)), "ff000001000000610000001e")
        assert.equal(hex(pointerEventMessage(100, 200, 1)), "0501006400c8")
    })

    it("sends an extended scancode as its low byte with the high bit set", () => {
        assert.equal(hex(qemuKeyEventMessage(0xff51, false, 0xe04b)), "ff0000000000ff51000000cb")
    })

    // The routes against a wayvnc that only shakes hands and records: what reaches it is what a real one would act on.
    describe("over a connection", () => {
        let wayvnc: FakeWayvnc
        let client: ReturnType<typeof createClient>

        const refusal = (status: number, message: RegExp) => (error: unknown): boolean =>
            error instanceof ApiError && error.status === status && message.test(error.message)

        // Each call makes a connection of its own, so what one test sent is what came since the last.
        let seen = 0
        const sent = async (): Promise<string> => {
            const all = await wayvnc.received()
            const part = all.subarray(seen)
            seen = all.length
            return hex(part)
        }

        before(async () => {
            wayvnc = await createFakeWayvnc()
            const server = createFakeServer({vncPort: () => wayvnc.port})
            client = createClient({url: "http://wayuse.test/", token: server.jwt, fetch: server.fetch})
        })

        after(() => wayvnc.close())

        it("clickSlot() moves, presses and releases at the pixel, inside the modifiers", async () => {
            const slot = await client.clickSlot("HEADLESS-1", {x: 100, y: 200, button: "ctrl+button1"})
            assert.equal(slot.id, "HEADLESS-1")
            assert.equal(await sent(), [
                setEncodingsMessage(),
                qemuKeyEventMessage(0xffe3, true, 0x1d),
                pointerEventMessage(100, 200, 0),
                pointerEventMessage(100, 200, 1),
                pointerEventMessage(100, 200, 0),
                qemuKeyEventMessage(0xffe3, false, 0x1d),
            ].map(hex).join(""))
        })

        it("keySlot() presses each combination and releases its modifiers last", async () => {
            await client.keySlot("HEADLESS-2", "ctrl+l .. at")
            assert.equal(await sent(), [
                setEncodingsMessage(),
                qemuKeyEventMessage(0xffe3, true, 0x1d),
                qemuKeyEventMessage(0x6c, true, 0x26),
                qemuKeyEventMessage(0x6c, false, 0x26),
                qemuKeyEventMessage(0xffe3, false, 0x1d),
                keyEventMessage(0x40, true),
                keyEventMessage(0x40, false),
            ].map(hex).join(""))
        })

        it("refuses a wrong request without connecting", async () => {
            await assert.rejects(client.clickSlot("HEADLESS-1", {x: 1280, y: 0}), refusal(400, /^Out of slot: 1280,0 \(1280x960\)$/))
            await assert.rejects(client.clickSlot("HEADLESS-1", {x: 0, y: 0, button: "button9"}), refusal(400, /^Invalid button/))
            await assert.rejects(client.clickSlot("HEADLESS-9", {x: 0, y: 0}), refusal(404, /^Slot not found/))
            await assert.rejects(client.keySlot("HEADLESS-1", "NoSuchKey"), refusal(400, /^Unknown keysym/))
            await assert.rejects(client.keySlot("HEADLESS-1", " "), refusal(400, /^Invalid keys/))
            assert.equal(await sent(), "")
        })
    })

    it("answers 503 while wayvnc cannot be reached", async () => {
        const closed = await createFakeWayvnc()
        await closed.close()
        const server = createFakeServer({vncPort: () => closed.port})
        const client = createClient({url: "http://wayuse.test/", token: server.jwt, fetch: server.fetch})
        await assert.rejects(client.clickSlot("HEADLESS-1", {x: 0, y: 0}), (error: unknown) => error instanceof ApiError && error.status === 503 && /^wayvnc \d+: /.test(error.message))
    })
})
