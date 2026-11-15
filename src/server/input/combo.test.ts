import assert from "node:assert/strict"
import {describe, it} from "node:test"
import {HttpError} from "../http-error.ts"
import {parseCombo} from "./combo.ts"

const TITLE = "server/input/combo.test.ts"

describe(TITLE, () => {
    it("splits bindsym's notation into the modifiers and the rest", () => {
        assert.deepEqual(parseCombo("button1"), {modifiers: [], key: "button1"})
        assert.deepEqual(parseCombo("ctrl+l"), {modifiers: ["ctrl"], key: "l"})
        assert.deepEqual(parseCombo("ctrl+shift+u"), {modifiers: ["ctrl", "shift"], key: "u"})
    })

    it("takes the modifiers in any case, and Control for ctrl", () => {
        assert.deepEqual(parseCombo("Control+Mod1+Mod4+Shift+Return"), {modifiers: ["ctrl", "mod1", "mod4", "shift"], key: "Return"})
    })

    it("refuses an unknown modifier and a missing key with a 400", () => {
        for (const combo of ["alt+l", "ctrl+", "", "ctrl++"]) {
            assert.throws(() => parseCombo(combo), (error: unknown) => error instanceof HttpError && error.status === 400, combo)
        }
    })
})
