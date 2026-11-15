import {execFile} from "node:child_process"

/** Runs a command and resolves to its standard output. The one seam a test replaces to run without sway. */
export type Exec = (file: string, args: string[]) => Promise<Buffer>

// A capture of the largest screen as PNG stays well under this.
const MAX_BUFFER = 64 * 1024 * 1024

export const exec: Exec = (file, args) => new Promise((resolve, reject) => {
    execFile(file, args, {encoding: "buffer", maxBuffer: MAX_BUFFER}, (err, stdout, stderr) => {
        if (!err) return resolve(stdout)
        // The command's own words say more than Node's "Command failed".
        reject(new Error(String(stderr).trim() || String(stdout).trim() || String(err)))
    })
})
