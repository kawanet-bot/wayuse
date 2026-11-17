import {type Context, Hono} from "hono"
import type {WayuseClient} from "wayuse"
import type {ServerDeps} from "../deps.ts"
import {HttpError} from "../http-error.ts"
import {getSwayOutputs, getSwayWindows} from "../sway/swaymsg.ts"
import {waitFor} from "../utils/wait-for.ts"
import {createBrowserContexts} from "./browser-context.ts"
import {withCDP} from "./cdp.ts"
import {captureChromeHtml, captureChromeTab} from "./chrome-capture.ts"
import {evaluateChromeTab} from "./chrome-evaluate.ts"
import {clickChromeTab} from "./chrome-input.ts"
import {type OpenMode, openChromeTab} from "./chrome-open.ts"
import {checkTabId, resolveClickRequest, resolveOpenRequest} from "./chrome-request.ts"
import {getChromeTabs} from "./chrome-tab.ts"

type Tab = WayuseClient.ChromeTab

// A body that is not JSON is checked as an empty one, which names what is missing.
const bodyOf = (c: Context): Promise<unknown> => c.req.json().catch(() => undefined)

/**
 * The routes of /app/chrome/, mounted only in an image that has Chrome.
 */
export const createChromeApp = (deps: ServerDeps): Hono => {
    const app = new Hono()
    const {cdpOrigin, exec, log} = deps
    const contexts = createBrowserContexts(log)

    const getTabs = async (): Promise<Tab[]> => {
        const windows = await getSwayWindows(exec)
        return withCDP(cdpOrigin, cdp => getChromeTabs(cdp, contexts, windows, log))
    }

    const getTab = async (id: string): Promise<Tab> => {
        const tab = (await getTabs()).find(tab => tab.id === id)
        if (!tab) throw new HttpError(404, `Tab not found: ${id}`)
        return tab
    }

    const open = (mode: OpenMode) => async (c: Context) => {
        const slotIds = (await getSwayOutputs(exec)).map(output => output.name)
        const request = resolveOpenRequest(await bodyOf(c), deps.config, slotIds)
        return c.json(await getTab(await openChromeTab(deps, contexts, request, mode)))
    }

    app.get("/app/chrome/tab/", async c => c.json({data: await getTabs()} satisfies WayuseClient.ChromeTabList))

    app.put("/app/chrome/tab/", open("replace"))

    app.post("/app/chrome/tab/", open("add"))

    app.get("/app/chrome/tab/:id", async c => c.json(await getTab(checkTabId(c.req.param("id")))))

    app.delete("/app/chrome/tab/:id", async c => {
        const id = checkTabId(c.req.param("id"))

        const close = async (): Promise<Tab> => {
            const tab = await getTab(id)
            log(`close ${tab.id} ${tab.target.url}`)
            await withCDP(cdpOrigin, async cdp => {
                await cdp.send("Target.closeTarget", {targetId: tab.id})
                // closeTarget answers before the tab is gone, and the sweep must see the list without it.
                const closed = async () => !(await cdp.send<{targetInfos: {targetId: string}[]}>("Target.getTargets")).targetInfos.some(t => t.targetId === tab.id)
                await waitFor(closed, `Tab not closed: ${tab.id}`).catch(error => log(String(error)))
                await contexts.sweep(cdp)
            })
            return tab
        }

        // Closing the last tab closes its window, so it waits in that window's slot. A window opened by hand has no known slot.
        const slot = (await getTab(id)).sway?.output
        return c.json(await (slot ? deps.locks.withSlot(slot, close) : close()))
    })

    app.get("/app/chrome/tab/:id/capture.jpg", async c => {
        const {jpeg, videoGeometry} = await captureChromeTab(cdpOrigin, checkTabId(c.req.param("id")))
        const headers: Record<string, string> = {"content-type": "image/jpeg", "cache-control": "no-store"}
        if (videoGeometry) headers["page-video-geometry"] = videoGeometry
        return c.body(new Uint8Array(jpeg), 200, headers)
    })

    app.get("/app/chrome/tab/:id/capture.html", async c => {
        const html = await captureChromeHtml(cdpOrigin, checkTabId(c.req.param("id")))
        // Another site's HTML served from this origin: sandboxed, it runs no script and reads no storage when opened in a browser.
        return c.body(html, 200, {"content-type": "text/html; charset=utf-8", "cache-control": "no-store", "content-security-policy": "sandbox"})
    })

    // click and evaluate touch nothing of sway, so they wait in no queue: the order on one tab is the caller's to keep.
    app.post("/app/chrome/tab/:id/click", async c => {
        const id = checkTabId(c.req.param("id"))
        const request = resolveClickRequest(await bodyOf(c))
        await clickChromeTab(cdpOrigin, id, request)
        log(`${id} click ${request.x} ${request.y} ${request.button}`)
        return c.json(await getTab(id))
    })

    app.post("/app/chrome/tab/:id/evaluate", async c => {
        const id = checkTabId(c.req.param("id"))
        const {expression} = ((await bodyOf(c)) ?? {}) as {expression?: unknown}
        if (typeof expression !== "string" || !expression.trim()) throw new HttpError(400, `Invalid expression: ${JSON.stringify(expression)}`)
        const result = await evaluateChromeTab(cdpOrigin, id, expression)
        log(`${id} evaluate ${expression.length} chars ${result.type}`)
        return c.json({result} satisfies WayuseClient.ChromeEvaluateResponse)
    })

    return app
}
