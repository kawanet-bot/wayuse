import assert from "node:assert/strict"
import {describe, it} from "node:test"
import {keyProblemOf} from "./cli.ts"

const TITLE = "server/cli.test.ts"

describe(TITLE, () => {
    it("starts where the key and the image agree", () => {
        assert.equal(keyProblemOf(true, "KEY"), undefined)
        assert.equal(keyProblemOf(false, undefined), undefined)
        assert.equal(keyProblemOf(false, ""), undefined)
    })

    it("does not start an image that checks no token with a key", () => {
        assert.match(keyProblemOf(false, "KEY")!, /^config\.auth is false, and WAYUSE_JWT_PUBLIC_KEY is set/)
    })

    // A configuration from before the item was there has none, and its image checks tokens.
    it("does not start an image that checks tokens without the key", () => {
        assert.match(keyProblemOf(true, undefined)!, /^WAYUSE_JWT_PUBLIC_KEY is not set/)
        assert.match(keyProblemOf(true, "")!, /^WAYUSE_JWT_PUBLIC_KEY is not set/)
        assert.match(keyProblemOf(undefined, undefined)!, /^WAYUSE_JWT_PUBLIC_KEY is not set/)
    })
})
