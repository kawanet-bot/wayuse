import type {WayuseClient} from "wayuse-client"
import type {Exec} from "../exec.ts"
import {HttpError} from "../http-error.ts"
import {type SwayNode, outputsOf, swaymsg, windowsOf} from "../sway/swaymsg.ts"

type Slot = WayuseClient.Slot

export interface SlotDeps {
    exec: Exec
    /** XDG_RUNTIME_DIR, where wayvnc-start.sh puts the control socket of each wayvnc. */
    runtimeDir: string
}

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
    const [outputs, tree] = await Promise.all([
        swaymsg<SwayNode[]>(deps.exec, ["-t", "get_outputs"]),
        swaymsg<SwayNode>(deps.exec, ["-t", "get_tree"]),
    ])
    const windows = windowsOf(tree)

    return Promise.all(outputsOf(outputs).map(async (output): Promise<Slot> => ({
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
 * A PNG of the whole output, the windows on it as they overlap.
 */
export const captureSlot = async ({exec}: SlotDeps, id: string): Promise<Buffer> => {
    slotNumberOf(id)
    try {
        return await exec("grim", ["-o", id, "-"])
    } catch (error) {
        const {message} = error as Error
        throw new HttpError(/unknown output/.test(message) ? 404 : 500, `grim: ${message}`)
    }
}
