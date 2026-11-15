import {HttpError} from "../http-error.ts"
import {withTimeout} from "../utils/with-timeout.ts"
import {checkTarget, withCDP} from "./cdp.ts"
import type {ClickRequest} from "./chrome-request.ts"

// The pause between move, press and release: the default of xdotool's --delay.
const CLICK_DELAY = 12

// A frozen page never answers Input.dispatchMouseEvent.
const INPUT_TIMEOUT = 10000

const SLEEP = (msec: number) => new Promise(resolve => setTimeout(resolve, msec))

/**
 * Clicks the tab's page at a pixel of its capture.jpg. It reaches the page alone, and moves neither sway's focus nor its pointer.
 */
export const clickChromeTab = (cdpOrigin: string, targetId: string, {x, y, button, buttons, modifiers}: ClickRequest): Promise<void> => withCDP(cdpOrigin, async cdp => {
    await checkTarget(cdp, targetId)

    const {sessionId} = await cdp.send("Target.attachToTarget", {targetId, flatten: true})
    try {
        const click = async () => {
            const expression = "({visibilityState: document.visibilityState, dpr: devicePixelRatio, width: innerWidth, height: innerHeight})"
            const {result} = await cdp.send("Runtime.evaluate", {expression, returnByValue: true}, sessionId)
            const {visibilityState, dpr, width, height} = result.value
            if (visibilityState !== "visible") throw new HttpError(409, `Tab is ${visibilityState}: ${targetId}`)

            const maxX = Math.round(width * dpr)
            const maxY = Math.round(height * dpr)
            if (x >= maxX || y >= maxY) throw new HttpError(400, `Out of tab: ${x},${y} (${maxX}x${maxY})`)

            // The capture is in device pixels and CDP takes CSS pixels. devicePixelRatio includes the page's zoom.
            const point = {x: x / dpr, y: y / dpr, modifiers}
            await cdp.send("Input.dispatchMouseEvent", {type: "mouseMoved", ...point}, sessionId)
            await SLEEP(CLICK_DELAY)
            await cdp.send("Input.dispatchMouseEvent", {type: "mousePressed", ...point, button, buttons, clickCount: 1}, sessionId)
            await SLEEP(CLICK_DELAY)
            await cdp.send("Input.dispatchMouseEvent", {type: "mouseReleased", ...point, button, buttons: 0, clickCount: 1}, sessionId)
        }
        await withTimeout(click(), INPUT_TIMEOUT, `Click timed out: ${targetId}`)
    } finally {
        await cdp.send("Target.detachFromTarget", {sessionId})
    }
})
