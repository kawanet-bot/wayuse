import {HttpError} from "../http-error.ts"

/**
 * Gives up on a promise with a 504 after msec. What the promise waits for goes on: only the waiting ends.
 */
export const withTimeout = async <T>(promise: Promise<T>, msec: number, message: string): Promise<T> => {
    let timer: NodeJS.Timeout | undefined
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new HttpError(504, message)), msec)
    })
    try {
        return await Promise.race([promise, timeout])
    } finally {
        clearTimeout(timer)
    }
}
