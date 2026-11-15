import {HttpError} from "../http-error.ts"

const SLEEP = (msec: number) => new Promise(resolve => setTimeout(resolve, msec))

// Short, because a caller often holds the seat or a slot's queue while it waits.
const INTERVAL = 12

/**
 * Polls fn until it returns a truthy value, and gives up with a 504 after the timeout.
 */
export const waitFor = async <T>(fn: () => Promise<T>, message: string, timeout = 5000): Promise<NonNullable<T>> => {
    const until = Date.now() + timeout
    while (true) {
        const value = await fn()
        if (value) return value
        if (Date.now() > until) throw new HttpError(504, message)
        await SLEEP(INTERVAL)
    }
}
