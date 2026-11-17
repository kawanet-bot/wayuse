import type {WayuseClient} from "wayuse"
import {withTimeout} from "../utils/with-timeout.ts"
import type {BrowserContexts} from "./browser-context.ts"
import type {CDP} from "./cdp.ts"

type Tab = WayuseClient.ChromeTab
type TabState = Pick<Tab, "crashed" | "document">

// A frozen page never answers Runtime.evaluate.
const EVALUATE_TIMEOUT = 2000

/**
 * The sway mark of a window this server opened. On Wayland CDP cannot tell where a window is, so the mark carries CDP's windowId.
 */
export const chromeWindowMark = (windowId: number): string => `chrome-window-${windowId}`

/**
 * Whether the tab's renderer has crashed, and otherwise the state of its document.
 */
export const getTabState = async (cdp: CDP, targetId: string): Promise<TabState> => {
    const {sessionId} = await cdp.send("Target.attachToTarget", {targetId, flatten: true})
    try {
        // A crashed tab sends Inspector.targetCrashed ahead of the answer to Inspector.enable, so the answer settles it.
        let crashed = false
        const off = cdp.on("Inspector.targetCrashed", (_, from) => {
            if (from === sessionId) crashed = true
        })
        await cdp.send("Inspector.enable", {}, sessionId).finally(off)
        if (crashed) return {crashed: true}

        const expression = "({visibilityState: document.visibilityState})"
        const evaluate = cdp.send("Runtime.evaluate", {expression, returnByValue: true}, sessionId)
        const {result} = await withTimeout(evaluate, EVALUATE_TIMEOUT, `Runtime.evaluate timed out: ${targetId}`)
        return {document: result.value}
    } finally {
        await cdp.send("Target.detachFromTarget", {sessionId})
    }
}

export const getChromeTabs = async (cdp: CDP, contexts: BrowserContexts, windows: Map<string, WayuseClient.SwayWindow[]>, log: (message: string) => void): Promise<Tab[]> => {
    const {targetInfos} = await cdp.send<{targetInfos: {targetId: string, type: string, url: string, title: string, browserContextId: string}[]}>("Target.getTargets")
    const kindOf = await contexts.kindOf(cdp)

    const marked = new Map<string, Tab["sway"]>()
    windows.forEach((list, output) => list.forEach(w => w.marks.forEach(mark => marked.set(mark, {id: w.id, output}))))

    const pages = targetInfos.filter(t => t.type === "page")
    return Promise.all(pages.map(async ({targetId, type, url, title, browserContextId}): Promise<Tab> => {
        const {windowId, bounds} = await cdp.send("Browser.getWindowForTarget", {targetId})
        const {width, height, windowState} = bounds
        // A frozen tab is listed with neither crashed nor document, rather than failing the whole list.
        const state: TabState = await getTabState(cdp, targetId).catch(error => {
            log(`${targetId} ${error}`)
            return {}
        })
        return {
            id: targetId,
            target: {type, url, title, context: kindOf(browserContextId)},
            window: {windowId, bounds: {width, height, windowState}},
            crashed: state.crashed,
            document: state.document,
            sway: marked.get(chromeWindowMark(windowId)),
        }
    }))
}
