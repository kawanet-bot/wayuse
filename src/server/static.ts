import {serveStatic} from "@hono/node-server/serve-static"
import {Hono} from "hono"
import {fileURLToPath} from "node:url"

// Resolved by name, so the sources under test and the built copy serve the same files.
const packageRoot = (): string => fileURLToPath(new URL("../", import.meta.resolve("wayuse-server")))

// noVNC as npm installed it, beside this package: its own files, served as they are.
const novncRoot = (): string => fileURLToPath(new URL("../", import.meta.resolve("@novnc/novnc")))

/**
 * The console's pages and scripts. They carry no secret, and a browser cannot send a token to load a page.
 */
export const createStaticApp = (): Hono => {
    const app = new Hono()
    const root = packageRoot()

    // A relative link in a page resolves against the directory only when its URL ends with the slash.
    app.get("/console", c => c.redirect("console/"))

    // The scripts are built from src/console/, and the pages beside them are written by hand.
    app.use("/console/js/*", serveStatic({root: `${root}dist/console`, rewriteRequestPath: path => path.replace(/^\/console\/js/, "")}))
    app.use("/console/*", serveStatic({root: `${root}htdocs`}))

    // Only the two directories a browser loads, and nothing else of the package.
    app.use("/vendor/novnc/core/*", serveStatic({root: novncRoot(), rewriteRequestPath: path => path.replace(/^\/vendor\/novnc/, "")}))
    app.use("/vendor/novnc/vendor/*", serveStatic({root: novncRoot(), rewriteRequestPath: path => path.replace(/^\/vendor\/novnc/, "")}))

    return app
}
