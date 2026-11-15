import assert from "node:assert/strict"
import {describe, it} from "node:test"
import {createClient} from "../../api/api-client.ts"
import {createFakeServer, fakeExec} from "../../test-utils/fake-server.ts"
import {type Exec} from "../exec.ts"
import {meminfoOf} from "./status.ts"

const TITLE = "server/status/status.test.ts"

const MEMINFO = `MemTotal:        8910848 kB
MemFree:          358912 kB
MemAvailable:    3018752 kB
Buffers:          123456 kB
SwapCached:        40960 kB
SwapTotal:       4194300 kB
SwapFree:        3145728 kB
HugePages_Total:       0
`

describe(TITLE, () => {
    it("picks its six lines out of /proc/meminfo, in kB as they are", () => {
        assert.deepEqual(meminfoOf(MEMINFO), {MemTotal: 8910848, MemFree: 358912, MemAvailable: 3018752, SwapCached: 40960, SwapTotal: 4194300, SwapFree: 3145728})
    })

    // /proc is Linux's, and so is the container this server runs in.
    it("getStatus() returns the host's load and memory", {skip: process.platform !== "linux"}, async () => {
        const server = createFakeServer()
        const status = await createClient({url: "http://wayuse.test/", token: server.jwt, fetch: server.fetch}).getStatus()
        assert.equal(status.os.loadavg.length, 3)
        assert.equal(typeof status.os.hostname, "string")
        assert.ok(status.meminfo.MemTotal > 0)
        assert.deepEqual(Object.keys(status.meminfo), ["MemTotal", "MemFree", "MemAvailable", "SwapCached", "SwapTotal", "SwapFree"])
    })

    it("getClipboard() and setClipboard() read and write the text through wl-paste and wl-copy", async () => {
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
        const client = createClient({url: "http://wayuse.test/", token: server.jwt, fetch: server.fetch})

        assert.equal(await client.getClipboard(), "")
        assert.equal(await client.setClipboard("https://example.org/ 日本語\n"), "https://example.org/ 日本語\n")
        assert.equal(await client.getClipboard(), "https://example.org/ 日本語\n")
        assert.equal(await client.setClipboard(""), "")
        assert.deepEqual([...new Set(calls)], ["wl-paste --no-newline --type text", "wl-copy --type text/plain;charset=utf-8"])
    })
})
