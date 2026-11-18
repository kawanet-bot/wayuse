import assert from "node:assert/strict"
import {describe, it} from "node:test"
import {resolveConfig} from "../../build/config.ts"
import {HttpError} from "../http-error.ts"
import {checkTabId, resolveClickRequest, resolveOpenRequest} from "./chrome-request.ts"

const TITLE = "server/chrome/chrome-request.test.ts"

const status = (code: number, message: RegExp) => (error: unknown): boolean => error instanceof HttpError && error.status === code && message.test(error.message)

describe(TITLE, () => {
    const config = resolveConfig({screen: {width: 1920, height: 1080}}, "wayuse.config.ts")
    const slots = ["HEADLESS-1", "HEADLESS-2"]

    it("fills in the first slot, the configured size and the default context", () => {
        assert.deepEqual(resolveOpenRequest({url: "https://example.com/"}, config, slots), {
            url: "https://example.com/", slot: "HEADLESS-1", width: 1920, height: 1080, context: "default",
        })
    })

    it("keeps what is given", () => {
        const request = {url: "about:blank", slot: "HEADLESS-2", width: 1024, height: 768, context: "temporary"}
        assert.deepEqual(resolveOpenRequest(request, config, slots), request)
    })

    it("refuses a URL that is not http:, https: or about:", () => {
        for (const url of ["file:///etc/passwd", "javascript:alert(1)", "chrome://settings/", "example.com", "", undefined, 1]) {
            assert.throws(() => resolveOpenRequest({url}, config, slots), status(400, /^Invalid url/), String(url))
        }
        assert.throws(() => resolveOpenRequest(undefined, config, slots), status(400, /^Invalid url/))
    })

    it("refuses a width without a height, and a size out of range", () => {
        const url = "about:blank"
        assert.throws(() => resolveOpenRequest({url, width: 1280}, config, slots), status(400, /both width and height/))
        assert.throws(() => resolveOpenRequest({url, width: 767, height: 768}, config, slots), status(400, /^Invalid width: 767/))
        assert.throws(() => resolveOpenRequest({url, width: 1280, height: 2561}, config, slots), status(400, /^Invalid height: 2561/))
        assert.throws(() => resolveOpenRequest({url, width: "1280", height: 960}, config, slots), status(400, /^Invalid width/))
    })

    it("refuses an unknown context, and answers 503 while sway has no output", () => {
        assert.throws(() => resolveOpenRequest({url: "about:blank", context: "incognito"}, config, slots), status(400, /^Invalid context/))
        assert.throws(() => resolveOpenRequest({url: "about:blank"}, config, []), status(503, /no output/))
    })

    it("turns a button in bindsym's notation into CDP's button and modifier bits", () => {
        assert.deepEqual(resolveClickRequest({x: 10, y: 20}), {x: 10, y: 20, button: "left", buttons: 1, modifiers: 0})
        assert.deepEqual(resolveClickRequest({x: 0, y: 0, button: "ctrl+shift+button3"}), {x: 0, y: 0, button: "right", buttons: 2, modifiers: 10})
        assert.deepEqual(resolveClickRequest({x: 0, y: 0, button: "mod1+mod4+Button2"}), {x: 0, y: 0, button: "middle", buttons: 4, modifiers: 5})
    })

    it("refuses a click without whole coordinates, and a button CDP has none for", () => {
        for (const body of [undefined, {x: 1}, {x: -1, y: 0}, {x: 1.5, y: 0}, {x: "1", y: 0}]) {
            assert.throws(() => resolveClickRequest(body), status(400, /^Invalid [xy]/), JSON.stringify(body))
        }
        for (const button of ["button4", "button", "l", 1]) {
            assert.throws(() => resolveClickRequest({x: 0, y: 0, button}), status(400, /^Invalid button/), String(button))
        }
    })

    it("takes a tab id of CDP's shape alone", () => {
        const id = "0123456789ABCDEF0123456789ABCDEF"
        assert.equal(checkTabId(id), id)
        for (const bad of ["", "abc", id.toLowerCase(), `${id}0`, "../slot/HEADLESS-1"]) {
            assert.throws(() => checkTabId(bad), status(400, /^Invalid tab/), bad)
        }
    })
})
