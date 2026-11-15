import {Hono} from "hono"
import type {ServerDeps} from "../deps.ts"
import {getStatus} from "./status.ts"

/**
 * The routes of /wayuse/: what the server tells of itself, apart from the screens and the applications.
 */
export const createWayuseApp = ({config}: Pick<ServerDeps, "config">): Hono => {
    const app = new Hono()

    // Which applications are installed and the size a screen starts at: a client cannot learn these from the screens.
    app.get("/wayuse/config", c => c.json(config))

    // Read anew each time, and a figure from a cache would pass for the present one.
    app.get("/wayuse/status", async c => c.json(await getStatus(), 200, {"cache-control": "no-store"}))

    return app
}
