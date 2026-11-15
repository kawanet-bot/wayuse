import {Hono} from "hono"
import type {ContentfulStatusCode} from "hono/utils/http-status"
import type {WayuseClient} from "wayuse-client"
import {createChromeApp} from "./chrome/chrome-api.ts"
import {createClipboardApp} from "./clipboard/clipboard-api.ts"
import type {ServerDeps} from "./deps.ts"
import {type Exec, exec as realExec} from "./exec.ts"
import {HttpError} from "./http-error.ts"
import {type AuthEnv, type AuthOptions, jwtCheck} from "./jwt-verify.ts"
import {type Writer, logger} from "./logger.ts"
import {createSlotApp} from "./slot/slot-api.ts"
import {createStaticApp} from "./static.ts"
import {getStatus} from "./status/status.ts"
import {createSwayLocks} from "./sway/sway-lock.ts"
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
    /** Where the image has what is served under /vendor/. Default: where wayuse-build puts it. */
    vendorDir?: string
}

const VENDOR_DIR = "/opt/wayuse/vendor"

/** Where the wayvnc of HEADLESS-n listens, as wayvnc-start.sh starts it. */
export const defaultVncPort = (n: number): number => 5900 + n

/**
 * The application apart from the socket it listens on, so a test reaches it without one.
 */
export const createApp = ({config, stderr, auth, runtimeDir, exec = realExec, cdpOrigin = CDP_ORIGIN, vncPort = defaultVncPort, tickets = createVncTickets(), vendorDir = VENDOR_DIR}: AppOptions): Hono<AuthEnv> => {
    const app = new Hono<AuthEnv>()

    const deps: ServerDeps = {config, exec, runtimeDir, cdpOrigin, vncPort, tickets, locks: createSwayLocks(), log: message => stderr.write(`${message}\n`)}

    app.use(logger({stderr}))

    // Open to all: a load balancer's health check carries no token.
    app.get("/ok", c => c.body(null, 200))

    // The console's pages come before the check: a browser sends no token when it loads a page.
    app.route("/", createStaticApp(vendorDir))

    // Every route below needs a token, one that does not exist included.
    app.use(jwtCheck(auth))

    app.get("/auth/me", c => c.json({me: c.get("jwt")}))

    // Which applications are installed and the size a screen starts at: a client cannot learn these from the screens.
    app.get("/wayuse/config", c => c.json(config))

    // Read anew each time, and a figure from a cache would pass for the present one.
    app.get("/status/", async c => c.json(await getStatus(), 200, {"cache-control": "no-store"}))

    app.route("/", createSlotApp(deps))
    app.route("/", createClipboardApp(deps))

    // Decided when the image is built: one that was not installed is not started either, and trying it would only time out.
    if (config.apps.chrome) app.route("/", createChromeApp(deps))

    // Said in words, so a caller does not take it for a path that was misspelled.
    app.all("/app/:name/*", c => {
        throw new HttpError(404, `Application not installed: ${c.req.param("name")}`)
    })

    app.notFound(c => c.json({error: {message: "Not Found"}}, 404))

    app.onError((error, c) => {
        if (error instanceof HttpError) return c.json({error: {message: error.message}}, error.status as ContentfulStatusCode)
        stderr.write(`${error.stack ?? error}\n`)
        return c.json({error: {message: String(error)}}, 500)
    })

    return app
}
