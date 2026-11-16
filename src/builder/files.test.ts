import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {mkdtemp, readFile, rm, stat, writeFile} from "node:fs/promises"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {describe, it} from "node:test"
import {DEFAULT_URL} from "../client/cli-api.ts"
import {DEFAULT_PORT} from "../server/cli.ts"
import {resolveConfig} from "./config.ts"
import {generatedFilesOf, writeBuildDir} from "./files.ts"
import {APP_PACKAGES} from "./npm-package.ts"
import {shellEnvOf} from "./shell-env.ts"

const TITLE = "builder/files.test.ts"

describe(TITLE, () => {
    const config = resolveConfig({
        node: {version: "24.11.1"},
        apps: {chrome: {channel: "beta", env: {LANGUAGE: "ja"}}},
        timezone: "Asia/Tokyo",
        screen: {width: 1920, height: 1080},
        packages: ["fonts-noto-cjk"],
    })

    it("puts each setting where it takes effect", () => {
        const files = generatedFilesOf(config)
        const dockerfile = files["Dockerfile"]!
        assert.match(dockerfile, /node-v24\.11\.1-linux-/)
        assert.match(dockerfile, /google-chrome-beta_current_/)
        assert.match(dockerfile, /zoneinfo\/Asia\/Tokyo \/etc\/localtime/)
        assert.match(dockerfile, /\n {8}fonts-noto-cjk\n/)
        assert.match(dockerfile, /chrome-start\.sh","\/opt\/wayuse\/bin\/server-start\.sh"\]\n$/)
        assert.match(files["rootfs/etc/wayuse/sway/config"]!, /^output \* resolution 1920x1080$/m)
        assert.equal(files["rootfs/etc/wayuse/chrome.env"], "LANGUAGE='ja'\n")
        assert.deepEqual(JSON.parse(files["rootfs/etc/wayuse/wayuse.json"]!), config)
    })

    it("leaves Chrome out of an image without it, and what only Chrome needs", () => {
        const files = generatedFilesOf(resolveConfig({}))
        assert.doesNotMatch(files["Dockerfile"]!, /chrome/)
        assert.equal(files["rootfs/etc/wayuse/chrome.env"], undefined)
        assert.deepEqual(JSON.parse(files["rootfs/opt/wayuse/package.json"]!).dependencies, {"wayuse-server": "^0.0.0"})
    })

    // A missing backslash, or one after the last package, makes a Dockerfile that does not build.
    it("continues the line after every package but the last", () => {
        const dockerfile = generatedFilesOf(resolveConfig({packages: ["fonts-noto-cjk", "fonts-noto-core"]}))["Dockerfile"]!
        assert.match(dockerfile, /--no-install-recommends \\\n {8}fonts-noto-cjk \\\n {8}fonts-noto-core\n\n/)
    })

    it("installs redir and keeps it running, with a line for each port in a file of their own", () => {
        const files = generatedFilesOf(resolveConfig({apps: {redir: {ports: {9223: "127.0.0.1:9222", 18081: "host.docker.internal:18081"}}}}))
        const dockerfile = files["Dockerfile"]!
        assert.match(dockerfile, /\n {8}redir\n/)
        assert.match(dockerfile, /"\/opt\/wayuse\/bin\/redir-start\.sh","\/opt\/wayuse\/bin\/server-start\.sh"\]\n$/)
        assert.equal(files["rootfs/etc/wayuse/redir.conf"], "9223 127.0.0.1:9222\n18081 host.docker.internal:18081\n")
    })

    it("installs what the server needs for Chrome beside the server", () => {
        const files = generatedFilesOf(config, {serverTarball: "server.tgz"})
        assert.deepEqual(JSON.parse(files["rootfs/opt/wayuse/package.json"]!).dependencies, {"wayuse-server": "file:wayuse-server.tgz", "html-slim": "^0.5.0"})
    })

    // The builder does not depend on the server, so nothing but this test holds the two lists together.
    it("names for the applications exactly the server's optional peers, at the same ranges", () => {
        const server = JSON.parse(readFileSync(new URL("../../packages/wayuse-server/package.json", import.meta.url), "utf8"))
        assert.deepEqual(Object.assign({}, ...Object.values(APP_PACKAGES)), server.peerDependencies)
        assert.deepEqual(Object.keys(server.peerDependenciesMeta), Object.keys(server.peerDependencies))
        for (const meta of Object.values(server.peerDependenciesMeta)) assert.deepEqual(meta, {optional: true})
    })

    // The three packages do not depend on one another, so nothing but this test holds their port together.
    it("listens in the image on the port the server and the client take by default", () => {
        const port = String(DEFAULT_PORT)
        assert.equal(new URL(DEFAULT_URL).port, port)
        assert.equal(generatedFilesOf(config)["Dockerfile"]!.match(/^EXPOSE (\d+)$/m)?.[1], port)

        const start = readFileSync(new URL("../../packages/wayuse-build/assets/rootfs/opt/wayuse/bin/server-start.sh", import.meta.url), "utf8")
        assert.equal(start.match(/ --port=(\d+)$/m)?.[1], port)

        // The sample publishes the port under its own number, which is where the client's default looks.
        const sample = readFileSync(new URL("../../packages/wayuse-build/sample/docker-compose.yml", import.meta.url), "utf8")
        assert.equal(sample.match(/^ +- "\$\{WAYUSE_PUBLISH:-127\.0\.0\.1:(\d+)\}:(\d+)"$/m)?.slice(1).join(), `${port},${port}`)
    })

    // A settings-only change must rebuild nothing above the COPY.
    it("copies the settings after every install", () => {
        const dockerfile = generatedFilesOf(config)["Dockerfile"]!
        const copy = dockerfile.indexOf("COPY rootfs/")
        assert.ok(copy > dockerfile.lastIndexOf("apt-get install"))
    })

    it("quotes an environment value so that the shell runs none of it", () => {
        assert.equal(shellEnvOf({A: "it's $(date) `id`"}), "A='it'\\''s $(date) `id`'\n")
    })

    it("writes the build directory anew, the scripts executable", async () => {
        const outdir = await mkdtemp(join(tmpdir(), "wayuse-"))
        try {
            await writeFile(join(outdir, "stale"), "")
            await writeBuildDir(config, outdir)
            await assert.rejects(stat(join(outdir, "stale")))
            assert.match(await readFile(join(outdir, "Dockerfile"), "utf8"), /^# Generated by wayuse-build/)
            const script = await stat(join(outdir, "rootfs/opt/wayuse/bin/supervise.sh"))
            assert.equal(script.mode & 0o111, 0o111)

            // noVNC as one module for the vnc page, with the notices its license asks to keep.
            const novnc = await readFile(join(outdir, "rootfs/opt/wayuse/vendor/novnc.js"), "utf8")
            assert.match(novnc, /Licensed under MPL 2\.0/)
            assert.match(novnc, /export\s*\{\s*\w+ as default\s*\}/)

            // html-ele under the name the console's scripts import it by.
            const htmlEle = await readFile(join(outdir, "rootfs/opt/wayuse/vendor/html-ele.mjs"), "utf8")
            assert.match(htmlEle, /export\s*\{[^}]*\bELE\b[^}]*\}/)
        } finally {
            await rm(outdir, {recursive: true, force: true})
        }
    })
})
