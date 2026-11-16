import {Hono} from "hono"
import type {ServerDeps} from "../deps.ts"
import {HttpError} from "../http-error.ts"

/**
 * The routes of /app/: those of each application the image has, and an answer for one it has not.
 */
export const createAppsApp = async (deps: ServerDeps): Promise<Hono> => {
    const app = new Hono()

    // Decided when the image is built: one that was not installed is not started either, and trying it would only time out.
    // Imported only then, so an image without an application loads neither its code nor what that depends on.
    if (deps.config.apps.chrome) app.route("/", (await import("../chrome/chrome-api.ts")).createChromeApp(deps))

    // Said in words, so a caller does not take it for a path that was misspelled.
    app.all("/app/:name/*", c => {
        throw new HttpError(404, `Application not installed: ${c.req.param("name")}`)
    })

    return app
}
