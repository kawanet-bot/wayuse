import assert from "node:assert/strict"
import {describe, it} from "node:test"
import {createSerializer} from "./serialize.ts"

const TITLE = "server/utils/serialize.test.ts"

const SLEEP = (msec: number) => new Promise(resolve => setTimeout(resolve, msec))

describe(TITLE, () => {
    it("resolves to what fn returns", async () => {
        const serialize = createSerializer()
        assert.equal(await serialize(async () => "value"), "value")
    })

    it("runs one at a time in the order of the calls, a slow one first not overtaken", async () => {
        const serialize = createSerializer()
        const log: string[] = []
        const task = (name: string, msec: number) => serialize(async () => {
            log.push(`${name} start`)
            await SLEEP(msec)
            log.push(`${name} end`)
        })

        await Promise.all([task("a", 30), task("b", 10), task("c", 0)])
        assert.deepEqual(log, ["a start", "a end", "b start", "b end", "c start", "c end"])
    })

    it("runs the next after one that rejects, or that throws before its first await", async () => {
        const serialize = createSerializer()
        const rejected = serialize(async () => {
            throw new Error("rejected")
        })
        const thrown = serialize(() => {
            throw new Error("thrown")
        })
        const next = serialize(async () => "next")

        await assert.rejects(rejected, /rejected/)
        await assert.rejects(thrown, /thrown/)
        assert.equal(await next, "next")
    })

    it("keeps two queues apart", async () => {
        const first = createSerializer()
        const second = createSerializer()
        let release = (): void => undefined
        const blocked = first(() => new Promise<void>(resolve => release = resolve))

        assert.equal(await second(async () => "second"), "second")
        release()
        await blocked
    })
})
