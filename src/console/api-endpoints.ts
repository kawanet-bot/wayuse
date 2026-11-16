// The APIs the console's form offers, each with the wayuse command that does the same.

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

const OPEN: Field[] = ["url", "slot", "width", "height", "context"]

export const ENDPOINTS: Endpoint[] = [
    {method: "GET", path: "slot/", cli: ["slot", "list"], note: "Every screen."},
    {method: "GET", path: "slot/:slot", cli: ["slot", "show", "--slot", ":slot"], note: "One screen: its sway output, the windows on it, and the number of VNC clients."},
    {method: "DELETE", path: "slot/:slot", cli: ["slot", "clear", "--slot", ":slot"], note: "Closes every window on the screen."},
    {method: "GET", path: "slot/:slot/capture.png", shows: "image", cli: ["slot", "capture", "--slot", ":slot", "-o", "capture.png"], note: "A PNG of the whole screen. A click on the picture is sent as a click at that pixel."},
    {method: "POST", path: "slot/:slot/click", body: ["x", "y", "button"], cli: ["slot", "click", ":x", ":y", "--slot", ":slot", "--button", ":button"], note: "Clicks a pixel of the screen's capture, whatever is there. The button is in the notation of sway's bindsym."},
    {method: "POST", path: "slot/:slot/key", body: ["keys"], cli: ["slot", "key", ":keys", "--slot", ":slot"], note: "Sends keys to the screen, in the notation of sway's bindsym separated by spaces. Two dots pause for 200ms."},
    {method: "POST", path: "slot/:slot/vnc-ticket", cli: ["slot", "vnc", "--slot", ":slot"], note: "Issues a ticket to connect to the screen once, by VNC over a WebSocket."},
    {method: "GET", path: "app/chrome/tab/", app: "chrome", cli: ["chrome", "list"], note: "Every tab of Chrome."},
    {method: "PUT", path: "app/chrome/tab/", app: "chrome", body: OPEN, cli: ["chrome", "open", ":url", "--slot", ":slot", "--size", ":size", "--context", ":context"], note: "Closes every window on the slot, sets the screen to the size, and opens the URL in a window that fills it."},
    {method: "POST", path: "app/chrome/tab/", app: "chrome", body: OPEN, cli: ["chrome", "open", ":url", "--add", "--slot", ":slot", "--size", ":size", "--context", ":context"], note: "Opens the URL in one more window of the size, over what is on the slot."},
    {method: "GET", path: "app/chrome/tab/:id", app: "chrome", cli: ["chrome", "show", "--tab", ":id"], note: "One tab."},
    {method: "DELETE", path: "app/chrome/tab/:id", app: "chrome", cli: ["chrome", "close", "--tab", ":id"], note: "Closes the tab, and returns it as it was."},
    {method: "GET", path: "app/chrome/tab/:id/capture.jpg", app: "chrome", shows: "image", cli: ["chrome", "capture", "--tab", ":id", "-o", "capture.jpg"], note: "A JPEG of what the tab shows. A click on the picture is sent as a click at that pixel."},
    {method: "GET", path: "app/chrome/tab/:id/capture.html", app: "chrome", shows: "text", cli: ["chrome", "html", "--tab", ":id", "-o", "capture.html"], note: "The tab's DOM as it is now, as HTML without scripts and styles."},
    {method: "POST", path: "app/chrome/tab/:id/click", app: "chrome", body: ["x", "y", "button"], cli: ["chrome", "click", ":x", ":y", "--tab", ":id", "--button", ":button"], note: "Clicks a pixel of the tab's capture. It reaches the page alone."},
    {method: "POST", path: "app/chrome/tab/:id/evaluate", app: "chrome", body: ["expression"], cli: ["chrome", "eval", ":expression", "--tab", ":id"], note: "Evaluates JavaScript in the tab's page. A promise is awaited, and an exception is a 400."},
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
    "app/chrome/tab/:id/capture.jpg": {field: "id", click: "POST app/chrome/tab/:id/click"},
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
