import {HttpError} from "../http-error.ts"
import {parseCombo} from "./combo.ts"
import {keysymFromModifier, keysymFromName, scancodeFromKeysym} from "./keysym.ts"

export interface Key {
    keysym: number
    /** Present when the key is pressed by its place on the keyboard. */
    scancode?: number
}

/** One word of a key sequence: a combination to press, or a pause. */
export type KeyStep = {keys: Key[], wait?: undefined} | {wait: number, keys?: undefined}

// Two to ten dots pause for a tenth of a second each. One dot alone is the period key.
const DOT_DELAY = 100
const MAX_DOTS = 10

// The VNC connection stays open through the pauses, so one call may not pause for longer in all.
const MAX_WAIT = 10000

/**
 * The keys of one combination, modifiers first. Within one, every key goes by its place or none does.
 */
export const keysOf = (modifiers: number[], key: number): Key[] => {
    const all = [...modifiers, key]
    const codes = all.map(scancodeFromKeysym)
    const byPosition = codes.every(code => code)
    return all.map((keysym, i) => (byPosition ? {keysym, scancode: codes[i]} : {keysym}))
}

/**
 * Reads a sequence in bindsym's notation, such as "ctrl+l .. ctrl+v .. Return", before any of it is sent.
 */
export const parseKeySequence = (sequence: string): KeyStep[] => {
    const steps = sequence.trim().split(/\s+/).map((word): KeyStep => {
        const {modifiers, key} = parseCombo(word)
        if (/^\.{2,}$/.test(key)) {
            if (modifiers.length) throw new HttpError(400, `Wait with modifiers: ${word}`)
            if (key.length > MAX_DOTS) throw new HttpError(400, `Too many dots: ${key.length} (max ${MAX_DOTS})`)
            return {wait: key.length * DOT_DELAY}
        }
        return {keys: keysOf(modifiers.map(keysymFromModifier), keysymFromName(key))}
    })

    const total = steps.reduce((sum, step) => sum + (step.wait ?? 0), 0)
    if (total > MAX_WAIT) throw new HttpError(400, `Too long wait: ${total}ms (max ${MAX_WAIT}ms)`)
    return steps
}

export interface ButtonPress {
    modifiers: Key[]
    /** The bit of RFB's button mask. */
    mask: number
}

/**
 * Reads a button in bindsym's notation, such as "ctrl+button1". RFB has eight buttons, of which 4 to 7 are the wheel.
 */
export const parseButton = (button: string): ButtonPress => {
    const {modifiers, key} = parseCombo(button)
    const n = /^button([1-8])$/i.exec(key)?.[1]
    if (!n) throw new HttpError(400, `Invalid button: ${button}`)
    const keysyms = modifiers.map(keysymFromModifier)
    const codes = keysyms.map(scancodeFromKeysym)
    const byPosition = codes.every(code => code)
    return {modifiers: keysyms.map((keysym, i) => (byPosition ? {keysym, scancode: codes[i]} : {keysym})), mask: 1 << (Number(n) - 1)}
}
