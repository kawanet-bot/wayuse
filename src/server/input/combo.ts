import {HttpError} from "../http-error.ts"

/** The modifier keys by the names sway's bindsym gives them. */
export type Modifier = "shift" | "ctrl" | "mod1" | "mod4"

const MODIFIERS: Record<string, Modifier> = {shift: "shift", ctrl: "ctrl", control: "ctrl", mod1: "mod1", mod4: "mod4"}

export interface Combo {
    /** In the order they are pressed. */
    modifiers: Modifier[]
    /** What is left without the modifiers: a key's name, or button1 and up. */
    key: string
}

/**
 * Splits bindsym's notation, such as "ctrl+l" or "shift+button1". The plus key itself is written by its name, "plus".
 */
export const parseCombo = (combo: string): Combo => {
    const parts = combo.split("+")
    const key = parts.pop()
    if (!key) throw new HttpError(400, `Invalid key: ${combo}`)

    const modifiers = parts.map(part => {
        const modifier = MODIFIERS[part.toLowerCase()]
        if (!modifier) throw new HttpError(400, `Unknown modifier: ${part}`)
        return modifier
    })

    return {modifiers, key}
}
