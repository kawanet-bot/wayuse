import type {WayuseClient} from "wayuse"
import type {ServerDeps} from "../deps.ts"
import {HttpError} from "../http-error.ts"
import {getSwayOutputs, getSwayWindows, swayCommand} from "../sway/swaymsg.ts"
import {waitFor} from "../utils/wait-for.ts"

type Slot = WayuseClient.Slot

type SlotDeps = Pick<ServerDeps, "exec" | "runtimeDir" | "log">

// A slot is a sway output, and the name goes into command lines, so nothing else is let through.
const SLOT_ID = /^HEADLESS-(\d+)$/

/** The number n of HEADLESS-n, which also numbers its wayvnc. */
export const slotNumberOf = (id: string): number => {
    const n = SLOT_ID.exec(id)?.[1]
    if (n == null) throw new HttpError(400, `Invalid slot: ${id}`)
    return Number(n)
}

const wayvncClients = async ({exec, runtimeDir}: SlotDeps, n: number): Promise<number> => {
    const stdout = await exec("wayvncctl", [`--socket=${runtimeDir}/wayvncctl-${n}`, "--json", "client-list"])
    return (JSON.parse(stdout.toString()) as unknown[]).length
}

export const getSlots = async (deps: SlotDeps): Promise<Slot[]> => {
    const [outputs, windows] = await Promise.all([getSwayOutputs(deps.exec), getSwayWindows(deps.exec)])

    return Promise.all(outputs.map(async (output): Promise<Slot> => ({
        id: output.name,
        sway: {output, windows: windows.get(output.name) ?? []},
        wayvnc: {clients: await wayvncClients(deps, slotNumberOf(output.name))},
    })))
}

export const getSlot = async (deps: SlotDeps, id: string): Promise<Slot> => {
    slotNumberOf(id)
    const slot = (await getSlots(deps)).find(slot => slot.id === id)
    if (!slot) throw new HttpError(404, `Slot not found: ${id}`)
    return slot
}

/**
 * Closes every window on the slot, whatever application each belongs to.
 */
export const clearSlot = async (deps: SlotDeps, id: string): Promise<void> => {
    await getSlot(deps, id)
    const windows = (await getSwayWindows(deps.exec)).get(id) ?? []
    if (!windows.length) return

    for (const w of windows) {
        deps.log(`${id} kill ${w.id} ${w.app_id} ${w.name}`)
        await swayCommand(deps.exec, `[con_id=${w.id}] kill`)
    }

    // kill only asks the window to close, and the caller goes on to use the empty slot.
    await waitFor(async () => !(await getSwayWindows(deps.exec)).get(id)?.length, `Windows not closed: ${id}`)
}

/**
 * A PNG of the whole output, the windows on it as they overlap.
 */
export const captureSlot = async ({exec}: Pick<ServerDeps, "exec">, id: string): Promise<Buffer> => {
    slotNumberOf(id)
    try {
        return await exec("grim", ["-o", id, "-"])
    } catch (error) {
        const {message} = error as Error
        throw new HttpError(/unknown output/.test(message) ? 404 : 500, `grim: ${message}`)
    }
}
