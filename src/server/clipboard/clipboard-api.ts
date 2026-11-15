import {Hono} from "hono"
import type {WayuseClient} from "wayuse-client"
import type {ServerDeps} from "../deps.ts"
import {HttpError} from "../http-error.ts"

// What wl-paste says when there is nothing to read as text: an empty clipboard, or one that holds only an image.
const NOTHING = /Nothing is copied|No selection|No suitable type/i

const readClipboard = async ({exec}: ServerDeps): Promise<string> => {
    try {
        return (await exec("wl-paste", ["--no-newline", "--type", "text"])).toString()
    } catch (error) {
        if (NOTHING.test((error as Error).message)) return ""
        throw error
    }
}

/**
 * The routes of /clipboard. sway's seat has one clipboard, which belongs to no slot.
 */
export const createClipboardApp = (deps: ServerDeps): Hono => {
    const app = new Hono()

    const answer = async (): Promise<WayuseClient.Clipboard> => ({text: await readClipboard(deps)})

    app.get("/clipboard", async c => c.json(await answer(), 200, {"cache-control": "no-store"}))

    // Pasting it is a key press of its own: ctrl+v by POST /slot/:id/key.
    app.put("/clipboard", async c => {
        const {text} = ((await c.req.json().catch(() => undefined)) ?? {}) as {text?: unknown}
        if (typeof text !== "string") throw new HttpError(400, `Invalid text: ${JSON.stringify(text)}`)
        await deps.exec("wl-copy", ["--type", "text/plain;charset=utf-8"], text)
        return c.json(await answer())
    })

    return app
}
