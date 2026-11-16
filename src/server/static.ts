import {serveStatic} from "@hono/node-server/serve-static"
import {Hono} from "hono"
import {existsSync} from "node:fs"
import {fileURLToPath} from "node:url"

// Resolved by name, so the sources under test and the built copy serve the same files.
const packageRoot = (): string => fileURLToPath(new URL("../", import.meta.resolve("wayuse-server")))

/**
 * The console's pages and scripts. They carry no secret, and a browser cannot send a token to load a page.
 */
export const createStaticApp = (vendorDir: string): Hono => {
    const app = new Hono()
    const root = packageRoot()

    // A relative link in a page resolves against the directory only when its URL ends with the slash.
    app.get("/console", c => c.redirect("console/"))

    // The scripts are built from src/console/, and the pages beside them are written by hand.
    app.use("/console/js/*", serveStatic({root: `${root}dist/console`, rewriteRequestPath: path => path.replace(/^\/console\/js/, "")}))
    app.use("/console/*", serveStatic({root: `${root}htdocs`}))

    // What wayuse-build puts into the image from other packages for the pages: noVNC and html-ele. Outside an image there is none.
    if (existsSync(vendorDir)) app.use("/console/vendor/*", serveStatic({root: vendorDir, rewriteRequestPath: path => path.replace(/^\/console\/vendor/, "")}))

    return app
}
