import {Hono} from "hono"
import {type Writer, logger} from "./logger.ts"

/**
 * An application that answers every request with why the server is out of service, the health check among them.
 */
export const createUnavailableApp = (message: string, stderr: Writer): Hono => {
    const app = new Hono()

    app.use(logger({stderr}))

    app.all("*", c => c.json({error: {message}}, 503))

    return app
}
