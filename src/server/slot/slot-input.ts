import type {ServerDeps} from "../deps.ts"
import {HttpError} from "../http-error.ts"
import {parseButton, parseKeySequence} from "../input/key-sequence.ts"
import {swayCommand} from "../sway/swaymsg.ts"
import {withVncInput} from "../wayvnc/vnc-input.ts"
import {getSlot, slotNumberOf} from "./slot.ts"

// The pause between the steps of a click or a key press: the default of xdotool's --delay.
const INPUT_DELAY = 12

const SLEEP = (msec: number) => new Promise(resolve => setTimeout(resolve, msec))

/**
 * Clicks a pixel of the slot's capture.png, whatever is there: the topmost window, Chrome's own address bar included.
 */
export const clickSlot = async (deps: ServerDeps, id: string, x: number, y: number, button: string): Promise<void> => {
    const {modifiers, mask} = parseButton(button)

    const {rect} = (await getSlot(deps, id)).sway.output
    if (x >= rect.width || y >= rect.height) throw new HttpError(400, `Out of slot: ${x},${y} (${rect.width}x${rect.height})`)

    // Each wayvnc serves one output, so the position goes as it is, from the slot's top left.
    await deps.locks.withSeat(() => withVncInput(deps, slotNumberOf(id), async vnc => {
        modifiers.forEach(key => vnc.key(key, true))
        vnc.pointer(x, y, 0)
        await SLEEP(INPUT_DELAY)
        vnc.pointer(x, y, mask)
        await SLEEP(INPUT_DELAY)
        vnc.pointer(x, y, 0)
        await SLEEP(INPUT_DELAY)
        modifiers.forEach(key => vnc.key(key, false))
    }))
    deps.log(`${id} click ${x} ${y} ${button}`)
}

/**
 * Sends keys to the window that last had the focus on the slot.
 */
export const keySlot = async (deps: ServerDeps, id: string, keys: string): Promise<void> => {
    // Read in full first, so a misspelled name stops the call before half of it is typed.
    const steps = parseKeySequence(keys)
    await getSlot(deps, id)

    await deps.locks.withSeat(async () => {
        await swayCommand(deps.exec, `focus output ${id}`)
        await withVncInput(deps, slotNumberOf(id), async vnc => {
            for (const step of steps) {
                if (step.wait) {
                    await SLEEP(step.wait)
                    continue
                }
                const main = step.keys!.at(-1)!
                const modifiers = step.keys!.slice(0, -1)
                modifiers.forEach(key => vnc.key(key, true))
                vnc.key(main, true)
                vnc.key(main, false)
                await SLEEP(INPUT_DELAY)
                modifiers.reverse().forEach(key => vnc.key(key, false))
            }
        })
    })
    deps.log(`${id} key ${keys}`)
}
