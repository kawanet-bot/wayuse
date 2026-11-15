import {Hono} from "hono"
import type {WayuseClient} from "wayuse-client"
import type {ServerDeps} from "../deps.ts"
import {captureSlot, clearSlot, getSlot, getSlots} from "./slot.ts"

/**
 * The routes of /slot/: what sway, wayvnc and grim do for a screen, whatever application is on it.
 */
export const createSlotApp = (deps: ServerDeps): Hono => {
    const app = new Hono()

    app.get("/slot/", async c => c.json({data: await getSlots(deps)} satisfies WayuseClient.SlotList))

    app.get("/slot/:id", async c => c.json(await getSlot(deps, c.req.param("id"))))

    app.get("/slot/:id/capture.png", async c => {
        const png = await captureSlot(deps, c.req.param("id"))
        // The screen changes between two captures, so none may be served from a cache.
        return c.body(new Uint8Array(png), 200, {"content-type": "image/png", "cache-control": "no-store"})
    })

    app.delete("/slot/:id", async c => {
        const id = c.req.param("id")
        await deps.locks.withSlot(id, () => clearSlot(deps, id))
        return c.json(await getSlot(deps, id))
    })

    return app
}
