import {serveStatic} from "@hono/node-server/serve-static"
import {Hono} from "hono"
import {existsSync} from "node:fs"

/**
 * The files of the htdocs directory, the console among them. They carry no secret, and a browser cannot send a token to load a page.
 */
export const createStaticApp = (htdocsDir: string): Hono => {
    const app = new Hono()

    // wayuse-build puts the directory into the image. Outside an image there is none, and the server has its API alone.
    if (!existsSync(htdocsDir)) return app

    // A relative link in a page resolves against the directory only when its URL ends with the slash.
    app.get("/console", c => c.redirect("console/"))

    // A file answers before the API does, so the directory has none at a path of the API.
    app.use(serveStatic({root: htdocsDir}))

    return app
}
