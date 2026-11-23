import {randomUUID} from "node:crypto"
import {CASCADE_COUNT, CASCADE_STEP} from "../../screen/cascade.ts"
import type {ServerDeps} from "../deps.ts"
import {clearSlot, getSlot} from "../slot/slot.ts"
import {getSwayWindows, swayCommand} from "../sway/swaymsg.ts"
import {waitFor} from "../utils/wait-for.ts"
import type {BrowserContexts} from "./browser-context.ts"
import {connectCDP} from "./cdp.ts"
import type {OpenRequest} from "./chrome-request.ts"
import {chromeWindowMark} from "./chrome-tab.ts"

/** "replace" closes what is on the slot and fills it. "add" puts one more window over what is there. */
export type OpenMode = "replace" | "add"

/** Where the next window goes on a slot that already has `count` of them. */
export const cascadeOffset = (count: number): number => count % CASCADE_COUNT * CASCADE_STEP

// Runs in the slot's queue before the window exists, and returns the sway commands that size and place it.
const prepare = async (deps: ServerDeps, {slot, width, height}: OpenRequest, mode: OpenMode): Promise<string> => {
    if (mode === "replace") {
        await clearSlot(deps, slot)

        // Set before opening, so the page is laid out at the size from its first paint.
        await swayCommand(deps.exec, `output ${slot} mode ${width}x${height}`)

        // sway has no maximize, and fullscreen would hide Chrome's tabs and address bar.
        return "resize set width 100 ppt height 100 ppt, move position 0 0"
    }

    const [windows] = await Promise.all([getSwayWindows(deps.exec), getSlot(deps, slot)])
    const offset = cascadeOffset(windows.get(slot)?.length ?? 0)
    return `resize set width ${width} px height ${height} px, move position ${offset} ${offset}`
}

/**
 * Opens a new Chrome window on the slot and navigates it, and returns the id of its tab.
 */
export const openChromeTab = async (deps: ServerDeps, contexts: BrowserContexts, request: OpenRequest, mode: OpenMode): Promise<string> => {
    const {slot, url} = request
    const {exec, locks, log} = deps

    // sway tells this window from any other by a title no other has. A title set later reaches sway too late.
    const title = `wayuse-${randomUUID()}`
    const findWindow = async () => [...(await getSwayWindows(exec))].map(([output, list]) => ({output, w: list.find(w => w.name.startsWith(title))})).find(v => v.w)

    // The slot's queue is held only until the navigation starts, so a slow URL does not hold back what comes next.
    const {cdp, sessionId, targetId, navigated} = await locks.withSlot(slot, async () => {
        const placement = await prepare(deps, request, mode)
        const cdp = await connectCDP(deps.cdpOrigin)
        let browserContextId: string | undefined
        let targetId: string | undefined
        try {
            await contexts.sweep(cdp)
            if (request.context === "temporary") browserContextId = await contexts.create(cdp)

            // A new window appears on the focused output and takes the focus, so the seat is held until it is in place.
            await locks.withSeat(async () => {
                await swayCommand(exec, `focus output ${slot}`)

                const created = await cdp.send("Target.createTarget", {url: `data:text/html,<title>${title}</title>`, newWindow: true, browserContextId})
                targetId = created.targetId
                if (browserContextId) contexts.opened(browserContextId)
                const [{windowId}, found] = await Promise.all([
                    cdp.send("Browser.getWindowForTarget", {targetId}),
                    waitFor(findWindow, `Chrome window not found: ${targetId}`),
                ])

                // Moved even when it is already there: the placement applies on the output it is moved to.
                await swayCommand(exec, `[con_id=${found.w!.id}] mark --add ${chromeWindowMark(windowId)}, move container to output ${slot}, ${placement}`)
                log(`${slot} open ${found.w!.id} ${url} appeared on ${found.output}`)
            })

            const {sessionId} = await cdp.send("Target.attachToTarget", {targetId, flatten: true})
            const navigated = cdp.send("Page.navigate", {url}, sessionId).catch(error => log(`${slot} ${error}`))
            return {cdp, sessionId, targetId: targetId!, navigated}
        } catch (error) {
            // A half-opened window or context must not stay behind.
            if (targetId) await cdp.send("Target.closeTarget", {targetId}).catch(e => log(`${slot} ${e}`))
            if (browserContextId) await contexts.dispose(cdp, browserContextId)
            cdp.close()
            throw error
        }
    })

    try {
        // From here another request may close the window, and then there is nothing left to wait for.
        let closed = false
        cdp.on("Target.detachedFromTarget", params => {
            closed ||= params.sessionId === sessionId
        })
        await navigated

        // The first page must not be reachable by the back button, and the history can be cut only once the URL is in it.
        const committed = async () => closed || ((await cdp.send("Page.getNavigationHistory", {}, sessionId).catch(() => undefined))?.entries.length ?? 0) > 1
        await waitFor(committed, `History not committed: ${url}`).then(() => closed || cdp.send("Page.resetNavigationHistory", {}, sessionId)).catch(error => log(`${slot} ${error}`))
        if (closed) return targetId
        await cdp.send("Target.detachFromTarget", {sessionId}).catch(error => log(`${slot} ${error}`))

        // The answer should not carry the temporary title. A slow page is not waited for.
        await waitFor(async () => !(await findWindow()), `Title not changed: ${url}`).catch(error => log(`${slot} ${error}`))
        return targetId
    } finally {
        cdp.close()
    }
}
