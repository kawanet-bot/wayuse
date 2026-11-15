import assert from "node:assert/strict"
import {describe, it} from "node:test"
import {createBrowserContexts} from "./browser-context.ts"
import type {CDP} from "./cdp.ts"
import {exceptionMessageOf} from "./chrome-evaluate.ts"
import {cascadeOffset} from "./chrome-open.ts"
import {chromeWindowMark} from "./chrome-tab.ts"
import {mainVideoOf, toGeometry} from "./page-video.ts"

const TITLE = "server/chrome/chrome-logic.test.ts"

// A Chrome reduced to what the contexts ask it: the contexts it has, and the pages in them.
const fakeChrome = (pages: {browserContextId: string}[]) => {
    const sent: string[] = []
    let made = 0
    const cdp: CDP = {
        send: async (method: string, params?: object) => {
            sent.push(`${method} ${JSON.stringify(params ?? {})}`)
            if (method === "Target.createBrowserContext") return {browserContextId: `CTX${++made}`}
            if (method === "Target.getTargets") return {targetInfos: pages.map(page => ({type: "page", ...page}))}
            if (method === "Target.getBrowserContexts") return {defaultBrowserContextId: "DEFAULT"}
            return {}
        },
        on: () => () => undefined,
        close: () => undefined,
    } as CDP
    return {cdp, sent}
}

describe(TITLE, () => {
    it("steps an added window down to the right, and back to the corner at the tenth", () => {
        assert.deepEqual([0, 1, 2, 9, 10, 11].map(cascadeOffset), [0, 44, 88, 396, 0, 44])
    })

    it("names a window's mark after CDP's windowId", () => {
        assert.equal(chromeWindowMark(123), "chrome-window-123")
    })

    it("writes a video's place in the capture's pixels, a negative offset with its sign", () => {
        const video = {x: 16.4, y: -427.2, width: 880.9, height: 495.5, visibleArea: 0}
        assert.equal(toGeometry(video, 1), "880x495+16-427")
        assert.equal(toGeometry(video, 2), "1761x991+33-854")
        assert.equal(toGeometry({...video, x: -0.2, y: 0}, 1), "880x495+0+0")
    })

    it("picks the video most in view, and the larger of two equally in view", () => {
        const hidden = {x: 0, y: -900, width: 1280, height: 720, visibleArea: 0}
        const shown = {x: 0, y: 0, width: 640, height: 360, visibleArea: 230400}
        const small = {x: 0, y: 0, width: 320, height: 180, visibleArea: 0}
        assert.equal(mainVideoOf([hidden, shown]), shown)
        assert.equal(mainVideoOf([small, hidden]), hidden)
        assert.equal(mainVideoOf([]), undefined)
    })

    it("words an exception of the page in one line, without saying its first line twice", () => {
        assert.equal(exceptionMessageOf({text: "Uncaught", exception: {description: "TypeError: x is not a function\n    at <anonymous>:1:1"}}), "Uncaught TypeError: x is not a function\n    at <anonymous>:1:1")
        assert.equal(exceptionMessageOf({text: "Uncaught (in promise) Error: no", exception: {description: "Error: no\n    at f"}}), "Uncaught (in promise) Error: no\n    at f")
        assert.equal(exceptionMessageOf({text: "Uncaught", exception: {value: "a string"}}), `Uncaught "a string"`)
        assert.equal(exceptionMessageOf({text: "Uncaught"}), "Uncaught")
    })

    it("tells the default context, one it made, and any other", async () => {
        const {cdp} = fakeChrome([])
        const contexts = createBrowserContexts(() => undefined)
        const made = await contexts.create(cdp)
        const kindOf = await contexts.kindOf(cdp)
        assert.deepEqual(["DEFAULT", made, "INCOGNITO"].map(kindOf), ["default", "temporary", "other"])
    })

    it("disposes a temporary context left without a tab, and none that still has one or is still opening", async () => {
        const pages: {browserContextId: string}[] = []
        const {cdp, sent} = fakeChrome(pages)
        const contexts = createBrowserContexts(() => undefined)
        const disposed = () => sent.filter(line => line.startsWith("Target.disposeBrowserContext"))

        const used = await contexts.create(cdp)
        const empty = await contexts.create(cdp)
        const opening = await contexts.create(cdp)
        pages.push({browserContextId: used})
        contexts.opened(used)
        contexts.opened(empty)

        await contexts.sweep(cdp)
        assert.deepEqual(disposed(), [`Target.disposeBrowserContext {"browserContextId":"${empty}"}`])
        assert.deepEqual([used, empty, opening].map(await contexts.kindOf(cdp)), ["temporary", "other", "temporary"])

        await contexts.sweep(cdp)
        assert.equal(disposed().length, 1)
    })
})
