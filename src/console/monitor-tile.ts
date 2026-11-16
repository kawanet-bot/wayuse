// One screen of the monitor, as a tile. It shows the screen's picture, and sends a click on it to the screen.

import type {WayuseClient} from "wayuse-client"
import {$, BASE, createConsoleClient} from "./console-client.ts"
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
    status: HTMLElement
    clients: string
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

export const createTile = (slot: WayuseClient.Slot): Tile => {
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
    Object.assign(el.querySelector("a")!, {href: `${BASE}console/vnc/#!?slot=${encodeURIComponent(slot.id)}`, target: `vnc:${BASE}${slot.id}`})
    tile.image.addEventListener("click", event => void clickImage(tile, event))

    // The tile takes the screen's place before its first picture arrives.
    const {width, height} = slot.sway.output.rect
    resize(tile, width, height)
    tile.meta.textContent = `${width}x${height} · ${tile.clients}`
    return tile
}
