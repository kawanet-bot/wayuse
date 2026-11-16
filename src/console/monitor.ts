// The monitor: every screen as a still picture, side by side like a wall of security cameras, clicked to operate.

import {$, createConsoleClient} from "./console-client.ts"
import {loadLineOf} from "./console-util.ts"
import {type Tile, capture, createTile, messageOf, setStatus} from "./monitor-tile.ts"

const client = createConsoleClient()

const STORAGE_KEY = "wayuse:monitor"

let tiles: Tile[] = []

const loadStatus = async (): Promise<void> => {
    try {
        const status = await client.getStatus()
        // Behind a reverse proxy the address bar names the proxy, and this names the host the screens are on.
        $("host").textContent = status.os.hostname
        $("load").textContent = loadLineOf(status)
        $("load").title = `loadavg ${status.os.loadavg.join(" ")} / ${status.os.availableParallelism} CPU`
    } catch (error) {
        $("load").textContent = `status: ${messageOf(error)}`
    }
}

// One after another, so more screens do not mean more grims running at once.
const captureAll = async (): Promise<void> => {
    void loadStatus()
    for (const tile of tiles) await capture(tile)
}

// Read once: the number of screens does not change while the container runs.
const loadSlots = async (): Promise<void> => {
    setStatus($("status"), "...")
    try {
        tiles = (await client.getSlots()).map(createTile)
        $("grid").replaceChildren(...tiles.map(tile => tile.el))
        setStatus($("status"), "")
    } catch (error) {
        setStatus($("status"), messageOf(error), false)
    }
    await captureAll()
}

// After each picture the loop waits `next`, and after each round of all screens `round`.
const AUTO: Record<string, {next: number, round: number}> = {
    fast: {next: 1000, round: 1000},
    slow: {next: 1000, round: 60 * 1000},
}

const auto = (): HTMLSelectElement => $<HTMLSelectElement>("auto")

let looping = false

// Choosing another rate ends the wait in progress.
let wake = (): void => undefined

const nap = (ms: number) => new Promise<void>(resolve => {
    const timer = setTimeout(resolve, ms)
    wake = () => {
        clearTimeout(timer)
        resolve()
    }
})

const loop = async (): Promise<void> => {
    if (looping) return wake()
    looping = true
    let i = 0
    while (AUTO[auto().value]) {
        // A tab nobody looks at takes no pictures.
        if (!document.hidden && tiles.length) {
            if (i === 0) void loadStatus()
            await capture(tiles[i]!)
            i = (i + 1) % tiles.length
        }
        const rate = AUTO[auto().value]
        if (rate) await nap(i === 0 ? rate.round : rate.next)
    }
    looping = false
}

// The rate is remembered in this browser. Storage that refuses is not an error.
const save = (): void => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({auto: auto().value}))
    } catch {
        // works without
    }
}

const restore = (): {auto?: string} => {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")
    } catch {
        return {}
    }
}

const init = async (): Promise<void> => {
    const saved = restore()
    if (saved.auto && AUTO[saved.auto]) auto().value = saved.auto

    auto().addEventListener("change", () => {
        save()
        void loop()
    })
    $("recapture-all").addEventListener("click", () => void captureAll())

    await loadSlots()
    void loop()
}

void init()
