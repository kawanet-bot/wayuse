import type {WayuseClient} from "wayuse-client"
import {createClient} from "../api/api-client.ts"
import {type ApiValues, type CLIIO, UsageError, pointOf, printJson, writeOutput} from "./cli-io.ts"

type Client = WayuseClient.Client

// The port wayuse-server listens on, published on the same host: what the sample container gives.
export const DEFAULT_URL = "http://127.0.0.1:9580/"

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
    if (size == null) return {}
    const [, width, height] = /^(\d+)x(\d+)$/.exec(size) ?? []
    if (!width || !height) throw new UsageError(`--size takes <width>x<height>: ${size}`)
    return {width: Number(width), height: Number(height)}
}

const runSlot = async (client: Client, command: string | undefined, args: string[], values: ApiValues, io: CLIIO): Promise<void> => {
    if (command === "list") return printJson(io, await client.getSlots())

    const id = () => slotIdOf(client, values.slot)
    if (command === "show") return printJson(io, await client.getSlot(await id()))
    if (command === "capture") return writeOutput(io, values.output, await client.captureSlot(await id()))
    if (command === "clear") return printJson(io, await client.clearSlot(await id()))
    if (command === "click") return printJson(io, await client.clickSlot(await id(), {...pointOf(args, "slot click takes <x> <y>"), button: values.button}))

    if (command === "vnc") return printJson(io, await client.createVncTicket(await id()))

    if (command === "key") {
        const [keys] = args
        if (!keys) throw new UsageError("slot key takes the keys as one argument")
        return printJson(io, await client.keySlot(await id(), keys))
    }

    throw new UsageError(`unknown command: slot ${command ?? ""}`)
}

const runClipboard = async (client: Client, command: string | undefined, args: string[], io: CLIIO): Promise<void> => {
    // The text itself rather than JSON: it is what a shell pipes on.
    if (command === "get") return void io.stdout.write(await client.getClipboard())

    if (command === "set") {
        const [text] = args
        if (text == null) throw new UsageError("clipboard set takes the text")
        return void await client.setClipboard(text)
    }

    throw new UsageError(`unknown command: clipboard ${command ?? ""}`)
}

const runChrome = async (client: Client, command: string | undefined, args: string[], values: ApiValues, io: CLIIO): Promise<void> => {
    if (command === "list") return printJson(io, await client.getChromeTabs())

    if (command === "open") {
        const [url] = args
        if (!url) throw new UsageError("chrome open takes a URL")
        const request = {url, slot: values.slot, ...sizeOf(values.size), context: values.context as WayuseClient.ChromeOpenRequest["context"]}
        return printJson(io, await (values.add ? client.addChromeTab(request) : client.openChromeTab(request)))
    }

    if (command === "show") return printJson(io, await client.getChromeTab(await tabIdOf(client, values.tab)))

    if (command === "close") return printJson(io, await client.closeChromeTab(await tabIdOf(client, values.tab)))

    if (command === "capture") {
        const {jpeg, videoGeometry} = await client.captureChromeTab(await tabIdOf(client, values.tab))
        // Beside the image rather than in it: the standard output may be the image itself.
        if (videoGeometry) io.stderr.write(`video: ${videoGeometry}\n`)
        return writeOutput(io, values.output, jpeg)
    }

    if (command === "html") return writeOutput(io, values.output, await client.captureChromeHtml(await tabIdOf(client, values.tab)))

    if (command === "click") {
        const point = pointOf(args, "chrome click takes <x> <y>")
        return printJson(io, await client.clickChromeTab(await tabIdOf(client, values.tab), {...point, button: values.button}))
    }

    if (command === "eval") {
        const [expression] = args
        if (!expression) throw new UsageError("chrome eval takes an expression")
        return printJson(io, await client.evaluateChromeTab(await tabIdOf(client, values.tab), expression))
    }

    throw new UsageError(`unknown command: chrome ${command ?? ""}`)
}

/**
 * The commands that call the server, each printing what its API returns.
 */
export const runApi = async (positionals: string[], values: ApiValues, io: CLIIO): Promise<void> => {
    const [group, command, ...args] = positionals
    const client = createClient({url: io.env.WAYUSE_URL || DEFAULT_URL, token: io.env.WAYUSE_JWT, fetch: io.fetch})

    if (group === "auth" && command === "me") return printJson(io, await client.getMe())
    if (group === "config" && command == null) return printJson(io, await client.getConfig())
    if (group === "status" && command == null) return printJson(io, await client.getStatus())
    if (group === "slot") return runSlot(client, command, args, values, io)
    if (group === "clipboard") return runClipboard(client, command, args, io)
    if (group === "chrome") return runChrome(client, command, args, values, io)

    throw new UsageError(group ? `unknown command: ${positionals.join(" ")}` : "")
}
