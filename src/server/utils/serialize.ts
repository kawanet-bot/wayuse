/**
 * Makes a queue: the function it returns runs what it is given one at a time, in the order of the calls.
 */
export const createSerializer = () => {
    let queue: Promise<unknown> = Promise.resolve()

    return <T>(fn: () => Promise<T>): Promise<T> => {
        const p = queue.then(fn)
        // A failure is the caller's to see, and must not stop what waits behind it.
        queue = p.catch(() => undefined)
        return p
    }
}
