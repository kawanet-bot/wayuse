import type {WayuseClient} from "wayuse"
import {HttpError} from "../http-error.ts"
import {type Modifier, parseCombo} from "../input/combo.ts"

type Config = WayuseClient.Config

/** An open request with every default filled in. */
export type OpenRequest = Required<WayuseClient.ChromeOpenRequest>

const PROTOCOLS = ["http:", "https:", "about:"]
const CONTEXTS = ["default", "temporary"]

// The outputs sit 3000 apart, so one up to 2560 wide never reaches the next. 768 is the width of the smallest tablet.
const MIN_SIZE = 768
const MAX_SIZE = 2560

const TARGET_ID = /^[0-9A-F]{32}$/

/** A tab's id is CDP's targetId, and nothing of another shape is sent to Chrome. */
export const checkTabId = (id: string): string => {
    if (!TARGET_ID.test(id)) throw new HttpError(400, `Invalid tab: ${id}`)
    return id
}

const checkSize = (name: string, value: unknown): number => {
    if (!Number.isInteger(value) || (value as number) < MIN_SIZE || (value as number) > MAX_SIZE) {
        throw new HttpError(400, `Invalid ${name}: ${JSON.stringify(value)} (${MIN_SIZE} to ${MAX_SIZE})`)
    }
    return value as number
}

/**
 * Checks the body of PUT and POST /app/chrome/tab/, and fills in what it leaves out.
 */
export const resolveOpenRequest = (body: unknown, config: Config, slotIds: string[]): OpenRequest => {
    const {url, slot, width, height, context = "default"} = (body ?? {}) as Partial<Record<keyof OpenRequest, unknown>>

    if (typeof url !== "string" || !PROTOCOLS.includes(URL.parse(url)?.protocol ?? "")) throw new HttpError(400, `Invalid url: ${JSON.stringify(url)}`)
    if (!CONTEXTS.includes(context as string)) throw new HttpError(400, `Invalid context: ${JSON.stringify(context)}`)

    // One of the two alone leaves the aspect ratio open.
    if ((width == null) !== (height == null)) throw new HttpError(400, "Specify both width and height")

    // Without a slot the window still goes to a definite one: the first, not wherever sway's focus happens to be.
    const first = slotIds[0]
    if (first == null) throw new HttpError(503, "sway has no output")
    if (slot != null && typeof slot !== "string") throw new HttpError(400, `Invalid slot: ${JSON.stringify(slot)}`)

    return {
        url,
        slot: slot ?? first,
        width: width == null ? config.screen.width : checkSize("width", width),
        height: height == null ? config.screen.height : checkSize("height", height),
        context: context as OpenRequest["context"],
    }
}

// X11's button4 and up are the wheel, which CDP's back and forward are not, so only three are taken.
const BUTTONS: Record<string, {button: string, buttons: number}> = {
    button1: {button: "left", buttons: 1},
    button2: {button: "middle", buttons: 4},
    button3: {button: "right", buttons: 2},
}

// The bits of CDP's Input.dispatchMouseEvent. mod4 is Meta.
const MODIFIER_BITS: Record<Modifier, number> = {mod1: 1, ctrl: 2, mod4: 4, shift: 8}

export interface ClickRequest {
    x: number
    y: number
    button: string
    buttons: number
    modifiers: number
}

/**
 * Checks the body of POST /app/chrome/tab/:id/click, and turns bindsym's notation into what CDP takes.
 */
export const resolveClickRequest = (body: unknown): ClickRequest => {
    const {x, y, button = "button1"} = (body ?? {}) as Record<string, unknown>
    if (!Number.isInteger(x) || (x as number) < 0) throw new HttpError(400, `Invalid x: ${JSON.stringify(x)}`)
    if (!Number.isInteger(y) || (y as number) < 0) throw new HttpError(400, `Invalid y: ${JSON.stringify(y)}`)
    if (typeof button !== "string") throw new HttpError(400, `Invalid button: ${JSON.stringify(button)}`)

    const {modifiers, key} = parseCombo(button)
    const found = BUTTONS[key.toLowerCase()]
    if (!found) throw new HttpError(400, `Invalid button: ${button}`)

    return {x: x as number, y: y as number, ...found, modifiers: modifiers.reduce((bits, modifier) => bits | MODIFIER_BITS[modifier], 0)}
}
