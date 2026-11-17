// A wayuse-server for the tests: the real application over recorded answers of sway, with no container.

import {readFileSync} from "node:fs"
import type {WayuseClient} from "wayuse"
import {resolveConfig} from "../build/config.ts"
import {generateKeyPair, signJwt} from "../jwt/jwt-sign.ts"
import {parsePublicKey} from "../jwt/jwt-verify.ts"
import {createApp} from "../server/app.ts"
import type {Exec} from "../server/exec.ts"
import type {VncTickets} from "../server/wayvnc/vnc-ticket.ts"

const fixture = (name: string): Buffer => readFileSync(new URL(`./fixtures/${name}`, import.meta.url))

/** The first bytes of every PNG, which is all a test needs of a capture. */
export const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

// Recorded from a container with two screens and one Chrome window, which sits on HEADLESS-2.
export const fakeExec: Exec = async (file, args) => {
    const command = [file, ...args].join(" ")
    if (command === "swaymsg -r -t get_tree") return fixture("sway-get_tree.json")
    if (command === "swaymsg -r -t get_outputs") return fixture("sway-get_outputs.json")
    if (/^wayvncctl --socket=\/run\/test\/wayvncctl-[12] --json client-list$/.test(command)) return Buffer.from("[]\n")
    if (/^grim -o HEADLESS-[12] -$/.test(command)) return PNG_SIGNATURE
    // A seat with a pointer and a keyboard, as while a VNC client is connected.
    if (command === "swaymsg -r -t get_seats") return Buffer.from(`[{"capabilities": 3}]`)
    if (/^swaymsg -r focus output HEADLESS-[12]$/.test(command)) return Buffer.from(`[{"success": true}]`)
    if (file === "grim") throw new Error(`unknown output '${args[1]}'`)
    throw new Error(`unexpected command: ${command}`)
}

export interface FakeServer {
    config: WayuseClient.Config
    /** A token the server accepts. */
    jwt: string
    /** The access log so far, one item per line. */
    lines: string[]
    /** A fetch that reaches the application directly, for createClient() and runCLI(). */
    fetch: NonNullable<WayuseClient.ClientOptions["fetch"]>
}

export interface FakeServerOptions {
    exec?: Exec
    config?: WayuseClient.Config
    /** The port of a fake wayvnc, for the routes that send input. */
    vncPort?: (n: number) => number
    /** The tickets a test shares with the relay it stands up beside. */
    tickets?: VncTickets
    /** A directory to serve as the image's htdocs. */
    htdocsDir?: string
}

export const createFakeServer = ({exec = fakeExec, config = resolveConfig({apps: {chrome: {}}}), vncPort, tickets, htdocsDir}: FakeServerOptions = {}): FakeServer => {
    const pair = generateKeyPair()
    const lines: string[] = []

    // Not awaited here, so a test may make its server where it declares its values: each request waits for it.
    const app = createApp({
        config,
        stderr: {write: text => lines.push(text)},
        auth: {publicKey: parsePublicKey(pair.publicKey), audience: "wayuse"},
        runtimeDir: "/run/test",
        exec,
        // Nothing listens there, so a route that reaches for Chrome answers that Chrome is not running.
        cdpOrigin: "http://127.0.0.1:9",
        vncPort,
        tickets,
        htdocsDir,
    })

    return {
        config,
        jwt: signJwt({aud: "wayuse", sub: "user@example.com", iat: 1}, pair.privateKey),
        lines,
        fetch: async (input, init) => (await app).request(input, init),
    }
}
