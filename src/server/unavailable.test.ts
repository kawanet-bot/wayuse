import assert from "node:assert/strict"
import {describe, it} from "node:test"
import {createUnavailableApp} from "./unavailable.ts"

const TITLE = "server/unavailable.test.ts"

describe(TITLE, () => {
    const lines: string[] = []
    const app = createUnavailableApp("out of service", {write: text => lines.push(text)})

    it("answers the health check with 503 and the reason", async () => {
        const res = await app.request("/ok")
        assert.equal(res.status, 503)
        assert.deepEqual(await res.json(), {error: {message: "out of service"}})
    })

    it("answers 503 where the console and the APIs would be", async () => {
        assert.equal((await app.request("/")).status, 503)
        assert.equal((await app.request("/console/")).status, 503)
        assert.equal((await app.request("/auth/me")).status, 503)
        assert.equal((await app.request("/slot/")).status, 503)
    })

    it("answers 503 to every method, token or not", async () => {
        assert.equal((await app.request("/app/chrome/tab/", {method: "POST", body: "{}"})).status, 503)
        assert.equal((await app.request("/slot/HEADLESS-1", {method: "DELETE"})).status, 503)
        assert.equal((await app.request("/auth/me", {headers: {authorization: "Bearer a.b.c"}})).status, 503)
    })

    it("logs each request", async () => {
        lines.length = 0
        await app.request("/ok")
        assert.equal(lines.length, 1)
        assert.ok(lines.join("").includes("/ok"))
        assert.ok(lines.join("").includes("503"))
    })
})
