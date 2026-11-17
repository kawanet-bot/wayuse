// One screen of the monitor, as a tile. It shows the screen's picture, and sends a click on it to the screen.

import {ELE} from "html-ele"
import type {WayuseClient} from "wayuse"
import {BASE, createConsoleClient} from "./console-client.ts"
import {buttonOf, imagePixelOf} from "./console-util.ts"

const client = createConsoleClient()

// A click takes a moment to show on the screen, and the capture after it waits that long.
const RECAPTURE_DELAY = 500

// Half the real size for every screen, whatever its resolution, so they compare by eye.
const SCALE = 0.5

export interface Tile {
    id: string
    el: HTMLElement
    frame: HTMLElement
    image: HTMLImageElement
    meta: HTMLElement
    time: HTMLElement
    status: HTMLElement
    capturing: boolean
    captureFailed: boolean
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export const setStatus = (el: HTMLElement, text: string, ok?: boolean): void => {
    el.textContent = text
    el.className = `status ${ok == null ? "" : ok ? "ok" : "ng"}`
}

export const messageOf = (error: unknown): string => String((error as Error)?.message || error)

const timeOf = (): string => new Date().toLocaleTimeString([], {hour12: false})

const resize = (tile: Tile, width: number, height: number): void => {
    tile.el.style.width = `${Math.round(width * SCALE)}px`
    tile.frame.style.aspectRatio = `${width} / ${height}`
}

// One at a time per tile: a capture still on its way is not overtaken by the next.
export const capture = async (tile: Tile): Promise<void> => {
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
        tile.meta.textContent = `${naturalWidth}x${naturalHeight}`
        tile.time.textContent = timeOf()

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

export const createTile = (slot: WayuseClient.Slot): Tile => {
    const {width, height} = slot.sway.output.rect

    // The link's target names the server and the slot, so opening the same screen twice returns to its tab.
    // A drag takes the picture to another application.
    // language=HTML
    const el = ELE`
        <section class="monitor-tile">
            <div class="monitor-tile-head">
                <span class="monitor-name">${slot.id}</span>
                <span class="monitor-meta">${width}x${height}</span>
                <span class="status"></span>
                <span class="monitor-time"></span>
                <a title="Open over VNC" href="${BASE}console/vnc/#!?slot=${encodeURIComponent(slot.id)}" target="vnc:${BASE}${slot.id}">↗</a>
            </div>
            <div class="monitor-frame">
                <img class="monitor-image" alt="" draggable="true">
            </div>
        </section>
    `

    const tile: Tile = {
        id: slot.id,
        el,
        frame: el.querySelector(".monitor-frame")!,
        image: el.querySelector(".monitor-image")!,
        meta: el.querySelector(".monitor-meta")!,
        time: el.querySelector(".monitor-time")!,
        status: el.querySelector(".status")!,
        capturing: false,
        captureFailed: false,
    }

    tile.image.addEventListener("click", event => void clickImage(tile, event))

    // The tile takes the screen's place before its first picture arrives.
    resize(tile, width, height)
    return tile
}
