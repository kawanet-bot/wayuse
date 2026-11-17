import {readFile} from "node:fs/promises"
import os from "node:os"
import type {WayuseClient} from "wayuse"

type Meminfo = WayuseClient.Meminfo

const MEMINFO_KEYS: (keyof Meminfo)[] = ["MemTotal", "MemFree", "MemAvailable", "SwapCached", "SwapTotal", "SwapFree"]

/** The lines of /proc/meminfo this server returns, in kB as they are. */
export const meminfoOf = (text: string): Meminfo => {
    const all = Object.fromEntries([...text.matchAll(/^(\w+):\s+(\d+)/gm)].map(([, key, value]) => [key, Number(value)]))
    return Object.fromEntries(MEMINFO_KEYS.map(key => [key, all[key]])) as unknown as Meminfo
}

/**
 * The load and the memory of the host: a container without limits sees the whole host's in both os and /proc.
 */
export const getStatus = async (): Promise<WayuseClient.Status> => ({
    os: {
        machine: os.machine(),
        hostname: os.hostname(),
        loadavg: os.loadavg(),
        uptime: os.uptime(),
        availableParallelism: os.availableParallelism(),
    },
    meminfo: meminfoOf(await readFile("/proc/meminfo", "utf8")),
})
