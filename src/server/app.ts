import {Hono} from "hono"
import type {WayuseClient} from "wayuse-client"
import {type AuthEnv, type AuthOptions, jwtCheck} from "./jwt-verify.ts"
import {type Writer, logger} from "./logger.ts"

export interface AppOptions {
    /** The resolved configuration the image was built from. */
    config: WayuseClient.Config
    /** The destination of the access log. */
    stderr: Writer
    /** What a token is verified against. */
    auth: AuthOptions
}

/**
 * The application apart from the socket it listens on, so a test reaches it without one.
 */
export const createApp = ({config, stderr, auth}: AppOptions): Hono<AuthEnv> => {
    const app = new Hono<AuthEnv>()
    const check = jwtCheck(auth)

    app.use(logger({stderr}))

    // Open to all: a load balancer's health check carries no token.
    app.get("/ok", c => c.body(null, 200))

    app.get("/auth/me", check, c => c.json({me: c.get("jwt")}))

    // What `app=` may name and the size a screen starts at: a client cannot learn these from the screens.
    app.get("/config", check, c => c.json(config))

    return app
}
