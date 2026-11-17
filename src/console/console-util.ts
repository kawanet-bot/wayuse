// What the console's pages work out without touching the page, kept apart so a test reads it without a browser.

import type {WayuseClient} from "wayuse"

/** The server's root as the page sees it: everything ahead of "console/", a reverse proxy's prefix included. */
export const basePathOf = (pathname: string): string => pathname.replace(/console\/.*$/, "")

/** The parameters of a hash written as "#!?name=value". The "#!?" says the hash is one to read, and any other is read as none. */
export const hashParams = (hash: string): URLSearchParams => new URLSearchParams(hash.startsWith("#!?") ? hash.slice(3) : "")

/** The token of a login link, "#!?jwt=...". A browser sends what follows the "#" to no server. */
export const tokenOfHash = (hash: string): string | undefined => hashParams(hash).get("jwt") || undefined

/** Where a visitor goes for a token: the sign-in address, with the entry's own path and "#!?jwt=" at its end for the token to be added to. */
export const signInUrlOf = (signIn: string, pathname: string): string => signIn + encodeURIComponent(`${pathname}#!?jwt=`)

/** Whether the server itself refused the token. A server that is down, or a proxy's own error, says nothing of the token. */
export const isRefusal = (error: unknown): boolean => (error as {status?: unknown} | null)?.status === 401

/** What stands for a failure that says nothing of the token: its status when it has one, and its own words otherwise. */
export const failureOf = (error: unknown): string => String((error as {status?: unknown} | null)?.status ?? (error as Error | null)?.message ?? error)

interface ModifierKeys {
    shiftKey: boolean
    ctrlKey: boolean
    altKey: boolean
    metaKey: boolean
}

const MODIFIERS: [keyof ModifierKeys, string][] = [["shiftKey", "shift"], ["ctrlKey", "ctrl"], ["altKey", "mod1"], ["metaKey", "mod4"]]

/** A browser's click as a button in the notation of sway's bindsym. */
export const buttonOf = (event: ModifierKeys): string => [...MODIFIERS.filter(([key]) => event[key]).map(([, name]) => name), "button1"].join("+")

interface ShownImage {
    naturalWidth: number
    naturalHeight: number
    clientWidth: number
    clientHeight: number
}

/** The pixel of the image itself under a click on it as shown, which may be scaled down. */
export const imagePixelOf = (image: ShownImage, offsetX: number, offsetY: number): {x: number, y: number} => ({
    x: Math.min(image.naturalWidth - 1, Math.floor(offsetX * image.naturalWidth / image.clientWidth)),
    y: Math.min(image.naturalHeight - 1, Math.floor(offsetY * image.naturalHeight / image.clientHeight)),
})

// A host without swap has a total of 0, and shows 0% rather than nothing.
const percent = (used: number, total: number): string => `${total ? Math.round(used / total * 100) : 0}%`

/** The host's load in one line. CPU is the one-minute load average over the number of CPUs. */
export const loadLineOf = ({os, meminfo: m}: WayuseClient.Status): string => {
    const cpu = percent(os.loadavg[0] ?? 0, os.availableParallelism)
    const memory = percent(m.MemTotal - m.MemAvailable, m.MemTotal)
    const swap = percent(m.SwapTotal - m.SwapFree, m.SwapTotal)
    return `CPU ${cpu} Memory ${memory} Swap ${swap}`
}
