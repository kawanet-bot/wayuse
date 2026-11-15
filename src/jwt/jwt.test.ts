import assert from "node:assert/strict"
import {generateKeyPairSync, sign} from "node:crypto"
import {describe, it} from "node:test"
import {generateKeyPair, publicKeyOf, signJwt} from "../client/jwt-sign.ts"
import {parsePublicKey, verifyJwt} from "../server/jwt-verify.ts"

const TITLE = "jwt/jwt.test.ts"

const b64 = (data: string | Buffer) => Buffer.from(data).toString("base64url")

// The signer and the verifier ship in different packages, so they are held against each other here.
describe(TITLE, () => {
    const pair = generateKeyPair()
    const other = generateKeyPair()
    const auth = {publicKey: parsePublicKey(pair.publicKey), audience: "wayuse"}
    const claims = {aud: "wayuse", sub: "user@example.com", iat: 1, admin: true}

    it("verifies what the client signed, and returns its claims", () => {
        assert.deepEqual(verifyJwt(signJwt(claims, pair.privateKey), auth), claims)
    })

    it("stamps iat when it is not given, and leaves an undefined claim out", () => {
        const got = verifyJwt(signJwt({aud: "wayuse", sub: "a", guest: undefined}, pair.privateKey), auth)!
        assert.ok(Math.abs(got.iat - Date.now() / 1000) < 5)
        assert.deepEqual(Object.keys(got).sort(), ["aud", "iat", "sub"])
    })

    it("derives the public key from the private key", () => {
        assert.equal(publicKeyOf(pair.privateKey), pair.publicKey)
        assert.notEqual(pair.publicKey, other.publicKey)
    })

    it("refuses a payload changed after signing", () => {
        const [header, , signature] = signJwt(claims, pair.privateKey).split(".")
        const forged = b64(JSON.stringify({...claims, sub: "other@example.com"}))
        assert.equal(verifyJwt(`${header}.${forged}.${signature}`, auth), undefined)
    })

    it("refuses a token signed with another key", () => {
        assert.equal(verifyJwt(signJwt(claims, other.privateKey), auth), undefined)
    })

    it("refuses another audience, and a missing subject", () => {
        assert.equal(verifyJwt(signJwt({...claims, aud: "front"}, pair.privateKey), auth), undefined)
        assert.equal(verifyJwt(signJwt({...claims, sub: ""}, pair.privateKey), auth), undefined)
    })

    it("refuses any header but its own, `alg: none` among them", () => {
        const [, payload] = signJwt(claims, pair.privateKey).split(".")
        assert.equal(verifyJwt(`${b64(JSON.stringify({alg: "none"}))}.${payload}.`, auth), undefined)
        assert.equal(verifyJwt(`${b64(JSON.stringify({typ: "JWT", alg: "EdDSA"}))}.${payload}.x`, auth), undefined)
    })

    it("refuses a token with too many or too few parts", () => {
        assert.equal(verifyJwt(signJwt(claims, pair.privateKey) + ".x", auth), undefined)
        assert.equal(verifyJwt("abc", auth), undefined)
    })

    it("honors exp when a token has one", () => {
        const jwt = signJwt({...claims, exp: 1000}, pair.privateKey)
        assert.equal(verifyJwt(jwt, auth, 999_000)?.exp, 1000)
        assert.equal(verifyJwt(jwt, auth, 1000_000), undefined)
        assert.equal(verifyJwt(signJwt({...claims, exp: "never"}, pair.privateKey), auth), undefined)
    })

    it("refuses every token while it has no public key", () => {
        assert.equal(verifyJwt(signJwt(claims, pair.privateKey), {audience: "wayuse"}), undefined)
    })

    // A key of another type would make verify() pick another algorithm without a word.
    it("takes Ed25519 keys alone", () => {
        const rsa = generateKeyPairSync("rsa", {modulusLength: 2048})
        assert.throws(() => parsePublicKey(rsa.publicKey.export({format: "der", type: "spki"}).toString("base64")), /Ed25519/)
        assert.throws(() => signJwt(claims, rsa.privateKey.export({format: "der", type: "pkcs8"}).toString("base64")), /Ed25519/)
    })

    it("refuses a signed payload that is not JSON", () => {
        const input = `${b64(JSON.stringify({alg: "EdDSA", typ: "JWT"}))}.${b64("not json")}`
        const key = generateKeyPairSync("ed25519")
        const signature = b64(sign(null, Buffer.from(input), key.privateKey))
        assert.equal(verifyJwt(`${input}.${signature}`, {publicKey: key.publicKey, audience: "wayuse"}), undefined)
    })
})
