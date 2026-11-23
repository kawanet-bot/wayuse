import {serve} from "@hono/node-server"
import type * as declared from "@wayuse/server"
import {readFileSync} from "node:fs"
import {parseArgs} from "node:util"
import type {WayuseClient} from "wayuse"
import {DEFAULT_AUDIENCE} from "../jwt/jwt-format.ts"
import {parsePublicKey} from "../jwt/jwt-verify.ts"
import {createApp, defaultVncPort} from "./app.ts"
import {createUnavailableApp} from "./unavailable.ts"
import {VERSION} from "./version.ts"
import {createVncTickets} from "./wayvnc/vnc-ticket.ts"
import {createWayvncProxy} from "./wayvnc/wayvnc-proxy.ts"

// Assigned to nothing at IANA and no development server's own, so it seldom meets another server on a host.
export const DEFAULT_PORT = 9580

// Where @wayuse/build puts the console in the image.
export const DEFAULT_HTDOCS = "/opt/wayuse/htdocs"

// Where @wayuse/build puts the resolved configuration in the image, outside what the server serves without a token.
export const DEFAULT_CONFIG = "/opt/wayuse/wayuse.config.json"

const USAGE = `
Usage: wayuse-server [options]
  -p, --port <port>    the port to listen on (default: ${DEFAULT_PORT})
  -c, --config <file>  the resolved configuration (default: ${DEFAULT_CONFIG})
  --htdocs <dir>       the files a browser loads without a token (default: ${DEFAULT_HTDOCS})
  -v, --version        print this package's version
  -h, --help           print this usage
Environment:
  WAYUSE_JWT_PUBLIC_KEY  the key tokens are verified with: without it every request gets 503, unless the image checks no token
  WAYUSE_JWT_AUDIENCE    the aud a token must carry (default: wayuse)
`.trimStart()

const EXIT_USAGE = 2

/**
 * Why a server is out of service: it was given a key and its image checks no token, or the other way round.
 */
export const keyProblemOf = (auth: boolean | undefined, key: string | undefined): string | undefined => {
    if (auth === false && key) return "config.auth is false, and WAYUSE_JWT_PUBLIC_KEY is set: the image checks no token. Build it again, or leave the key out."
    if (auth !== false && !key) return "WAYUSE_JWT_PUBLIC_KEY is not set: the image checks tokens. Give it the key, or build it with auth: false."
}

// The exit code comes only once the server is closed: until then the process is the server.
const closed = (server: ReturnType<typeof serve>): Promise<number> => new Promise((resolve, reject) => {
    server.on("close", () => resolve(0))
    server.on("error", reject)
})

class UsageError extends Error {
}

const readArgs = (args: string[]) => {
    const {values} = parseArgs({
        args,
        options: {
            port: {type: "string", short: "p", default: String(DEFAULT_PORT)},
            config: {type: "string", short: "c", default: DEFAULT_CONFIG},
            htdocs: {type: "string", default: DEFAULT_HTDOCS},
            version: {type: "boolean", short: "v"},
            help: {type: "boolean", short: "h"},
        },
    })

    // Number() would also read 0x50 or an empty string, neither of which is a port.
    if (!/^\d+$/.test(values.port) || Number(values.port) > 65535) throw new UsageError(`--port takes 0 to 65535: ${values.port}`)

    return {...values, port: Number(values.port)}
}

export const CLI: typeof declared.CLI = async ({args}) => {
    let options: ReturnType<typeof readArgs>

    try {
        options = readArgs(args)
    } catch (error) {
        process.stderr.write(`${(error as Error).message}\n${USAGE}`)
        return EXIT_USAGE
    }

    if (options.help) {
        process.stdout.write(USAGE)
        return 0
    }

    if (options.version) {
        process.stdout.write(`@wayuse/server ${VERSION}\n`)
        return 0
    }

    const config = JSON.parse(readFileSync(options.config, "utf8")) as WayuseClient.Config
    const {WAYUSE_JWT_PUBLIC_KEY, WAYUSE_JWT_AUDIENCE} = process.env

    const listen = (fetch: Parameters<typeof serve>[0]["fetch"]) => serve({fetch, port: options.port}, ({port}) => {
        process.stderr.write(`@wayuse/server ${VERSION} http://localhost:${port}/ok\n`)
    })

    // Whoever gives a key takes the tokens to be checked. Nothing of the application is built: whoever asks gets the reason.
    const problem = keyProblemOf(config.auth, WAYUSE_JWT_PUBLIC_KEY)
    if (problem) {
        process.stderr.write(`${problem}\n`)
        return closed(listen(createUnavailableApp(problem, process.stderr).fetch))
    }

    const publicKey = WAYUSE_JWT_PUBLIC_KEY ? parsePublicKey(WAYUSE_JWT_PUBLIC_KEY) : undefined
    if (!publicKey) process.stderr.write("config.auth is false: every API is open, with no token\n")

    const auth = {publicKey, audience: WAYUSE_JWT_AUDIENCE || DEFAULT_AUDIENCE}
    const tickets = createVncTickets()
    const app = await createApp({config, stderr: process.stderr, auth, runtimeDir: process.env.XDG_RUNTIME_DIR ?? "", tickets, htdocsDir: options.htdocs})

    const server = listen(app.fetch)

    // A WebSocket never reaches the application: the relay answers the upgrade itself, by the ticket in its path.
    server.on("upgrade", createWayvncProxy({tickets, vncPort: defaultVncPort, log: message => process.stderr.write(`${message}\n`)}))

    return closed(server)
}
