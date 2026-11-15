import {Hono} from "hono"
import type {ContentfulStatusCode} from "hono/utils/http-status"
import type {WayuseClient} from "wayuse-client"
import {type Exec, exec as realExec} from "./exec.ts"
import {HttpError} from "./http-error.ts"
import {type AuthEnv, type AuthOptions, jwtCheck} from "./jwt-verify.ts"
import {type Writer, logger} from "./logger.ts"
import {createSlotApp} from "./slot/slot-api.ts"

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
}

/**
 * The application apart from the socket it listens on, so a test reaches it without one.
 */
export const createApp = ({config, stderr, auth, runtimeDir, exec = realExec}: AppOptions): Hono<AuthEnv> => {
    const app = new Hono<AuthEnv>()

    app.use(logger({stderr}))

    // Open to all: a load balancer's health check carries no token.
    app.get("/ok", c => c.body(null, 200))

    // Every route below needs a token, one that does not exist included.
    app.use(jwtCheck(auth))

    app.get("/auth/me", c => c.json({me: c.get("jwt")}))

    // What `app=` may name and the size a screen starts at: a client cannot learn these from the screens.
    app.get("/config", c => c.json(config))

    app.route("/", createSlotApp({exec, runtimeDir}))

    app.onError((error, c) => {
        if (error instanceof HttpError) return c.json({error: {message: error.message}}, error.status as ContentfulStatusCode)
        stderr.write(`${error.stack ?? error}\n`)
        return c.json({error: {message: String(error)}}, 500)
    })

    return app
}
