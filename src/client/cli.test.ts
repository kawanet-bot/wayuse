import assert from "node:assert/strict"
import {mkdtemp, readFile, rm} from "node:fs/promises"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {describe, it} from "node:test"
import {PNG_SIGNATURE, createFakeServer} from "../test-utils/fake-server.ts"
import type {Env} from "./cli-io.ts"
import {runCLI} from "./cli.ts"
import {publicKeyOf} from "./jwt-sign.ts"

const TITLE = "client/cli.test.ts"

describe(TITLE, () => {
    const server = createFakeServer()

    const run = async (args: string[], env: Env = {WAYUSE_JWT: server.jwt}) => {
        const out: (string | Uint8Array)[] = []
        const err: string[] = []
        const code = await runCLI(args, {env, stdout: {write: data => out.push(data)}, stderr: {write: data => err.push(data)}, fetch: server.fetch})
        return {code, out, stdout: out.join(""), stderr: err.join("")}
    }

    it("prints what an API returns as indented JSON", async () => {
        const {code, stdout} = await run(["slot", "list"])
        assert.equal(code, 0)
        assert.match(stdout, /^\[\n  \{\n    "id": "HEADLESS-1",/)
        assert.deepEqual(JSON.parse((await run(["config"])).stdout), server.config)
        assert.equal(JSON.parse((await run(["auth", "me"])).stdout).sub, "user@example.com")
        assert.equal(JSON.parse((await run(["slot", "show", "--slot", "HEADLESS-2"])).stdout).id, "HEADLESS-2")
    })

    it("writes a capture to the standard output as bytes, or to the file -o names", async () => {
        const {out} = await run(["slot", "capture", "--slot", "HEADLESS-1"])
        assert.deepEqual(Buffer.from(out[0] as Uint8Array), PNG_SIGNATURE)

        const dir = await mkdtemp(join(tmpdir(), "wayuse-"))
        try {
            const file = join(dir, "shot.png")
            const saved = await run(["slot", "capture", "--slot", "HEADLESS-1", "-o", file])
            assert.equal(saved.stdout, "")
            assert.deepEqual(await readFile(file), PNG_SIGNATURE)
        } finally {
            await rm(dir, {recursive: true, force: true})
        }
    })

    it("takes the first screen when no slot is named", async () => {
        assert.equal(JSON.parse((await run(["slot", "show"])).stdout).id, "HEADLESS-1")
        assert.deepEqual(Buffer.from((await run(["slot", "capture"])).out[0] as Uint8Array), PNG_SIGNATURE)
    })

    it("checks the arguments of a command before it calls the server", async () => {
        for (const args of [["chrome", "open"], ["chrome", "open", "about:blank", "--size", "1280"], ["chrome", "click", "10"], ["chrome", "click", "a", "b", "--tab", "x"], ["chrome", "eval", "--tab", "x"], ["slot", "click", "1"], ["slot", "key"], ["clipboard", "set"]]) {
            const {code, stderr} = await run(args)
            assert.equal(code, 2, args.join(" "))
            assert.match(stderr, /^(chrome \w+|slot \w+|clipboard set|--size) takes /, args.join(" "))
        }
    })

    it("reports the server's refusal in one line, with exit code 1", async () => {
        assert.deepEqual(await run(["slot", "list"], {}), {code: 1, out: [], stdout: "", stderr: "401 invalid token\n"})
        assert.equal((await run(["slot", "show", "--slot", "HEADLESS-9"])).stderr, "404 Slot not found: HEADLESS-9\n")
    })

    it("reports a server it cannot reach in one line, with exit code 1", async () => {
        const out: string[] = []
        const fetch = async (): Promise<Response> => {
            throw new TypeError("fetch failed", {cause: new Error("connect ECONNREFUSED 127.0.0.1:9580")})
        }
        const code = await runCLI(["slot", "list"], {env: {}, stdout: {write: () => undefined}, stderr: {write: data => out.push(data)}, fetch})
        assert.deepEqual({code, out}, {code: 1, out: ["connect ECONNREFUSED 127.0.0.1:9580\n"]})
    })

    it("ends wrong arguments in the reason, the usage and exit code 2", async () => {
        for (const args of [[], ["nosuch"], ["slot", "nosuch"], ["jwt", "nosuch"], ["jwt", "sign"], ["--nosuch"]]) {
            const {code, stdout, stderr} = await run(args)
            assert.equal(code, 2, args.join(" "))
            assert.equal(stdout, "")
            assert.match(stderr, /Usage: wayuse <command>/)
        }
    })

    it("makes a key pair and signs a token without reaching the server", async () => {
        const env: Env = Object.fromEntries((await run(["jwt", "keygen"], {})).stdout.trim().split("\n").map(line => line.split(/=(.*)/s).slice(0, 2)))
        assert.deepEqual(Object.keys(env), ["WAYUSE_JWT_PRIVATE_KEY", "WAYUSE_JWT_PUBLIC_KEY"])
        assert.equal(publicKeyOf(env.WAYUSE_JWT_PRIVATE_KEY!), env.WAYUSE_JWT_PUBLIC_KEY)
        assert.equal((await run(["jwt", "public-key"], env)).stdout, `WAYUSE_JWT_PUBLIC_KEY=${env.WAYUSE_JWT_PUBLIC_KEY}\n`)

        const jwt = (await run(["jwt", "sign", "--sub", "alice", "--claim", "admin", "--claim", "team=dev", "--claim", "aud=other"], env)).stdout.trim()
        const {iat, ...claims} = JSON.parse(Buffer.from(jwt.split(".")[1]!, "base64url").toString())
        assert.equal(typeof iat, "number")
        assert.deepEqual(claims, {admin: true, team: "dev", aud: "wayuse", sub: "alice"})
    })

    it("prints the usage and the version", async () => {
        assert.match((await run(["--help"])).stdout, /^Usage: wayuse <command>/)
        assert.match((await run(["-v"])).stdout, /^wayuse-client \d+\.\d+\.\d+\n$/)
    })
})
