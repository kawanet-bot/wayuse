import {Hono} from "hono"
import type {ContentfulStatusCode} from "hono/utils/http-status"
import type {WayuseClient} from "wayuse-client"
import {type AuthEnv, jwtCheck} from "../jwt/jwt-check-hono.ts"
import type {AuthOptions} from "../jwt/jwt-verify.ts"
import {createAppsApp} from "./apps/apps-api.ts"
import {createClipboardApp} from "./clipboard/clipboard-api.ts"
import type {ServerDeps} from "./deps.ts"
import {type Exec, exec as realExec} from "./exec.ts"
import {HttpError} from "./http-error.ts"
import {type Writer, logger} from "./logger.ts"
import {createSlotApp} from "./slot/slot-api.ts"
import {createStaticApp} from "./static.ts"
import {createSwayLocks} from "./sway/sway-lock.ts"
import {createWayuseApp} from "./wayuse/wayuse-api.ts"
import {type VncTickets, createVncTickets} from "./wayvnc/vnc-ticket.ts"

// The port chrome-start.sh gives Chrome, reachable inside the container alone.
const CDP_ORIGIN = "http://127.0.0.1:9222"

export interface AppOptions {
    /** The resolved configuration the image was built from. */
    config: WayuseClient.Config
    /** The destination of the access log. */
    stderr: Writer
    /** What a token is verified against. */
    auth: AuthOptions
    /** XDG_RUNTIME_DIR of the sway session. */
    runtimeDir: string
    /** Runs sway's and wayvnc's commands. Default: the real ones. */
    exec?: Exec
    /** Default: Chrome in the same container. */
    cdpOrigin?: string
    /** Default: 5900 + n, where wayvnc-start.sh puts the wayvnc of HEADLESS-n. */
    vncPort?: (n: number) => number
    /** The tickets the WebSocket relay takes. Default: ones no relay shares. */
    tickets?: VncTickets
    /** Where the image has what a browser loads without a token. Default: where wayuse-build puts it. */
    htdocsDir?: string
}

const HTDOCS_DIR = "/opt/wayuse/htdocs"

/** Where the wayvnc of HEADLESS-n listens, as wayvnc-start.sh starts it. */
export const defaultVncPort = (n: number): number => 5900 + n

/**
 * The application apart from the socket it listens on, so a test reaches it without one.
 */
export const createApp = async ({config, stderr, auth, runtimeDir, exec = realExec, cdpOrigin = CDP_ORIGIN, vncPort = defaultVncPort, tickets = createVncTickets(), htdocsDir = HTDOCS_DIR}: AppOptions): Promise<Hono<AuthEnv>> => {
    const app = new Hono<AuthEnv>()

    const deps: ServerDeps = {config, exec, runtimeDir, cdpOrigin, vncPort, tickets, locks: createSwayLocks(), log: message => stderr.write(`${message}\n`)}

    app.use(logger({stderr}))

    // Open to all: a load balancer's health check carries no token.
    app.get("/ok", c => c.body(null, 200))

    // The console's pages come before the check: a browser sends no token when it loads a page.
    app.route("/", createStaticApp(htdocsDir))

    // Every route below needs a token, one that does not exist included.
    app.use(jwtCheck(auth, c => c.json({error: {message: "invalid token"}}, 401)))

    app.get("/auth/me", c => c.json({me: c.get("jwt")}))

    app.route("/", createWayuseApp(deps))
    app.route("/", createSlotApp(deps))
    app.route("/", createClipboardApp(deps))
    app.route("/", await createAppsApp(deps))

    app.notFound(c => c.json({error: {message: "Not Found"}}, 404))

    app.onError((error, c) => {
        if (error instanceof HttpError) return c.json({error: {message: error.message}}, error.status as ContentfulStatusCode)
        stderr.write(`${error.stack ?? error}\n`)
        return c.json({error: {message: String(error)}}, 500)
    })

    return app
}
