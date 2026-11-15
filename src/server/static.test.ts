import assert from "node:assert/strict"
import {describe, it} from "node:test"
import {createFakeServer} from "../test-utils/fake-server.ts"

const TITLE = "server/static.test.ts"

describe(TITLE, () => {
    const server = createFakeServer()
    const get = (path: string, headers: Record<string, string> = {}) => server.fetch(new URL(path, "http://wayuse.test/"), {headers})

    it("serves the console's pages, styles and built scripts without a token", async () => {
        for (const [path, type] of [["/console/", "text/html"], ["/console/monitor/", "text/html"], ["/console/api/", "text/html"], ["/console/vnc/", "text/html"], ["/console/css/console.css", "text/css"], ["/console/js/login.js", "text/javascript"], ["/console/js/vnc.js", "text/javascript"]]) {
            const res = await get(path!)
            assert.equal(res.status, 200, path)
            assert.match(res.headers.get("content-type") ?? "", new RegExp(`^${type}`), path)
        }
        assert.match(await (await get("/console/")).text(), /<title>wayuse<\/title>/)
    })

    it("sends /console to /console/, relative to where it is", async () => {
        const res = await get("/console")
        assert.equal(res.status, 302)
        assert.equal(res.headers.get("location"), "console/")
    })

    it("serves noVNC's own files as its package has them", async () => {
        const res = await get("/vendor/novnc/core/rfb.js")
        assert.equal(res.status, 200)
        assert.match(await res.text(), /Licensed under MPL 2\.0/)
        assert.equal((await get("/vendor/novnc/vendor/pako/lib/zlib/inflate.js")).status, 200)
    })

    it("serves nothing else of a package, and nothing above a directory it serves", async () => {
        for (const path of ["/vendor/novnc/package.json", "/console/../package.json", "/console/%2e%2e/package.json", "/console/js/../../package.json", "/vendor/novnc/core/../package.json"]) {
            assert.equal((await get(path)).status, 403, path)
        }
        assert.equal((await get("/console/nosuch.html", {authorization: `Bearer ${server.jwt}`})).status, 404)
    })
})
