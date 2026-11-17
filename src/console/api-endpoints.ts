// The APIs the console's form offers, each with the wayuse command that does the same.

import {type ENode, EN} from "html-ele"
import {CHROME_CLICKABLE, CHROME_ENDPOINTS} from "./api-endpoints-chrome.ts"

/** The form's fields. A path takes them as `:name`, a body as its items, a command as its arguments. */
export type Field = "slot" | "id" | "url" | "width" | "height" | "context" | "x" | "y" | "button" | "keys" | "text" | "expression"

export type Values = Partial<Record<Field, string>>

export interface Endpoint {
    method: "GET" | "PUT" | "POST" | "DELETE"
    /** Relative to the server's root, with `:slot` and `:id` where the form's values go. */
    path: string
    /** The fields of the JSON body. One left empty is left out, and the server fills in its default. */
    body?: Field[]
    /** What the response is shown as. Default: JSON. */
    shows?: "image" | "text"
    /** The arguments of the wayuse command: a word as it is, `:field` for a value, and an option goes with the value after it. */
    cli?: string[]
    /** Offered only by an image that has this application. */
    app?: "chrome"
    note: string
}

const NUMBERS: Field[] = ["width", "height", "x", "y"]

export const ENDPOINTS: Endpoint[] = [
    {method: "GET", path: "slot/", cli: ["slot", "list"], note: "Every screen."},
    {method: "GET", path: "slot/:slot", cli: ["slot", "show", "--slot", ":slot"], note: "One screen: its sway output, the windows on it, and the number of VNC clients."},
    {method: "DELETE", path: "slot/:slot", cli: ["slot", "clear", "--slot", ":slot"], note: "Closes every window on the screen."},
    {method: "GET", path: "slot/:slot/capture.png", shows: "image", cli: ["slot", "capture", "--slot", ":slot", "-o", "capture.png"], note: "A PNG of the whole screen. A click on the picture is sent as a click at that pixel."},
    {method: "POST", path: "slot/:slot/click", body: ["x", "y", "button"], cli: ["slot", "click", ":x", ":y", "--slot", ":slot", "--button", ":button"], note: "Clicks a pixel of the screen's capture, whatever is there. The button is in the notation of sway's bindsym."},
    {method: "POST", path: "slot/:slot/key", body: ["keys"], cli: ["slot", "key", ":keys", "--slot", ":slot"], note: "Sends keys to the screen, in the notation of sway's bindsym separated by spaces. Two dots pause for 200ms."},
    {method: "POST", path: "slot/:slot/vnc-ticket", cli: ["slot", "vnc", "--slot", ":slot"], note: "Issues a ticket to connect to the screen once, by VNC over a WebSocket."},
    ...CHROME_ENDPOINTS,
    {method: "GET", path: "clipboard", cli: ["clipboard", "get"], note: "The text on the clipboard, which all screens share."},
    {method: "PUT", path: "clipboard", body: ["text"], cli: ["clipboard", "set", ":text"], note: "Puts the text on the clipboard. Pasting it is a key press: ctrl+v."},
    {method: "GET", path: "wayuse/status", cli: ["status"], note: "The load and the memory of the host."},
    {method: "GET", path: "wayuse/config", cli: ["config"], note: "The configuration the image was built from."},
    {method: "GET", path: "auth/me", cli: ["auth", "me"], note: "The claims of the token, as the server reads them."},
    {method: "GET", path: "ok", note: "An empty 200, for a health check. It needs no token."},
]

/** What tells one endpoint from another, for the form to remember the choice by. */
export const keyOf = (endpoint: Endpoint): string => `${endpoint.method} ${endpoint.path}`

/** The capture a click on the shown picture is sent to, by the path of the capture it came from. */
export const CLICKABLE: Record<string, {field: "slot" | "id", click: string}> = {
    "slot/:slot/capture.png": {field: "slot", click: "POST slot/:slot/click"},
    ...CHROME_CLICKABLE,
}

/** The choices of a pull-down, each a value and the words shown for it. A tab's title is among the words, so they are escaped. */
export const optionsOf = (items: [string, string][]): ENode[] =>
    items.map(([value, label]) => EN`<option value="${value}">${label}</option>`)

/** The endpoints as the choices of a pull-down, grouped as the server's routes are: by the first part of the path, and by the application under app/. */
export const endpointGroupsOf = (endpoints: Endpoint[], base: string): ENode[] => {
    const groups = new Map<string, ENode[]>()
    endpoints.forEach((endpoint, i) => {
        const [first, second] = endpoint.path.split("/")
        const name = first === "app" ? `app/${second}` : first!
        const options = groups.get(name) ?? []
        groups.set(name, options)
        options.push(EN`<option value="${i}">${endpoint.method.padEnd(6, " ")} ${base}${endpoint.path}</option>`)
    })
    return [...groups].map(([name, options]) => EN`<optgroup label="${name}">${options}</optgroup>`)
}

/** Every field the endpoint takes, in its path or in its body. */
export const fieldsOf = (endpoint: Endpoint): Field[] => [...(endpoint.path.match(/:\w+/g) ?? []).map(name => name.slice(1) as Field), ...(endpoint.body ?? [])]

export interface ApiRequest {
    method: Endpoint["method"]
    /** Relative to the server's root. */
    path: string
    body?: Record<string, string | number>
}

/**
 * The request the form's values make of an endpoint.
 */
export const requestOf = (endpoint: Endpoint, values: Values): ApiRequest => {
    const path = endpoint.path.replace(/:(\w+)/g, (_, name: Field) => encodeURIComponent(values[name] ?? ""))
    if (!endpoint.body) return {method: endpoint.method, path}

    const body: Record<string, string | number> = {}
    for (const field of endpoint.body) {
        const value = values[field] ?? ""
        if (value !== "") body[field] = NUMBERS.includes(field) ? Number(value) : value
    }
    return {method: endpoint.method, path, body}
}

// Quoted for a POSIX shell unless every character is one a shell leaves alone.
const shellWord = (word: string): string => (/^[\w@%+=:,./-]+$/.test(word) ? word : `'${word.replaceAll("'", `'\\''`)}'`)

/**
 * The wayuse command that does what the request does, or undefined for an endpoint without one.
 */
export const cliOf = (endpoint: Endpoint, values: Values): string | undefined => {
    if (!endpoint.cli) return

    const valueOf = (token: string): string => {
        if (token === ":size") return values.width && values.height ? `${values.width}x${values.height}` : ""
        return values[token.slice(1) as Field] ?? ""
    }

    const words: string[] = []
    endpoint.cli.forEach((token, i) => {
        const next = endpoint.cli![i + 1]
        // An option whose value is empty goes with it: the command's own default then applies.
        if (token.startsWith("--") && next?.startsWith(":") && !valueOf(next)) return
        if (!token.startsWith(":")) return void words.push(token)
        const value = valueOf(token)
        const option = endpoint.cli![i - 1]?.startsWith("--")
        if (value || !option) words.push(shellWord(value))
    })

    return ["npx", "wayuse", ...words].join(" ")
}
