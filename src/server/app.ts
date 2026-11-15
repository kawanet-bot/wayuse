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
import {getStatus} from "./status/status.ts"
import {createSwayLocks} from "./sway/sway-lock.ts"

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
}

/**
 * The application apart from the socket it listens on, so a test reaches it without one.
 */
export const createApp = ({config, stderr, auth, runtimeDir, exec = realExec, cdpOrigin = CDP_ORIGIN, vncPort = n => 5900 + n}: AppOptions): Hono<AuthEnv> => {
    const app = new Hono<AuthEnv>()

    const deps: ServerDeps = {config, exec, runtimeDir, cdpOrigin, vncPort, locks: createSwayLocks(), log: message => stderr.write(`${message}\n`)}

    app.use(logger({stderr}))

    // Open to all: a load balancer's health check carries no token.
    app.get("/ok", c => c.body(null, 200))

    // Every route below needs a token, one that does not exist included.
    app.use(jwtCheck(auth))

    app.get("/auth/me", c => c.json({me: c.get("jwt")}))

    // Which applications are installed and the size a screen starts at: a client cannot learn these from the screens.
    app.get("/config", c => c.json(config))

    // Read anew each time, and a figure from a cache would pass for the present one.
    app.get("/status/", async c => c.json(await getStatus(), 200, {"cache-control": "no-store"}))

    app.route("/", createSlotApp(deps))
    app.route("/", createClipboardApp(deps))

    // An application that is not installed has no routes, so every path under it is a 404.
    if (config.apps.chrome) app.route("/", createChromeApp(deps))

    app.onError((error, c) => {
        if (error instanceof HttpError) return c.json({error: {message: error.message}}, error.status as ContentfulStatusCode)
        stderr.write(`${error.stack ?? error}\n`)
        return c.json({error: {message: String(error)}}, 500)
    })

    return app
}
