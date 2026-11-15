// What the console's pages work out without touching the page, kept apart so a test reads it without a browser.

import type {WayuseClient} from "wayuse-client"

/** The server's root as the page sees it: everything ahead of "console/", a reverse proxy's prefix included. */
export const basePathOf = (pathname: string): string => pathname.replace(/console\/.*$/, "")

/** The parameters after the "#", which a browser sends to no server. Written as "#slot=..." or, as other consoles link here, "#!?slot=...". */
export const hashParams = (hash: string): URLSearchParams => new URLSearchParams(hash.replace(/^#(!\?)?/, ""))

/** The token of a login link. */
export const tokenOfHash = (hash: string): string | undefined => hashParams(hash).get("jwt") || undefined

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
