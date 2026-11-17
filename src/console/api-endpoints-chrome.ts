// The APIs of Chrome that the console's form offers. An application has a file of its own.

import type {Endpoint, Field} from "./api-endpoints.ts"

const OPEN: Field[] = ["url", "slot", "width", "height", "context"]

export const CHROME_ENDPOINTS: Endpoint[] = [
    {method: "GET", path: "app/chrome/tab/", app: "chrome", cli: ["chrome", "list"], note: "Every tab of Chrome."},
    {method: "PUT", path: "app/chrome/tab/", app: "chrome", body: OPEN, cli: ["chrome", "open", ":url", "--slot", ":slot", "--size", ":size", "--context", ":context"], note: "Closes every window on the slot, sets the screen to the size, and opens the URL in a window that fills it."},
    {method: "POST", path: "app/chrome/tab/", app: "chrome", body: OPEN, cli: ["chrome", "open", ":url", "--add", "--slot", ":slot", "--size", ":size", "--context", ":context"], note: "Opens the URL in one more window of the size, over what is on the slot."},
    {method: "GET", path: "app/chrome/tab/:id", app: "chrome", cli: ["chrome", "show", "--tab", ":id"], note: "One tab."},
    {method: "DELETE", path: "app/chrome/tab/:id", app: "chrome", cli: ["chrome", "close", "--tab", ":id"], note: "Closes the tab, and returns it as it was."},
    {method: "GET", path: "app/chrome/tab/:id/capture.jpg", app: "chrome", shows: "image", cli: ["chrome", "capture", "--tab", ":id", "-o", "capture.jpg"], note: "A JPEG of what the tab shows. A click on the picture is sent as a click at that pixel."},
    {method: "GET", path: "app/chrome/tab/:id/capture.html", app: "chrome", shows: "text", cli: ["chrome", "html", "--tab", ":id", "-o", "capture.html"], note: "The tab's DOM as it is now, as HTML without scripts and styles."},
    {method: "POST", path: "app/chrome/tab/:id/click", app: "chrome", body: ["x", "y", "button"], cli: ["chrome", "click", ":x", ":y", "--tab", ":id", "--button", ":button"], note: "Clicks a pixel of the tab's capture. It reaches the page alone."},
    {method: "POST", path: "app/chrome/tab/:id/evaluate", app: "chrome", body: ["expression"], cli: ["chrome", "eval", ":expression", "--tab", ":id"], note: "Evaluates JavaScript in the tab's page. A promise is awaited, and an exception is a 400."},
]

/** The capture of a tab, and the endpoint a click on its picture is sent to. */
export const CHROME_CLICKABLE: Record<string, {field: "slot" | "id", click: string}> = {
    "app/chrome/tab/:id/capture.jpg": {field: "id", click: "POST app/chrome/tab/:id/click"},
}
