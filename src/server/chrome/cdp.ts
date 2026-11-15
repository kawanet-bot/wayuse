import {HttpError} from "../http-error.ts"

/** One connection to Chrome's DevTools Protocol. A caller closes it when done. */
export interface CDP {
    send<T = any>(method: string, params?: object, sessionId?: string): Promise<T>
    /** Listens to an event on this connection. Calling what it returns stops listening. */
    on(method: string, listener: (params: any, sessionId?: string) => void): () => void
    close(): void
}

interface Waiting {
    resolve: (value: any) => void
    reject: (error: Error) => void
    method: string
}

export const connectCDP = async (origin: string): Promise<CDP> => {
    // Chrome is started again by the supervisor, so the client may try again.
    const version = await fetch(`${origin}/json/version`).then(res => res.json() as Promise<{webSocketDebuggerUrl: string}>).catch(error => {
        throw new HttpError(503, `Chrome is not running: ${error?.cause?.code || error}`)
    })

    const ws = new WebSocket(version.webSocketDebuggerUrl)
    await new Promise((resolve, reject) => {
        ws.addEventListener("open", resolve, {once: true})
        ws.addEventListener("error", () => reject(new HttpError(503, "Chrome refused the DevTools connection")), {once: true})
    })

    let seq = 0
    const waiting = new Map<number, Waiting>()
    const listeners = new Map<string, Set<(params: any, sessionId?: string) => void>>()

    ws.addEventListener("message", event => {
        const {id, result, error, method, params, sessionId} = JSON.parse(String(event.data))
        if (method) return listeners.get(method)?.forEach(listener => listener(params, sessionId))
        const w = waiting.get(id)
        if (!w) return
        waiting.delete(id)
        if (error) return w.reject(new Error(`${w.method}: ${error.message}`))
        w.resolve(result)
    })

    // A call still waiting when the connection goes would otherwise never settle.
    ws.addEventListener("close", () => waiting.forEach(w => w.reject(new Error(`${w.method}: CDP closed`))))

    return {
        send: (method, params = {}, sessionId) => new Promise((resolve, reject) => {
            const id = ++seq
            waiting.set(id, {resolve, reject, method})
            ws.send(JSON.stringify({id, method, params, sessionId}))
        }),
        on: (method, listener) => {
            const set = listeners.get(method) ?? new Set()
            listeners.set(method, set)
            set.add(listener)
            return () => set.delete(listener)
        },
        close: () => ws.close(),
    }
}

/**
 * Connects for the length of fn. Each API call has a connection of its own, so none outlives its request.
 */
export const withCDP = async <T>(origin: string, fn: (cdp: CDP) => Promise<T>): Promise<T> => {
    const cdp = await connectCDP(origin)
    try {
        return await fn(cdp)
    } finally {
        cdp.close()
    }
}

/** Refuses an id that is not a page's, before anything is sent to that target. */
export const checkTarget = async (cdp: CDP, targetId: string): Promise<void> => {
    const {targetInfos} = await cdp.send<{targetInfos: {targetId: string, type: string}[]}>("Target.getTargets")
    if (!targetInfos.some(t => t.targetId === targetId && t.type === "page")) throw new HttpError(404, `Tab not found: ${targetId}`)
}
