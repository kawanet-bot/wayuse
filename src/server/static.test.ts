import assert from "node:assert/strict"
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from "node:fs"
import {tmpdir} from "node:os"
import {dirname, join} from "node:path"
import {after, describe, it} from "node:test"
import {createFakeServer} from "../test-utils/fake-server.ts"

const TITLE = "server/static.test.ts"

describe(TITLE, () => {
    // What @wayuse/build would have put into the image, and a file beside it that is not to be served.
    const base = mkdtempSync(join(tmpdir(), "wayuse-"))
    const htdocsDir = join(base, "htdocs")
    const files: Record<string, string> = {
        "htdocs/console/index.html": "<title>wayuse</title>\n",
        "htdocs/console/monitor/index.html": "<title>monitor</title>\n",
        "htdocs/console/css/console.css": "body {}\n",
        "htdocs/console/js/login.js": "export {}\n",
        "htdocs/console/vendor/novnc.js": "export default class RFB {}\n",
        "outside.txt": "outside\n",
    }
    for (const [path, content] of Object.entries(files)) {
        mkdirSync(dirname(join(base, path)), {recursive: true})
        writeFileSync(join(base, path), content)
    }
    after(() => rmSync(base, {recursive: true, force: true}))

    const server = createFakeServer({htdocsDir})
    const get = (path: string, headers: Record<string, string> = {}) => server.fetch(new URL(path, "http://wayuse.test/"), {headers})

    it("serves the console's pages, styles and scripts without a token", async () => {
        for (const [path, type] of [["/console/", "text/html"], ["/console/monitor/", "text/html"], ["/console/css/console.css", "text/css"], ["/console/js/login.js", "text/javascript"], ["/console/vendor/novnc.js", "text/javascript"]]) {
            const res = await get(path!)
            assert.equal(res.status, 200, path)
            assert.match(res.headers.get("content-type") ?? "", new RegExp(`^${type}`), path)
        }
        assert.equal(await (await get("/console/")).text(), "<title>wayuse</title>\n")
        assert.equal(await (await get("/console/vendor/novnc.js")).text(), "export default class RFB {}\n")
    })

    it("sends /console to /console/, relative to where it is", async () => {
        const res = await get("/console")
        assert.equal(res.status, 302)
        assert.equal(res.headers.get("location"), "console/")
    })

    it("serves nothing above the directory", async () => {
        for (const path of ["/../outside.txt", "/console/../../outside.txt", "/%2e%2e/outside.txt", "/console/js/../../../outside.txt", "/outside.txt"]) {
            assert.equal((await get(path)).status, 401, path)
        }
        assert.equal((await get("/console/nosuch.html", {authorization: `Bearer ${server.jwt}`})).status, 404)
    })

    it("has no console where the image has no such directory", async () => {
        const bare = createFakeServer({htdocsDir: join(base, "nosuch")})
        for (const path of ["/console", "/console/"]) {
            assert.equal((await bare.fetch(new URL(path, "http://wayuse.test/"))).status, 401, path)
        }
    })
})
