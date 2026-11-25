import KEYMAPS from "../../../packages/server/assets/keymaps.json" with {type: "json"}
import KEYSYMDEF from "../../../packages/server/assets/keysymdef.json" with {type: "json"}
import {HttpError} from "../http-error.ts"
import type {Modifier} from "./combo.ts"

/** The left-hand key of each modifier, which is the one a sent combination presses. */
const MODIFIER_KEYS: Record<Modifier, string> = {shift: "Shift_L", ctrl: "Control_L", mod1: "Alt_L", mod4: "Super_L"}

let keysyms: Map<string, number> | undefined

// A name is looked up as written, then in lower case, where "a" wins over "A" for the name both fold to.
const getKeysyms = (): Map<string, number> => {
    if (keysyms) return keysyms
    keysyms = new Map()
    for (const [name, hex] of Object.entries(KEYSYMDEF as Record<string, string>)) {
        const code = parseInt(hex, 16)
        if (!keysyms.has(name)) keysyms.set(name, code)
        const lower = name.toLowerCase()
        if (!keysyms.has(lower) || name === lower) keysyms.set(lower, code)
    }
    return keysyms
}

/**
 * The number of a keysym's name, such as Return or a. A single character without a name is its Unicode keysym.
 */
export const keysymFromName = (name: string): number => {
    const map = getKeysyms()
    const code = map.get(name) ?? map.get(name.toLowerCase())
    if (code != null) return code
    const chars = [...name]
    if (chars.length === 1) {
        const cp = chars[0]!.codePointAt(0)!
        return cp < 0x100 ? cp : 0x01000000 + cp
    }
    throw new HttpError(400, `Unknown keysym: ${name}`)
}

export const keysymFromModifier = (modifier: Modifier): number => keysymFromName(MODIFIER_KEYS[modifier])

let scancodes: Map<number, number> | undefined

/**
 * The XT scancode to press a key by its place on the keyboard, or undefined for a key to send by keysym alone.
 */
export const scancodeFromKeysym = (keysym: number): number | undefined => {
    if (!scancodes) {
        scancodes = new Map()
        const keysyms = getKeysyms()
        for (const [name, hex] of Object.entries(KEYMAPS as Record<string, string>)) {
            const code = keysyms.get(name)
            if (code != null && !scancodes.has(code)) scancodes.set(code, parseInt(hex, 16))
        }
    }
    // Letters, digits, comma, period and the keys that type nothing. A symbol sits elsewhere on a JIS keyboard than on a US one.
    const byPosition = (keysym >= 0x61 && keysym <= 0x7a) || (keysym >= 0x30 && keysym <= 0x39) || keysym === 0x2c || keysym === 0x2e || (keysym >= 0xff00 && keysym <= 0xffff)
    return byPosition ? scancodes.get(keysym) : undefined
}
