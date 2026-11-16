import assert from "node:assert/strict"
import {describe, it} from "node:test"
import {resolveConfig} from "../build/config.ts"
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
        const app = await createApp({
            config, stderr: {write: text => lines.push(text)}, auth: options, runtimeDir: "/run/test", exec: async () => {
                throw new Error("no command is expected to run")
            },
        })
        const res = await app.request(path, {headers})
        return {res, lines}
    }

    it("answers /ok with an empty 200, token or not", async () => {
        const {res} = await run("/ok")
        assert.equal(res.status, 200)
        assert.equal(await res.text(), "")
    })

    it("returns the resolved configuration as wayuse-build wrote it", async () => {
        const {res} = await run("/wayuse/config", bearer)
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
            const {res} = await run("/wayuse/config", headers)
            assert.equal(res.status, 401)
            assert.equal(res.headers.get("www-authenticate"), "Bearer")
            assert.deepEqual(await res.json(), {error: {message: "invalid token"}})
        }
    })

    // Which paths exist is not told to a caller without a token.
    it("refuses every path but /ok without a token, one that does not exist among them", async () => {
        for (const path of ["/slot/", "/slot/HEADLESS-1", "/slot/HEADLESS-1/capture.png", "/auth/me", "/missing"]) {
            assert.equal((await run(path)).res.status, 401, path)
        }
        const missing = (await run("/missing", bearer)).res
        assert.equal(missing.status, 404)
        assert.deepEqual(await missing.json(), {error: {message: "Not Found"}})
    })

    it("refuses every token while it has no public key", async () => {
        assert.equal((await run("/wayuse/config", bearer, keyless)).res.status, 401)
        assert.equal((await run("/ok", {}, keyless)).res.status, 200)
    })

    it("logs one line per response, in morgan's tiny format", async () => {
        assert.match((await run("/ok")).lines.join(""), /^GET \/ok 200 0 - \d+\.\d+ ms\n$/)
        assert.match((await run("/wayuse/config?q=1", bearer)).lines.join(""), /^GET \/wayuse\/config\?q=1 200 (\d+|-) - \d+\.\d+ ms\n$/)
        assert.match((await run("/wayuse/config")).lines.join(""), /^GET \/wayuse\/config 401 (\d+|-) - \d+\.\d+ ms\n$/)
        assert.match((await run("/missing", bearer)).lines.join(""), /^GET \/missing 404 (\d+|-) - \d+\.\d+ ms\n$/)
    })

    it("answers a command that failed with a 500 and its words", async () => {
        const {res, lines} = await run("/slot/HEADLESS-1/capture.png", bearer)
        assert.equal(res.status, 500)
        assert.deepEqual(await res.json(), {error: {message: "grim: no command is expected to run"}})
        assert.equal(lines.length, 1)
    })
})
