import assert from "node:assert/strict"
import {describe, it} from "node:test"
import {HttpError} from "../http-error.ts"
import {waitFor} from "./wait-for.ts"
import {withTimeout} from "./with-timeout.ts"

const TITLE = "server/utils/wait-for.test.ts"

const is504 = (message: string) => (error: unknown): boolean => error instanceof HttpError && error.status === 504 && error.message === message

describe(TITLE, () => {
    it("waitFor() polls until fn returns a truthy value, and resolves to it", async () => {
        let calls = 0
        assert.equal(await waitFor(async () => (++calls >= 3 ? "ready" : undefined), "never"), "ready")
        assert.equal(calls, 3)
    })

    it("waitFor() gives up with a 504 after the timeout", async () => {
        await assert.rejects(waitFor(async () => false, "Windows not closed", 30), is504("Windows not closed"))
    })

    it("withTimeout() resolves to the promise's value when it comes in time", async () => {
        assert.equal(await withTimeout(Promise.resolve("done"), 1000, "late"), "done")
    })

    it("withTimeout() gives up with a 504, and passes on a rejection that comes first", async () => {
        await assert.rejects(withTimeout(new Promise(() => undefined), 20, "Capture timed out"), is504("Capture timed out"))
        await assert.rejects(withTimeout(Promise.reject(new Error("boom")), 1000, "late"), /boom/)
    })
})
