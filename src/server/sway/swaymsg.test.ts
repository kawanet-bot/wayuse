import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {describe, it} from "node:test"
import {HttpError} from "../http-error.ts"
import {type SwayNode, outputsOf, swaymsg, windowsOf} from "./swaymsg.ts"

const TITLE = "server/sway/swaymsg.test.ts"

const fixture = <T>(name: string): T => JSON.parse(readFileSync(new URL(`../../test-utils/fixtures/${name}`, import.meta.url), "utf8"))

describe(TITLE, () => {
    const tree = fixture<SwayNode>("sway-get_tree.json")
    const outputs = fixture<SwayNode[]>("sway-get_outputs.json")

    it("lists the outputs by number, though sway lists HEADLESS-2 first", () => {
        assert.deepEqual(outputs.map(output => output.name), ["HEADLESS-2", "HEADLESS-1"])
        assert.deepEqual(outputsOf(outputs), [
            {name: "HEADLESS-1", active: true, rect: {x: 0, y: 0, width: 1280, height: 960}, current_workspace: "2"},
            {name: "HEADLESS-2", active: true, rect: {x: 2432, y: 0, width: 1280, height: 960}, current_workspace: "1"},
        ])
    })

    it("sorts HEADLESS-10 after HEADLESS-9", () => {
        const names = ["HEADLESS-10", "HEADLESS-9", "HEADLESS-1"].map(name => ({...outputs[0]!, name}))
        assert.deepEqual(outputsOf(names).map(output => output.name), ["HEADLESS-1", "HEADLESS-9", "HEADLESS-10"])
    })

    it("finds each window under its output, floating ones among them", () => {
        const windows = windowsOf(tree)
        assert.deepEqual([...windows.keys()], ["HEADLESS-2"])
        const [chrome, ...rest] = windows.get("HEADLESS-2")!
        assert.equal(rest.length, 0)
        assert.equal(chrome!.app_id, "google-chrome")
        assert.equal(chrome!.name, "Example Domain - Google Chrome")
        assert.deepEqual(chrome!.rect, {x: 2563, y: 31, width: 1018, height: 898})
        assert.deepEqual(Object.keys(chrome!).sort(), ["app_id", "focused", "id", "marks", "name", "pid", "rect"])
    })

    it("asks swaymsg for raw JSON and parses it", async () => {
        const calls: string[] = []
        const got = await swaymsg<{ok: boolean}>(async (file, args) => {
            calls.push([file, ...args].join(" "))
            return Buffer.from(`{"ok": true}`)
        }, ["-t", "get_tree"])
        assert.deepEqual(got, {ok: true})
        assert.deepEqual(calls, ["swaymsg -r -t get_tree"])
    })

    it("answers 503 while sway cannot be reached", async () => {
        const failing = swaymsg(async () => {
            throw new Error("Unable to connect")
        }, ["-t", "get_tree"])
        await assert.rejects(failing, (error: unknown) => error instanceof HttpError && error.status === 503 && /Unable to connect/.test(error.message))
    })
})
