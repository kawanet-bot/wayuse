import {writeFile} from "node:fs/promises"
import type {WayuseClient} from "wayuse-client"
import {createClient} from "../api/api-client.ts"
import {type CLIIO, UsageError} from "./cli-io.ts"

type Client = WayuseClient.Client

/** The options of the commands that call the server, as parseArgs gives them. */
export interface ApiValues {
    output?: string
    slot?: string
    size?: string
    context?: string
    add?: boolean
    tab?: string
    button?: string
}

// The port wayuse-server listens on, published on the same host: what the sample container gives.
const DEFAULT_URL = "http://127.0.0.1:3000/"

const print = (io: CLIIO, value: unknown): void => {
    io.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

// A capture is written as it is, to the file or else to the standard output for a pipe.
const save = (io: CLIIO, file: string | undefined, data: string | Uint8Array): Promise<void> | void =>
    (file ? writeFile(file, data) : void io.stdout.write(data))

// As the server does for a window it opens: without a name, the first screen.
const slotIdOf = async (client: Client, id: string | undefined): Promise<string> => {
    if (id) return id
    const first = (await client.getSlots())[0]
    if (!first) throw new UsageError("the server has no screen")
    return first.id
}

// Tabs have no order to pick a first by, so only a single one goes unnamed.
const tabIdOf = async (client: Client, id: string | undefined): Promise<string> => {
    if (id) return id
    const tabs = await client.getChromeTabs()
    if (tabs.length !== 1) throw new UsageError(`--tab must name one of ${tabs.length} tabs:${tabs.map(tab => `\n  ${tab.id} ${tab.target.url}`).join("")}`)
    return tabs[0]!.id
}

const sizeOf = (size: string | undefined): {width?: number, height?: number} => {
    if (size === undefined) return {}
    const [, width, height] = /^(\d+)x(\d+)$/.exec(size) ?? []
    if (!width || !height) throw new UsageError(`--size takes <width>x<height>: ${size}`)
    return {width: Number(width), height: Number(height)}
}

// Two whole numbers, as both click commands take a pixel.
const pointOf = (args: string[], usage: string): {x: number, y: number} => {
    const [x, y] = args.map(Number)
    if (args.length !== 2 || !Number.isInteger(x) || !Number.isInteger(y)) throw new UsageError(usage)
    return {x: x!, y: y!}
}

const runSlot = async (client: Client, command: string | undefined, args: string[], values: ApiValues, io: CLIIO): Promise<void> => {
    if (command === "list") return print(io, await client.getSlots())

    const id = () => slotIdOf(client, values.slot)
    if (command === "show") return print(io, await client.getSlot(await id()))
    if (command === "capture") return save(io, values.output, await client.captureSlot(await id()))
    if (command === "clear") return print(io, await client.clearSlot(await id()))
    if (command === "click") return print(io, await client.clickSlot(await id(), {...pointOf(args, "slot click takes <x> <y>"), button: values.button}))

    if (command === "key") {
        const [keys] = args
        if (!keys) throw new UsageError("slot key takes the keys as one argument")
        return print(io, await client.keySlot(await id(), keys))
    }

    throw new UsageError(`unknown command: slot ${command ?? ""}`)
}

const runClipboard = async (client: Client, command: string | undefined, args: string[], io: CLIIO): Promise<void> => {
    // The text itself rather than JSON: it is what a shell pipes on.
    if (command === "get") return void io.stdout.write(await client.getClipboard())

    if (command === "set") {
        const [text] = args
        if (text === undefined) throw new UsageError("clipboard set takes the text")
        return void await client.setClipboard(text)
    }

    throw new UsageError(`unknown command: clipboard ${command ?? ""}`)
}

const runChrome = async (client: Client, command: string | undefined, args: string[], values: ApiValues, io: CLIIO): Promise<void> => {
    if (command === "list") return print(io, await client.getChromeTabs())

    if (command === "open") {
        const [url] = args
        if (!url) throw new UsageError("chrome open takes a URL")
        const request = {url, slot: values.slot, ...sizeOf(values.size), context: values.context as WayuseClient.ChromeOpenRequest["context"]}
        return print(io, await (values.add ? client.addChromeTab(request) : client.openChromeTab(request)))
    }

    if (command === "show") return print(io, await client.getChromeTab(await tabIdOf(client, values.tab)))

    if (command === "close") return print(io, await client.closeChromeTab(await tabIdOf(client, values.tab)))

    if (command === "capture") {
        const {jpeg, videoGeometry} = await client.captureChromeTab(await tabIdOf(client, values.tab))
        // Beside the image rather than in it: the standard output may be the image itself.
        if (videoGeometry) io.stderr.write(`video: ${videoGeometry}\n`)
        return save(io, values.output, jpeg)
    }

    if (command === "html") return save(io, values.output, await client.captureChromeHtml(await tabIdOf(client, values.tab)))

    if (command === "click") {
        const point = pointOf(args, "chrome click takes <x> <y>")
        return print(io, await client.clickChromeTab(await tabIdOf(client, values.tab), {...point, button: values.button}))
    }

    if (command === "eval") {
        const [expression] = args
        if (!expression) throw new UsageError("chrome eval takes an expression")
        return print(io, await client.evaluateChromeTab(await tabIdOf(client, values.tab), expression))
    }

    throw new UsageError(`unknown command: chrome ${command ?? ""}`)
}

/**
 * The commands that call the server, each printing what its API returns.
 */
export const runApi = async (positionals: string[], values: ApiValues, io: CLIIO): Promise<void> => {
    const [group, command, ...args] = positionals
    const client = createClient({url: io.env.WAYUSE_URL || DEFAULT_URL, token: io.env.WAYUSE_JWT, fetch: io.fetch})

    if (group === "auth" && command === "me") return print(io, await client.getMe())
    if (group === "config" && command == null) return print(io, await client.getConfig())
    if (group === "status" && command == null) return print(io, await client.getStatus())
    if (group === "slot") return runSlot(client, command, args, values, io)
    if (group === "clipboard") return runClipboard(client, command, args, io)
    if (group === "chrome") return runChrome(client, command, args, values, io)

    throw new UsageError(group ? `unknown command: ${positionals.join(" ")}` : "")
}
