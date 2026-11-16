// The controls of the API form. They hold what is entered, and show the status, the response and the picture.

import type {Field, Values} from "./api-endpoints.ts"
import {$} from "./console-client.ts"

export const SELECTS: Field[] = ["slot", "id", "context"]
export const INPUTS: Field[] = ["url", "width", "height", "x", "y", "button", "keys", "text", "expression"]

// The capture a click on the shown picture is sent to, by the path of the capture it came from.
export const CLICKABLE: Record<string, {field: "slot" | "id", click: string}> = {
    "slot/:slot/capture.png": {field: "slot", click: "POST slot/:slot/click"},
    "app/chrome/tab/:id/capture.jpg": {field: "id", click: "POST app/chrome/tab/:id/click"},
}

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

export const control = (id: string): Control => $<Control>(id)

export const values = (): Values => Object.fromEntries([...SELECTS, ...INPUTS].map(field => [field, control(field).value]))

export const setStatus = (text: string, ok?: boolean): void => {
    $("status").textContent = text
    $("status").className = `status ${ok == null ? "" : ok ? "ok" : "ng"}`
}

// Replaces a pull-down's choices, and keeps the one chosen when it is still there.
export const fill = (select: HTMLSelectElement, items: [string, string][]): void => {
    const current = select.value
    select.replaceChildren(...items.map(([value, label]) => new Option(label, value)))
    if (items.some(([value]) => value === current)) select.value = current
}

export const pretty = (text: string): string => {
    if (!text) return "(no body)"
    try {
        return JSON.stringify(JSON.parse(text), null, 2)
    } catch {
        return text
    }
}

export const image = (): HTMLImageElement => $<HTMLImageElement>("image")

export const showImage = (blob: Blob, path: string, target: string | undefined): void => {
    if (image().src) URL.revokeObjectURL(image().src)
    image().src = URL.createObjectURL(blob)
    const clickable = !!(CLICKABLE[path] && target)
    image().dataset.path = clickable ? path : ""
    image().dataset.target = clickable ? target : ""
    image().classList.toggle("clickable", clickable)
}

export const clearImage = (): void => {
    if (image().src) URL.revokeObjectURL(image().src)
    image().removeAttribute("src")
    image().dataset.path = ""
    image().dataset.target = ""
    image().classList.remove("clickable")
}

export const copy = async (): Promise<void> => {
    const cli = $<HTMLTextAreaElement>("cli")
    cli.select()
    try {
        await navigator.clipboard.writeText(cli.value)
    } catch {
        // navigator.clipboard is there only over https or on localhost.
        document.execCommand("copy")
    }
    const button = $("copy")
    const label = button.textContent
    button.textContent = "✓ Copied"
    setTimeout(() => button.textContent = label, 1200)
}
