import {HttpError} from "../http-error.ts"
import {withTimeout} from "../utils/with-timeout.ts"
import {checkTarget, withCDP} from "./cdp.ts"
import {getTabState} from "./chrome-tab.ts"
import {slimHtml} from "./html-slim.ts"
import {getVideoGeometry} from "./page-video.ts"

// A frozen page answers neither a capture nor anything else, even in a front tab.
const CAPTURE_TIMEOUT = 10000

export interface TabCapture {
    jpeg: Buffer
    /** Where the page's main video is in the image, when it has one. */
    videoGeometry?: string
}

/**
 * The tab's DOM as it is now, as lightened HTML. Read from CDP's DOM, so a page whose script has stopped still answers.
 */
export const captureChromeHtml = (cdpOrigin: string, targetId: string): Promise<string> => withCDP(cdpOrigin, async cdp => {
    await checkTarget(cdp, targetId)

    // A crashed tab has no DOM to give. A tab behind another has, so that one is not refused.
    const {crashed} = await getTabState(cdp, targetId)
    if (crashed) throw new HttpError(409, `Tab is crashed: ${targetId}`)

    const {sessionId} = await cdp.send("Target.attachToTarget", {targetId, flatten: true})

    const read = async (): Promise<string> => {
        const {root} = await cdp.send<{root: {nodeId: number}}>("DOM.getDocument", {depth: 0}, sessionId)
        const {outerHTML} = await cdp.send<{outerHTML: string}>("DOM.getOuterHTML", {nodeId: root.nodeId}, sessionId)
        return outerHTML
    }
    return slimHtml(await withTimeout(read(), CAPTURE_TIMEOUT, `Capture timed out: ${targetId}`))
})

/**
 * A JPEG of what the tab shows, taken by CDP: the page alone, without Chrome's own tabs and address bar.
 */
export const captureChromeTab = (cdpOrigin: string, targetId: string): Promise<TabCapture> => withCDP(cdpOrigin, async cdp => {
    await checkTarget(cdp, targetId)

    // A crashed tab never answers, and a tab behind another has stopped painting and would give an old picture.
    const {crashed, document} = await getTabState(cdp, targetId)
    if (crashed) throw new HttpError(409, `Tab is crashed: ${targetId}`)
    if (document?.visibilityState !== "visible") throw new HttpError(409, `Tab is ${document?.visibilityState}: ${targetId}`)

    const {sessionId} = await cdp.send("Target.attachToTarget", {targetId, flatten: true})

    // The position is read right before the capture, so the two do not drift apart.
    const capture = async (): Promise<TabCapture> => {
        const videoGeometry = await getVideoGeometry(cdp, sessionId)
        const {data} = await cdp.send("Page.captureScreenshot", {format: "jpeg", quality: 85}, sessionId)
        return {jpeg: Buffer.from(data, "base64"), videoGeometry}
    }
    return withTimeout(capture(), CAPTURE_TIMEOUT, `Capture timed out: ${targetId}`)
})
