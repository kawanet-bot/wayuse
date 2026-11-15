import {writeFile} from "node:fs/promises"
import type {WayuseClient} from "wayuse-client"
import {createClient} from "../api/api-client.ts"
import {type CLIIO, UsageError} from "./cli-io.ts"

// The port wayuse-server listens on, published on the same host: what the sample container gives.
const DEFAULT_URL = "http://127.0.0.1:3000/"

const print = (io: CLIIO, value: unknown): void => {
    io.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

// A container has one screen unless it was given more, and then the command line need not name it.
const slotIdOf = async (client: WayuseClient.Client, id: string | undefined): Promise<string> => {
    if (id) return id
    const slots = await client.getSlots()
    if (slots.length !== 1) throw new UsageError(`a slot must be named: ${slots.map(slot => slot.id).join(", ")}`)
    return slots[0]!.id
}

/**
 * The commands that call the server, each printing what its API returns.
 */
export const runApi = async (positionals: string[], values: {output?: string}, io: CLIIO): Promise<void> => {
    const [group, command, id] = positionals
    const client = createClient({url: io.env.WAYUSE_URL || DEFAULT_URL, token: io.env.WAYUSE_JWT, fetch: io.fetch})

    if (group === "auth" && command === "me") return print(io, await client.getMe())

    if (group === "config" && command == null) return print(io, await client.getConfig())

    if (group === "slot" && command === "list") return print(io, await client.getSlots())

    if (group === "slot" && command === "show") return print(io, await client.getSlot(await slotIdOf(client, id)))

    if (group === "slot" && command === "capture") {
        const png = await client.captureSlot(await slotIdOf(client, id))
        if (values.output) return writeFile(values.output, png)
        io.stdout.write(png)
        return
    }

    throw new UsageError(group ? `unknown command: ${positionals.join(" ")}` : "")
}
