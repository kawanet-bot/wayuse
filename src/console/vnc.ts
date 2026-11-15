// One screen over VNC, seen and operated in the browser through noVNC.

import {$, createConsoleClient} from "./console-client.ts"

const client = createConsoleClient()

// noVNC is served as its own package's files, unbundled, so it is loaded at run time and not built into this script.
const NOVNC = new URL("../../vendor/novnc/core/rfb.js", import.meta.url).href

// The slot is named after the "#": vnc/#slot=HEADLESS-1
const SLOT = new URLSearchParams(location.hash.replace(/^#/, "")).get("slot") ?? ""

// The state shows as an emoji in the title, where a browser's tab keeps it in view.
const STATES: Record<string, {icon: string, message?: string, reload?: string}> = {
    connecting: {icon: "⏳", message: "Connecting"},
    connected: {icon: "🖥️"},
    disconnected: {icon: "⚠️", reload: "Disconnected · click to connect again"},
}

// Several hosts have a screen of the same name, so the title carries the host's too.
let hostname = ""
let state = "connecting"

const setTitle = (): void => {
    document.title = [STATES[state]!.icon, hostname, SLOT || "vnc"].filter(Boolean).join(" ")
}

const setState = (name: string, message: string = STATES[name]!.message ?? ""): void => {
    state = name
    setTitle()
    $("message").textContent = message
    $("message").hidden = !message
    // No button where connecting again would end the same way, as without a slot.
    const reload = !message && STATES[name]!.reload
    $("reload").textContent = reload || ""
    $("reload").hidden = !reload
}

// A person who opens an empty screen wants something on it. POST adds a window, where PUT would resize the screen.
const openIfEmpty = async (): Promise<void> => {
    const [slot, config] = await Promise.all([client.getSlot(SLOT), client.getConfig()])
    if (slot.sway.windows.length || !config.apps.chrome) return
    const {width, height} = slot.sway.output.rect
    await client.addChromeTab({url: "about:blank", slot: SLOT, width, height})
}

const connect = async (): Promise<void> => {
    if (!SLOT) return setState("disconnected", "Name the slot as vnc/#slot=HEADLESS-1")
    setState("connecting")

    const {default: RFB} = await import(NOVNC)
    // A WebSocket carries no token, so each connection takes a ticket of its own.
    const rfb = new RFB($("screen"), (await client.createVncTicket(SLOT)).url)

    // The picture is scaled to the window, and the screen itself keeps its size.
    rfb.scaleViewport = true
    rfb.resizeSession = false
    rfb.background = "#000"

    rfb.addEventListener("connect", () => {
        setState("connected")
        rfb.focus()
    })
    rfb.addEventListener("disconnect", () => setState("disconnected"))
}

// It does not connect again by itself, so another slot or another try is a reload.
addEventListener("hashchange", () => location.reload())
$("reload").addEventListener("click", () => location.reload())

client.getStatus().then(status => {
    hostname = status.os.hostname
    setTitle()
}, error => console.warn(error))

// The window is opened before the connection starts: wayvnc 0.9.1 may crash when the two overlap.
const start = async (): Promise<void> => {
    if (SLOT) await openIfEmpty().catch(error => console.warn(error))
    await connect()
}

start().catch(error => {
    console.warn(error)
    setState("disconnected")
})
