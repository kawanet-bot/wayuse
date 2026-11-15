import type {WayuseClient} from "wayuse-client"
import type {Exec} from "../exec.ts"
import {HttpError} from "../http-error.ts"

type Output = WayuseClient.SwayOutput
type Window = WayuseClient.SwayWindow

/** The items this server reads from `swaymsg -t get_tree` and `get_outputs`. */
export interface SwayNode extends Output {
    id: number
    type: string
    marks: string[]
    focused: boolean
    nodes?: SwayNode[]
    floating_nodes?: SwayNode[]
    /** A window has a pid, and nothing else does. */
    pid?: number
    app_id?: string
}

/**
 * Asks sway over the socket in SWAYSOCK, which the image fixes for every process.
 */
export const swaymsg = async <T>(exec: Exec, args: string[]): Promise<T> => {
    let stdout: Buffer
    try {
        stdout = await exec("swaymsg", ["-r", ...args])
    } catch (error) {
        // sway is started again by the supervisor, so the client may try again.
        throw new HttpError(503, `sway: ${(error as Error).message}`)
    }
    return JSON.parse(stdout.toString())
}

/**
 * The windows of each output, by the output's name.
 */
export const windowsOf = (tree: SwayNode): Map<string, Window[]> => {
    const map = new Map<string, Window[]>()

    const walk = (node: SwayNode, output: string | undefined): void => {
        if (node.type === "output") output = node.name
        if (node.pid != null && output != null) {
            const {id, app_id = "", pid, name, marks, focused, rect} = node
            const list = map.get(output) ?? []
            map.set(output, list)
            list.push({id, app_id, pid, name, marks, focused, rect})
        }
        node.nodes?.forEach(child => walk(child, output))
        node.floating_nodes?.forEach(child => walk(child, output))
    }
    walk(tree, undefined)

    return map
}

/**
 * The outputs in the order of their numbers, whatever order sway lists them in.
 */
export const outputsOf = (nodes: SwayNode[]): Output[] => nodes
    .map(({name, active, rect, current_workspace}) => ({name, active, rect, current_workspace}))
    .sort((a, b) => a.name.localeCompare(b.name, "en", {numeric: true}))
