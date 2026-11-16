import assert from "node:assert/strict"
import {describe, it} from "node:test"
import {ApiError} from "../api/api-client.ts"
import {basePathOf, buttonOf, failureOf, hashParams, imagePixelOf, isRefusal, loadLineOf, signInUrlOf, tokenOfHash} from "./console-util.ts"

const TITLE = "console/console-util.test.ts"

describe(TITLE, () => {
    it("finds the server's root ahead of console/, with a reverse proxy's prefix", () => {
        assert.equal(basePathOf("/console/"), "/")
        assert.equal(basePathOf("/console/monitor/"), "/")
        assert.equal(basePathOf("/console/vnc/index.html"), "/")
        assert.equal(basePathOf("/some/prefix/console/api/"), "/some/prefix/")
    })

    it("reads the parameters of a hash that starts with #!?, and none of any other", () => {
        assert.equal(hashParams("#!?slot=HEADLESS-2").get("slot"), "HEADLESS-2")
        assert.equal(hashParams("#!?slot=HEADLESS-2&x=1").get("x"), "1")
        for (const hash of ["#slot=HEADLESS-2", "#?slot=HEADLESS-2", "#!slot=HEADLESS-2", "#section", ""]) {
            assert.equal([...hashParams(hash)].length, 0, hash)
        }
    })

    // The "#" has to be escaped, or the browser would take what follows it as the hash of the sign-in address.
    it("adds to the sign-in address where the token is to be brought back", () => {
        const url = signInUrlOf("/front/screen-sign-in/?next=", "/screen/tokyo-1/console/")
        assert.equal(url, "/front/screen-sign-in/?next=%2Fscreen%2Ftokyo-1%2Fconsole%2F%23!%3Fjwt%3D")
        assert.equal(new URL(url, "https://example.com/").searchParams.get("next") + "JWT", "/screen/tokyo-1/console/#!?jwt=JWT")
    })

    // A token is shared by every server under one origin, and one that is down must not take it away.
    it("takes the server's own 401 alone as a refusal of the token", () => {
        assert.equal(isRefusal(new ApiError(401, "invalid token")), true)
        assert.equal(isRefusal(new ApiError(502, "Bad Gateway")), false)
        assert.equal(isRefusal(new ApiError(403, "Forbidden")), false)
        assert.equal(isRefusal(new TypeError("fetch failed")), false)
        assert.equal(isRefusal(undefined), false)
    })

    it("names a failure by its status, or by its own words when it has none", () => {
        assert.equal(failureOf(new ApiError(502, "Bad Gateway")), "502")
        assert.equal(failureOf(new TypeError("fetch failed")), "fetch failed")
        assert.equal(failureOf("plain"), "plain")
    })

    it("reads a token from a login link's fragment", () => {
        assert.equal(tokenOfHash("#!?jwt=a.b.c"), "a.b.c")
        assert.equal(tokenOfHash("#jwt=a.b.c"), undefined)
        assert.equal(tokenOfHash("#!?slot=HEADLESS-1"), undefined)
        assert.equal(tokenOfHash(""), undefined)
    })

    it("writes a click with its modifier keys as sway's bindsym does", () => {
        const none = {shiftKey: false, ctrlKey: false, altKey: false, metaKey: false}
        assert.equal(buttonOf(none), "button1")
        assert.equal(buttonOf({...none, ctrlKey: true}), "ctrl+button1")
        assert.equal(buttonOf({shiftKey: true, ctrlKey: true, altKey: true, metaKey: true}), "shift+ctrl+mod1+mod4+button1")
    })

    it("maps a click on a picture shown at half size to the picture's own pixel", () => {
        const image = {naturalWidth: 1280, naturalHeight: 960, clientWidth: 640, clientHeight: 480}
        assert.deepEqual(imagePixelOf(image, 0, 0), {x: 0, y: 0})
        assert.deepEqual(imagePixelOf(image, 320, 240), {x: 640, y: 480})
        assert.deepEqual(imagePixelOf(image, 640, 480), {x: 1279, y: 959})
    })

    it("puts the host's load in one line, and 0% for a host without swap", () => {
        const os = {machine: "aarch64", hostname: "host", loadavg: [1.8, 1, 1], uptime: 1, availableParallelism: 4}
        const meminfo = {MemTotal: 8000, MemFree: 100, MemAvailable: 1600, SwapCached: 0, SwapTotal: 4000, SwapFree: 1000}
        assert.equal(loadLineOf({os, meminfo}), "CPU 45% Memory 80% Swap 75%")
        assert.equal(loadLineOf({os, meminfo: {...meminfo, SwapTotal: 0, SwapFree: 0}}), "CPU 45% Memory 80% Swap 0%")
    })
})
