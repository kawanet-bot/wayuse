import {execFile, spawn} from "node:child_process"

/** Runs a command and resolves to its standard output, or with an input, to nothing once it is taken. The one seam a test replaces to run without sway. */
export type Exec = (file: string, args: string[], input?: string) => Promise<Buffer>

// A capture of the largest screen as PNG stays well under this.
const MAX_BUFFER = 64 * 1024 * 1024

// wl-copy stays behind to answer pastes. Only its input is connected, so that child holds none of the server's outputs.
const feed = (file: string, args: string[], input: string) => new Promise<Buffer>((resolve, reject) => {
    const child = spawn(file, args, {stdio: ["pipe", "ignore", "ignore"]})
    child.on("error", reject)
    child.on("exit", code => (code ? reject(new Error(`${file} exited with ${code}`)) : resolve(Buffer.alloc(0))))
    child.stdin.end(input)
})

export const exec: Exec = (file, args, input) => (input != null ? feed(file, args, input) : new Promise((resolve, reject) => {
    execFile(file, args, {encoding: "buffer", maxBuffer: MAX_BUFFER}, (err, stdout, stderr) => {
        if (!err) return resolve(stdout)
        // The command's own words say more than Node's "Command failed".
        reject(new Error(String(stderr).trim() || String(stdout).trim() || String(err)))
    })
}))
