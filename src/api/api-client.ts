// The client of wayuse-server that the CLI and the console share: web standards alone, no node: import.

import type * as declared from "wayuse-client"
import type {WayuseClient} from "wayuse-client"

export class ApiError extends Error implements declared.ApiError {
    status: number

    constructor(status: number, message: string) {
        super(message)
        this.status = status
    }
}

// The server words its refusals as {error: {message}}; a proxy in between may answer with anything.
const messageOf = async (res: Response): Promise<string> => {
    const text = await res.text()
    try {
        const message = (JSON.parse(text) as {error?: {message?: unknown}}).error?.message
        if (typeof message === "string") return message
    } catch {
        // not JSON
    }
    return text || res.statusText
}

export const createClient: typeof declared.createClient = ({url, token, fetch: fetchFn = fetch}) => {
    // Paths below are relative, so a prefix a reverse proxy adds ahead of the routes stays in the URL.
    const base = url.endsWith("/") ? url : `${url}/`

    const raw = async (path: string, init: RequestInit = {}): Promise<Response> => {
        const jwt = typeof token === "function" ? await token() : token
        const headers = {...init.headers, ...(jwt ? {authorization: `Bearer ${jwt}`} : {})}
        return fetchFn(new URL(path, base), {...init, headers})
    }

    const request = async (path: string, init?: RequestInit): Promise<Response> => {
        const res = await raw(path, init)
        if (!res.ok) throw new ApiError(res.status, await messageOf(res))
        return res
    }

    const json = async <T>(path: string, method = "GET", body?: unknown): Promise<T> => {
        const init = body === undefined ? {method} : {method, body: JSON.stringify(body), headers: {"content-type": "application/json"}}
        return (await request(path, init)).json() as Promise<T>
    }

    const slotPath = (id: string): string => `slot/${encodeURIComponent(id)}`
    const tabPath = (id: string): string => `app/chrome/tab/${encodeURIComponent(id)}`

    return {
        fetch: raw,

        getMe: async () => (await json<{me: WayuseClient.JwtClaims}>("auth/me")).me,
        getConfig: () => json("wayuse/config"),
        getSlots: async () => (await json<WayuseClient.SlotList>("slot/")).data,
        getSlot: id => json(slotPath(id)),
        captureSlot: async id => new Uint8Array(await (await request(`${slotPath(id)}/capture.png`)).arrayBuffer()),
        clearSlot: id => json(slotPath(id), "DELETE"),
        clickSlot: (id, request) => json(`${slotPath(id)}/click`, "POST", request),
        keySlot: (id, keys) => json(`${slotPath(id)}/key`, "POST", {keys}),

        createVncTicket: async id => {
            const ticket = await json<WayuseClient.VncTicket>(`${slotPath(id)}/vnc-ticket`, "POST")
            const url = new URL(ticket.path, base)
            url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
            return {...ticket, url: url.href}
        },

        getClipboard: async () => (await json<WayuseClient.Clipboard>("clipboard")).text,
        setClipboard: async text => (await json<WayuseClient.Clipboard>("clipboard", "PUT", {text})).text,
        getStatus: () => json("wayuse/status"),

        getChromeTabs: async () => (await json<WayuseClient.ChromeTabList>("app/chrome/tab/")).data,
        getChromeTab: id => json(tabPath(id)),
        openChromeTab: request => json("app/chrome/tab/", "PUT", request),
        addChromeTab: request => json("app/chrome/tab/", "POST", request),
        closeChromeTab: id => json(tabPath(id), "DELETE"),
        captureChromeTab: async id => {
            const res = await request(`${tabPath(id)}/capture.jpg`)
            const videoGeometry = res.headers.get("page-video-geometry") ?? undefined
            return {jpeg: new Uint8Array(await res.arrayBuffer()), videoGeometry}
        },
        captureChromeHtml: async id => (await request(`${tabPath(id)}/capture.html`)).text(),
        clickChromeTab: (id, request) => json(`${tabPath(id)}/click`, "POST", request),
        evaluateChromeTab: async (id, expression) => (await json<WayuseClient.ChromeEvaluateResponse>(`${tabPath(id)}/evaluate`, "POST", {expression})).result,
    }
}
