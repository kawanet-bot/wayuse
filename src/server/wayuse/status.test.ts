import assert from "node:assert/strict"
import {describe, it} from "node:test"
import {createClient} from "../../api/api-client.ts"
import {createFakeServer} from "../../test-utils/fake-server.ts"
import {meminfoOf} from "./status.ts"

const TITLE = "server/wayuse/status.test.ts"

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
})
