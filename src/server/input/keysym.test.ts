import assert from "node:assert/strict"
import {describe, it} from "node:test"
import {HttpError} from "../http-error.ts"
import {keysOf, parseButton, parseKeySequence} from "./key-sequence.ts"
import {keysymFromModifier, keysymFromName, scancodeFromKeysym} from "./keysym.ts"

const TITLE = "server/input/keysym.test.ts"

const status = (code: number, message: RegExp) => (error: unknown): boolean => error instanceof HttpError && error.status === code && message.test(error.message)

describe(TITLE, () => {
    it("finds a keysym by its name, as written first and then without regard to case", () => {
        assert.equal(keysymFromName("Return"), 0xff0d)
        assert.equal(keysymFromName("return"), 0xff0d)
        assert.equal(keysymFromName("a"), 0x61)
        assert.equal(keysymFromName("A"), 0x41)
        assert.equal(keysymFromName("at"), 0x40)
        assert.equal(keysymFromName("F6"), 0xffc3)
    })

    it("takes a single character without a name as itself, or as its Unicode keysym", () => {
        assert.equal(keysymFromName("@"), 0x40)
        assert.equal(keysymFromName("é"), 0xe9)
        assert.equal(keysymFromName("あ"), 0x01000000 + 0x3042)
        assert.throws(() => keysymFromName("NoSuchKey"), status(400, /^Unknown keysym: NoSuchKey$/))
    })

    it("presses the modifiers by their left-hand keys", () => {
        assert.deepEqual((["shift", "ctrl", "mod1", "mod4"] as const).map(keysymFromModifier), [0xffe1, 0xffe3, 0xffe9, 0xffeb])
    })

    it("gives a place on the keyboard to letters, digits and the keys that type nothing, and none to a symbol", () => {
        assert.equal(scancodeFromKeysym(keysymFromName("a")), 0x1e)
        assert.equal(scancodeFromKeysym(keysymFromName("1")), 0x02)
        assert.equal(scancodeFromKeysym(keysymFromName("Return")), 0x1c)
        assert.equal(scancodeFromKeysym(keysymFromName("Control_L")), 0x1d)
        assert.equal(scancodeFromKeysym(keysymFromName("at")), undefined)
        assert.equal(scancodeFromKeysym(keysymFromName("A")), undefined)
    })

    it("sends a combination by place only when every key of it has one", () => {
        const ctrl = keysymFromModifier("ctrl")
        assert.deepEqual(keysOf([ctrl], keysymFromName("l")), [{keysym: 0xffe3, scancode: 0x1d}, {keysym: 0x6c, scancode: 0x26}])
        assert.deepEqual(keysOf([ctrl], keysymFromName("U")), [{keysym: 0xffe3}, {keysym: 0x55}])
    })

    it("reads a sequence of combinations and pauses", () => {
        assert.deepEqual(parseKeySequence(" ctrl+l ..  Return . "), [
            {keys: [{keysym: 0xffe3, scancode: 0x1d}, {keysym: 0x6c, scancode: 0x26}]},
            {wait: 200},
            {keys: [{keysym: 0xff0d, scancode: 0x1c}]},
            {keys: [{keysym: 0x2e, scancode: 0x34}]},
        ])
        assert.deepEqual(parseKeySequence(".........."), [{wait: 1000}])
    })

    it("refuses a sequence it cannot send, before any of it is sent", () => {
        assert.throws(() => parseKeySequence("a NoSuchKey"), status(400, /^Unknown keysym/))
        assert.throws(() => parseKeySequence("..........."), status(400, /^Too many dots: 11/))
        assert.throws(() => parseKeySequence("ctrl+.."), status(400, /^Wait with modifiers/))
        assert.throws(() => parseKeySequence(Array(11).fill("..........").join(" ")), status(400, /^Too long wait: 11000ms/))
        assert.throws(() => parseKeySequence("alt+a"), status(400, /^Unknown modifier: alt/))
    })

    it("reads a button as a bit of RFB's mask, with its modifiers", () => {
        assert.deepEqual(parseButton("button1"), {modifiers: [], mask: 1})
        assert.deepEqual(parseButton("ctrl+Button3"), {modifiers: [{keysym: 0xffe3, scancode: 0x1d}], mask: 4})
        assert.equal(parseButton("button8").mask, 128)
        for (const button of ["button9", "button0", "button", "l"]) {
            assert.throws(() => parseButton(button), status(400, /^Invalid button/), button)
        }
    })
})
