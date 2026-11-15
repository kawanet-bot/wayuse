import {Hono} from "hono"
import type {WayuseClient} from "wayuse-client"
import {type Writer, logger} from "./logger.ts"

export interface AppOptions {
    /** The resolved configuration the image was built from. */
    config: WayuseClient.Config
    /** The destination of the access log. */
    stderr: Writer
}

/**
 * The application apart from the socket it listens on, so a test reaches it without one.
 */
export const createApp = ({config, stderr}: AppOptions): Hono => {
    const app = new Hono()

    app.use(logger({stderr}))

    app.get("/ok", c => c.body(null, 200))

    // What `app=` may name and the size a screen starts at: a client cannot learn these from the screens.
    app.get("/config", c => c.json(config))

    return app
}
