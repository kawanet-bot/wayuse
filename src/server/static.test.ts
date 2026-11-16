import assert from "node:assert/strict"
import {mkdtempSync, rmSync, writeFileSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {after, describe, it} from "node:test"
import {createFakeServer} from "../test-utils/fake-server.ts"

const TITLE = "server/static.test.ts"

describe(TITLE, () => {
    // What wayuse-build would have put into the image.
    const vendorDir = mkdtempSync(join(tmpdir(), "wayuse-"))
    writeFileSync(join(vendorDir, "novnc.js"), "export default class RFB {}\n")
    after(() => rmSync(vendorDir, {recursive: true, force: true}))

    const server = createFakeServer({vendorDir})
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

    it("serves under /console/vendor/ what the image has in its vendor directory", async () => {
        const res = await get("/console/vendor/novnc.js")
        assert.equal(res.status, 200)
        assert.match(res.headers.get("content-type") ?? "", /^text\/javascript/)
        assert.equal(await res.text(), "export default class RFB {}\n")
    })

    it("serves nothing else of a package, and nothing above a directory it serves", async () => {
        for (const path of ["/console/vendor/../package.json", "/console/../package.json", "/console/%2e%2e/package.json", "/console/js/../../package.json", "/console/vendor/%2e%2e/wayuse-server.js", "/wayuse-server.js"]) {
            assert.equal((await get(path)).status, 401, path)
        }
        assert.equal((await get("/console/nosuch.html", {authorization: `Bearer ${server.jwt}`})).status, 404)
    })
})
