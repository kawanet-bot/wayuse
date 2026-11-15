import assert from "node:assert/strict"
import {describe, it} from "node:test"
import {resolveConfig} from "../builder/config.ts"
import {createApp} from "./app.ts"

const TITLE = "server/app.test.ts"

describe(TITLE, () => {
    const config = resolveConfig({apps: {chrome: {}}, screen: {width: 1920, height: 1080}})

    const run = async (path: string) => {
        const lines: string[] = []
        const app = createApp({config, stderr: {write: text => lines.push(text)}})
        const res = await app.request(path)
        return {res, lines}
    }

    it("answers /ok with an empty 200", async () => {
        const {res} = await run("/ok")
        assert.equal(res.status, 200)
        assert.equal(await res.text(), "")
    })

    it("returns the resolved configuration as the builder wrote it", async () => {
        const {res} = await run("/config")
        assert.equal(res.status, 200)
        assert.deepEqual(await res.json(), config)
    })

    it("logs one line per response, in morgan's tiny format", async () => {
        assert.match((await run("/ok")).lines.join(""), /^GET \/ok 200 0 - \d+\.\d+ ms\n$/)
        assert.match((await run("/config?q=1")).lines.join(""), /^GET \/config\?q=1 200 (\d+|-) - \d+\.\d+ ms\n$/)
        assert.match((await run("/missing")).lines.join(""), /^GET \/missing 404 (\d+|-) - \d+\.\d+ ms\n$/)
    })
})
