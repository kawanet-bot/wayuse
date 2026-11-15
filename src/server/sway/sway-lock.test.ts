import assert from "node:assert/strict"
import {describe, it} from "node:test"
import {createSwayLocks} from "./sway-lock.ts"

const TITLE = "server/sway/sway-lock.test.ts"

// A promise that ends when the test says so.
const gate = () => {
    let open = (): void => undefined
    const promise = new Promise<void>(resolve => open = resolve)
    return {promise, open}
}

// Long enough for a queued fn to start, if nothing held it back.
const TICK = () => new Promise(resolve => setImmediate(resolve))

describe(TITLE, () => {
    it("runs one at a time on the same slot", async () => {
        const {withSlot} = createSwayLocks()
        const g = gate()
        const log: string[] = []
        const first = withSlot("HEADLESS-1", async () => {
            await g.promise
            log.push("first")
        })
        const second = withSlot("HEADLESS-1", async () => {
            log.push("second")
        })

        await TICK()
        assert.deepEqual(log, [])
        g.open()
        await Promise.all([first, second])
        assert.deepEqual(log, ["first", "second"])
    })

    it("does not make another slot wait", async () => {
        const {withSlot} = createSwayLocks()
        const g = gate()
        const blocked = withSlot("HEADLESS-1", () => g.promise)

        assert.equal(await withSlot("HEADLESS-2", async () => "other"), "other")
        g.open()
        await blocked
    })

    it("runs one at a time on the seat, from different slots too", async () => {
        const {withSlot, withSeat} = createSwayLocks()
        const g = gate()
        const log: string[] = []
        const first = withSlot("HEADLESS-1", () => withSeat(async () => {
            await g.promise
            log.push("first")
        }))
        const second = withSlot("HEADLESS-2", () => withSeat(async () => {
            log.push("second")
        }))

        await TICK()
        assert.deepEqual(log, [])
        g.open()
        await Promise.all([first, second])
        assert.deepEqual(log, ["first", "second"])
    })

    it("gives each server queues of its own", async () => {
        const g = gate()
        const blocked = createSwayLocks().withSlot("HEADLESS-1", () => g.promise)

        assert.equal(await createSwayLocks().withSlot("HEADLESS-1", async () => "other"), "other")
        g.open()
        await blocked
    })
})
