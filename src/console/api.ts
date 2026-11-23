// The form that tries each API: it shows the request, the wayuse command that does the same, and the response.

import {HTML} from "html-ele"
import {INPUTS, SELECTS, clearImage, control, copy, fill, image, pretty, setStatus, showImage, values} from "./api-controls.ts"
import {type Endpoint, type Field, CLICKABLE, ENDPOINTS, cliOf, endpointGroupsOf, fieldsOf, keyOf, requestOf} from "./api-endpoints.ts"
import {$, BASE, createConsoleClient} from "./console-client.ts"
import {imagePixelOf} from "./console-util.ts"

const client = createConsoleClient()

const STORAGE_KEY = "wayuse:api"

// A click takes a moment to show on the screen, and the capture after it waits that long.
const RECAPTURE_DELAY = 500

// Filled once the server says which applications its image has.
let endpoints: Endpoint[] = []

const chosen = (): Endpoint => endpoints[Number(control("endpoint").value)] ?? endpoints[0]!

// The choice and the inputs worth keeping are remembered in this browser. Storage that refuses is not an error.
const save = (): void => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({endpoint: keyOf(chosen()), slot: control("slot").value, url: control("url").value}))
    } catch {
        // works without
    }
}

const restore = (): {endpoint?: string, slot?: string, url?: string} => {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")
    } catch {
        return {}
    }
}

// Shows the fields the chosen endpoint takes, and writes out the request and the command they make.
const update = (): void => {
    const endpoint = chosen()
    const used = fieldsOf(endpoint)
    document.querySelectorAll<HTMLElement>("[data-field]").forEach(el => {
        el.hidden = !used.includes(el.dataset.field as Field)
    })

    const request = requestOf(endpoint, values())
    $("note").textContent = endpoint.note
    // The full URL, to copy for another tool or another person: a pull-down's text cannot be selected.
    const lines = [`${request.method} ${location.origin}${BASE}${request.path}`]
    if (request.body) lines.push(JSON.stringify(request.body))
    control("request").value = lines.join("\n")
    control("cli").value = cliOf(endpoint, values()) ?? "(no command)"
    save()
}

const loadOptions = async (hasChrome: boolean): Promise<void> => {
    const [slots, tabs] = await Promise.all([client.getSlots(), hasChrome ? client.getChromeTabs() : []])
    // An empty slot is a choice of its own for opening a window: the server then takes the first.
    fill($<HTMLSelectElement>("slot"), slots.map(slot => [slot.id, slot.id]))
    // A tab outside the default context looks the same on the screen, so the list says which it is.
    const context = (kind: string): string => (kind === "default" ? "" : `[${kind}] `)
    fill($<HTMLSelectElement>("id"), tabs.map(tab => [tab.id, `${tab.sway?.output ?? "-"}  ${context(tab.target.context)}${tab.target.title || tab.target.url}`]))
}

let hasChrome = false

const run = async ({keepImage = false} = {}): Promise<void> => {
    const endpoint = chosen()
    const request = requestOf(endpoint, values())
    const button = $<HTMLButtonElement>("run")
    button.disabled = true
    setStatus("...")
    if (!keepImage) clearImage()

    const started = performance.now()
    try {
        const init = request.body ? {method: request.method, headers: {"content-type": "application/json"}, body: JSON.stringify(request.body)} : {method: request.method}
        const res = await client.fetch(request.path, init)
        setStatus(`${res.status} ${res.statusText} · ${Math.round(performance.now() - started)} ms`, res.ok)

        if (endpoint.shows === "image" && res.ok) {
            const blob = await res.blob()
            const field = CLICKABLE[endpoint.path]?.field
            showImage(blob, endpoint.path, field && control(field).value)
            // What comes beside the picture in a Page- header is part of the answer.
            const headers = [...res.headers].filter(([name]) => name.startsWith("page-")).map(([name, value]) => `${name}: ${value}`)
            control("response").value = [`${blob.type} ${blob.size} bytes`, ...headers].join("\n")
        } else {
            control("response").value = pretty(await res.text())
        }
    } catch (error) {
        setStatus("ERROR", false)
        control("response").value = String(error)
    } finally {
        button.disabled = false
    }

    // A request may have opened or closed a tab, and the pull-downs follow.
    await loadOptions(hasChrome).catch(error => console.warn(error))
    update()
}

// A click on a shown capture becomes the click request, sent through the form so that the command shown is the one that ran.
const clickImage = async (event: MouseEvent): Promise<void> => {
    const {path = "", target = ""} = image().dataset
    const clickable = CLICKABLE[path]
    if (!clickable || !target || $<HTMLButtonElement>("run").disabled) return

    const {x, y} = imagePixelOf(image(), event.offsetX, event.offsetY)
    control("endpoint").value = String(endpoints.findIndex(endpoint => keyOf(endpoint) === clickable.click))
    control(clickable.field).value = target
    control("x").value = String(x)
    control("y").value = String(y)
    update()
    await run({keepImage: true})

    await new Promise(resolve => setTimeout(resolve, RECAPTURE_DELAY))
    const res = await client.fetch(path.replace(`:${clickable.field}`, encodeURIComponent(target)))
    if (res.ok) showImage(await res.blob(), path, target)
}

const init = async (): Promise<void> => {
    client.getStatus().then(status => $("host").textContent = status.os.hostname, error => console.warn(error))

    const config = await client.getConfig()
    hasChrome = !!config.apps.chrome
    endpoints = ENDPOINTS.filter(endpoint => !endpoint.app || config.apps[endpoint.app])
    // The server refuses a size outside the image's bounds.
    const {screen} = config
    control("width").setAttribute("placeholder", String(screen.width))
    control("width").setAttribute("min", String(screen.minWidth))
    control("width").setAttribute("max", String(screen.maxWidth))
    control("height").setAttribute("placeholder", String(screen.height))
    control("height").setAttribute("min", String(screen.minHeight))
    control("height").setAttribute("max", String(screen.maxHeight))
    $("width-hint").textContent = `(${screen.minWidth} to ${screen.maxWidth}, with height. Empty for the configured size)`
    $("height-hint").textContent = `(${screen.minHeight} to ${screen.maxHeight})`

    control("endpoint").append(HTML`${endpointGroupsOf(endpoints, BASE)}`)

    const saved = restore()
    const index = endpoints.findIndex(endpoint => keyOf(endpoint) === saved.endpoint)
    if (index >= 0) control("endpoint").value = String(index)
    if (saved.url) control("url").value = saved.url

    await loadOptions(hasChrome).catch(error => {
        setStatus("ERROR", false)
        control("response").value = String(error)
    })
    if (saved.slot && [...$<HTMLSelectElement>("slot").options].some(option => option.value === saved.slot)) control("slot").value = saved.slot
    update()

    for (const id of ["endpoint", ...SELECTS]) control(id).addEventListener("change", update)
    for (const id of INPUTS) control(id).addEventListener("input", update)
    $("reload").addEventListener("click", () => void loadOptions(hasChrome).then(update))
    $("copy").addEventListener("click", () => void copy())
    $("run").addEventListener("click", () => void run())
    image().addEventListener("click", event => void clickImage(event))
}

void init()
