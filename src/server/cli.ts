import {serve} from "@hono/node-server"
import {readFileSync} from "node:fs"
import {parseArgs} from "node:util"
import type {WayuseClient} from "wayuse"
import type * as declared from "wayuse-server"
import {DEFAULT_AUDIENCE} from "../jwt/jwt-format.ts"
import {parsePublicKey} from "../jwt/jwt-verify.ts"
import {createApp, defaultVncPort} from "./app.ts"
import {VERSION} from "./version.ts"
import {createVncTickets} from "./wayvnc/vnc-ticket.ts"
import {createWayvncProxy} from "./wayvnc/wayvnc-proxy.ts"

// Assigned to nothing at IANA and no development server's own, so it seldom meets another server on a host.
export const DEFAULT_PORT = 9580

// Where wayuse-build puts the console in the image.
export const DEFAULT_HTDOCS = "/opt/wayuse/htdocs"

const USAGE = `
Usage: wayuse-server [options]
  -p, --port <port>    the port to listen on (default: ${DEFAULT_PORT})
  -c, --config <file>  the resolved configuration (default: /etc/wayuse/wayuse.json)
  --htdocs <dir>       the files a browser loads without a token (default: ${DEFAULT_HTDOCS})
  -v, --version        print this package's version
  -h, --help           print this usage
Environment:
  WAYUSE_JWT_PUBLIC_KEY  the key tokens are verified with: without it, every API that needs a token is refused
  WAYUSE_JWT_AUDIENCE    the aud a token must carry (default: wayuse)
`.trimStart()

const EXIT_USAGE = 2

class UsageError extends Error {
}

const readArgs = (args: string[]) => {
    const {values} = parseArgs({
        args,
        options: {
            port: {type: "string", short: "p", default: String(DEFAULT_PORT)},
            config: {type: "string", short: "c", default: "/etc/wayuse/wayuse.json"},
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
        process.stdout.write(`wayuse-server ${VERSION}\n`)
        return 0
    }

    const config = JSON.parse(readFileSync(options.config, "utf8")) as WayuseClient.Config
    const {WAYUSE_JWT_PUBLIC_KEY, WAYUSE_JWT_AUDIENCE} = process.env
    const publicKey = WAYUSE_JWT_PUBLIC_KEY ? parsePublicKey(WAYUSE_JWT_PUBLIC_KEY) : undefined
    if (!publicKey) process.stderr.write("WAYUSE_JWT_PUBLIC_KEY is not set: every API that needs a token is refused\n")

    const auth = {publicKey, audience: WAYUSE_JWT_AUDIENCE || DEFAULT_AUDIENCE}
    const tickets = createVncTickets()
    const app = await createApp({config, stderr: process.stderr, auth, runtimeDir: process.env.XDG_RUNTIME_DIR ?? "", tickets, htdocsDir: options.htdocs})

    const server = serve({fetch: app.fetch, port: options.port}, ({port}) => {
        process.stderr.write(`wayuse-server ${VERSION} http://localhost:${port}/ok\n`)
    })

    // A WebSocket never reaches the application: the relay answers the upgrade itself, by the ticket in its path.
    server.on("upgrade", createWayvncProxy({tickets, vncPort: defaultVncPort, log: message => process.stderr.write(`${message}\n`)}))

    // The exit code comes only once the server is closed: until then the process is the server.
    return new Promise<number>((resolve, reject) => {
        server.on("close", () => resolve(0))
        server.on("error", reject)
    })
}
