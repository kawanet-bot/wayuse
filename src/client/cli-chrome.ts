import type {WayuseClient} from "wayuse"
import {type ApiValues, type CLIIO, UsageError, pointOf, printJson, writeOutput} from "./cli-io.ts"

type Client = WayuseClient.Client

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

/**
 * The chrome commands, for an image that has Chrome.
 */
export const runChrome = async (client: Client, command: string | undefined, args: string[], values: ApiValues, io: CLIIO): Promise<void> => {
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
