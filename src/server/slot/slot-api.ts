import {Hono} from "hono"
import type {WayuseClient} from "wayuse-client"
import type {ServerDeps} from "../deps.ts"
import {HttpError} from "../http-error.ts"
import {VNC_TICKET_TTL} from "../wayvnc/vnc-ticket.ts"
import {clickSlot, keySlot} from "./slot-input.ts"
import {captureSlot, clearSlot, getSlot, getSlots, slotNumberOf} from "./slot.ts"

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

    app.post("/slot/:id/click", async c => {
        const id = c.req.param("id")
        const {x, y, button = "button1"} = ((await c.req.json().catch(() => undefined)) ?? {}) as Record<string, unknown>
        if (!Number.isInteger(x) || (x as number) < 0) throw new HttpError(400, `Invalid x: ${JSON.stringify(x)}`)
        if (!Number.isInteger(y) || (y as number) < 0) throw new HttpError(400, `Invalid y: ${JSON.stringify(y)}`)
        if (typeof button !== "string") throw new HttpError(400, `Invalid button: ${JSON.stringify(button)}`)

        await deps.locks.withSlot(id, () => clickSlot(deps, id, x as number, y as number, button))
        return c.json(await getSlot(deps, id))
    })

    app.post("/slot/:id/key", async c => {
        const id = c.req.param("id")
        const {keys} = ((await c.req.json().catch(() => undefined)) ?? {}) as {keys?: unknown}
        if (typeof keys !== "string" || !keys.trim()) throw new HttpError(400, `Invalid keys: ${JSON.stringify(keys)}`)

        await deps.locks.withSlot(id, () => keySlot(deps, id, keys))
        return c.json(await getSlot(deps, id))
    })

    // The path is relative, so a prefix a reverse proxy puts ahead of the routes applies to it as to any other.
    app.post("/slot/:id/vnc-ticket", async c => {
        const {id} = await getSlot(deps, c.req.param("id"))
        const ticket = deps.tickets.issue(slotNumberOf(id))
        return c.json({path: `wayvnc/${ticket}`, expires_in: VNC_TICKET_TTL} satisfies WayuseClient.VncTicket)
    })

    return app
}
