import assert from "node:assert/strict"
import {describe, it} from "node:test"
import {resolveConfig} from "../builder/config.ts"
import {generateKeyPair, signJwt} from "../client/jwt-sign.ts"
import {createApp} from "./app.ts"
import {type AuthOptions, parsePublicKey} from "./jwt-verify.ts"

const TITLE = "server/app.test.ts"

describe(TITLE, () => {
    const config = resolveConfig({apps: {chrome: {}}, screen: {width: 1920, height: 1080}})
    const pair = generateKeyPair()
    const auth: AuthOptions = {publicKey: parsePublicKey(pair.publicKey), audience: "wayuse"}
    const keyless: AuthOptions = {audience: "wayuse"}
    const jwt = signJwt({aud: "wayuse", sub: "user@example.com", iat: 1, admin: true}, pair.privateKey)
    const bearer = {authorization: `Bearer ${jwt}`}

    const run = async (path: string, headers: Record<string, string> = {}, options: AuthOptions = auth) => {
        const lines: string[] = []
        const app = createApp({config, stderr: {write: text => lines.push(text)}, auth: options})
        const res = await app.request(path, {headers})
        return {res, lines}
    }

    it("answers /ok with an empty 200, token or not", async () => {
        const {res} = await run("/ok")
        assert.equal(res.status, 200)
        assert.equal(await res.text(), "")
    })

    it("returns the resolved configuration as the builder wrote it", async () => {
        const {res} = await run("/config", bearer)
        assert.equal(res.status, 200)
        assert.deepEqual(await res.json(), config)
    })

    it("returns the token's claims, the ones it does not read among them", async () => {
        const {res} = await run("/auth/me", bearer)
        assert.deepEqual(await res.json(), {me: {aud: "wayuse", sub: "user@example.com", iat: 1, admin: true}})
    })

    it("refuses a request without a valid token", async () => {
        const cases: Record<string, string>[] = [{}, {authorization: "Bearer x.y.z"}, {authorization: jwt}]
        for (const headers of cases) {
            const {res} = await run("/config", headers)
            assert.equal(res.status, 403)
            assert.deepEqual(await res.json(), {error: {message: "invalid token"}})
        }
    })

    it("refuses every token while it has no public key", async () => {
        assert.equal((await run("/config", bearer, keyless)).res.status, 403)
        assert.equal((await run("/ok", {}, keyless)).res.status, 200)
    })

    it("logs one line per response, in morgan's tiny format", async () => {
        assert.match((await run("/ok")).lines.join(""), /^GET \/ok 200 0 - \d+\.\d+ ms\n$/)
        assert.match((await run("/config?q=1", bearer)).lines.join(""), /^GET \/config\?q=1 200 (\d+|-) - \d+\.\d+ ms\n$/)
        assert.match((await run("/config")).lines.join(""), /^GET \/config 403 (\d+|-) - \d+\.\d+ ms\n$/)
        assert.match((await run("/missing")).lines.join(""), /^GET \/missing 404 (\d+|-) - \d+\.\d+ ms\n$/)
    })
})
