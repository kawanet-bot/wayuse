// The monitor: every screen as a still picture, side by side like a wall of security cameras, clicked to operate.

import type {WayuseClient} from "wayuse-client"
import {$, BASE, createConsoleClient} from "./console-client.ts"
import {buttonOf, imagePixelOf, loadLineOf} from "./console-util.ts"

const client = createConsoleClient()

// A click takes a moment to show on the screen, and the capture after it waits that long.
const RECAPTURE_DELAY = 500

// Half the real size for every screen, whatever its resolution, so they compare by eye.
const SCALE = 0.5

const STORAGE_KEY = "wayuse:monitor"

interface Tile {
    id: string
    el: HTMLElement
    frame: HTMLElement
    image: HTMLImageElement
    meta: HTMLElement
    status: HTMLElement
    clients: string
    capturing: boolean
    captureFailed: boolean
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const setStatus = (el: HTMLElement, text: string, ok?: boolean): void => {
    el.textContent = text
    el.className = `status ${ok == null ? "" : ok ? "ok" : "ng"}`
}

const messageOf = (error: unknown): string => String((error as Error)?.message || error)

const timeOf = (): string => new Date().toLocaleTimeString([], {hour12: false})

let tiles: Tile[] = []

const resize = (tile: Tile, width: number, height: number): void => {
    tile.el.style.width = `${Math.round(width * SCALE)}px`
    tile.frame.style.aspectRatio = `${width} / ${height}`
}

// One at a time per tile: a capture still on its way is not overtaken by the next.
const capture = async (tile: Tile): Promise<void> => {
    if (tile.capturing) return
    tile.capturing = true
    try {
        const png = await client.captureSlot(tile.id)
        const url = URL.createObjectURL(new Blob([png as BlobPart], {type: "image/png"}))
        await new Promise((resolve, reject) => {
            tile.image.onload = resolve
            tile.image.onerror = reject
            if (tile.image.src) URL.revokeObjectURL(tile.image.src)
            tile.image.src = url
        })

        // A window opened since may have resized the screen, and the picture is what tells.
        const {naturalWidth, naturalHeight} = tile.image
        resize(tile, naturalWidth, naturalHeight)
        tile.meta.textContent = `${naturalWidth}x${naturalHeight} · ${tile.clients} · ${timeOf()}`

        // Only a failed capture is cleared here. The result of a click stays until the next click.
        if (tile.captureFailed) setStatus(tile.status, "")
        tile.captureFailed = false
    } catch (error) {
        setStatus(tile.status, messageOf(error), false)
        tile.captureFailed = true
    } finally {
        tile.capturing = false
    }
}

const clickImage = async (tile: Tile, event: MouseEvent): Promise<void> => {
    const {image} = tile
    if (!image.naturalWidth || tile.el.classList.contains("is-busy")) return

    const {x, y} = imagePixelOf(image, event.offsetX, event.offsetY)
    const button = buttonOf(event)

    tile.el.classList.add("is-busy")
    setStatus(tile.status, `click ${x},${y}`)
    try {
        await client.clickSlot(tile.id, {x, y, button})
        setStatus(tile.status, `${button} ${x},${y}`, true)
    } catch (error) {
        setStatus(tile.status, messageOf(error), false)
    } finally {
        tile.el.classList.remove("is-busy")
    }

    await sleep(RECAPTURE_DELAY)
    await capture(tile)
}

const createTile = (slot: WayuseClient.Slot): Tile => {
    const el = ($<HTMLTemplateElement>("tile").content.firstElementChild as HTMLElement).cloneNode(true) as HTMLElement
    const tile: Tile = {
        id: slot.id,
        el,
        frame: el.querySelector(".monitor-frame")!,
        image: el.querySelector(".monitor-image")!,
        meta: el.querySelector(".monitor-meta")!,
        status: el.querySelector(".status")!,
        clients: `VNC ${slot.wayvnc.clients}`,
        capturing: false,
        captureFailed: false,
    }

    el.querySelector(".monitor-name")!.textContent = slot.id
    // The target names the server and the slot, so opening the same screen twice returns to its tab.
    Object.assign(el.querySelector("a")!, {href: `${BASE}console/vnc/#slot=${encodeURIComponent(slot.id)}`, target: `vnc:${BASE}${slot.id}`})
    tile.image.addEventListener("click", event => void clickImage(tile, event))

    // The tile takes the screen's place before its first picture arrives.
    const {width, height} = slot.sway.output.rect
    resize(tile, width, height)
    tile.meta.textContent = `${width}x${height} · ${tile.clients}`
    return tile
}

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
