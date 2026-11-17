import type {WayuseClient} from "wayuse"
import {HttpError} from "../http-error.ts"
import {withTimeout} from "../utils/with-timeout.ts"
import {checkTarget, withCDP} from "./cdp.ts"

type Result = WayuseClient.ChromeEvaluateResult

// A frozen page or a promise that never settles is not waited for longer. What runs in the page goes on.
const EVALUATE_TIMEOUT = 10000

export interface ExceptionDetails {
    /** "Uncaught", "Uncaught (in promise)" and so on. */
    text: string
    exception?: {description?: string, value?: unknown}
}

/**
 * One line for an exception of the page's script. Anything can be thrown, a string as well as an Error.
 */
export const exceptionMessageOf = ({text, exception}: ExceptionDetails): string => {
    const detail = exception?.description ?? JSON.stringify(exception?.value) ?? ""
    // For a rejected promise the text already ends in the exception's first line, which must not be said twice.
    const first = detail.split("\n")[0]
    const head = first && text.endsWith(first) ? text.slice(0, -first.length).trim() : text
    return `${head} ${detail}`.trim()
}

/**
 * Evaluates an expression in the tab's page as a user gesture, so that play() and window.open() are let through.
 */
export const evaluateChromeTab = (cdpOrigin: string, targetId: string, expression: string): Promise<Result> => withCDP(cdpOrigin, async cdp => {
    await checkTarget(cdp, targetId)

    const {sessionId} = await cdp.send("Target.attachToTarget", {targetId, flatten: true})
    // By value: the connection ends with this call, and a reference to an object would not outlive it.
    const params = {expression, awaitPromise: true, returnByValue: true, userGesture: true}
    const evaluate = cdp.send<{result: Result, exceptionDetails?: ExceptionDetails}>("Runtime.evaluate", params, sessionId)
    const {result, exceptionDetails} = await withTimeout(evaluate, EVALUATE_TIMEOUT, `Evaluate timed out: ${targetId}`)

    // To CDP an exception is a success, and to the caller it is a wrong request.
    if (exceptionDetails) throw new HttpError(400, exceptionMessageOf(exceptionDetails))
    return result
})
