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

    const request = async (path: string, init: RequestInit = {}): Promise<Response> => {
        const jwt = typeof token === "function" ? await token() : token
        const headers = {...init.headers, ...(jwt ? {authorization: `Bearer ${jwt}`} : {})}
        const res = await fetchFn(new URL(path, base), {...init, headers})
        if (!res.ok) throw new ApiError(res.status, await messageOf(res))
        return res
    }

    const json = async <T>(path: string): Promise<T> => (await request(path)).json() as Promise<T>

    const slotPath = (id: string): string => `slot/${encodeURIComponent(id)}`

    return {
        getMe: async () => (await json<{me: WayuseClient.JwtClaims}>("auth/me")).me,
        getConfig: () => json("config"),
        getSlots: async () => (await json<WayuseClient.SlotList>("slot/")).data,
        getSlot: id => json(slotPath(id)),
        captureSlot: async id => new Uint8Array(await (await request(`${slotPath(id)}/capture.png`)).arrayBuffer()),
    }
}
