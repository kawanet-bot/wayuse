import assert from "node:assert/strict"
import {describe, it} from "node:test"
import type {WayuseBuild} from "wayuse-build"
import {ConfigError, resolveConfig} from "./config.ts"

const TITLE = "build/config.test.ts"

describe(TITLE, () => {
    it("fills in every default", () => {
        const config = resolveConfig({})
        assert.match(config.wayuse.build.version, /^\d+\.\d+\.\d+/)
        assert.equal(config.node.version, process.versions.node)
        assert.deepEqual(config.apps, {})
        assert.equal(config.timezone, "Etc/UTC")
        assert.deepEqual(config.screen, {width: 1280, height: 960})
        assert.deepEqual(config.packages, [])
    })

    it("installs Chrome only when its key is present", () => {
        assert.deepEqual(resolveConfig({apps: {chrome: {}}}).apps, {chrome: {channel: "stable", env: {}}})
        assert.deepEqual(resolveConfig({apps: {}}).apps, {})
    })

    it("installs redir only when its key is present, with the ports as given", () => {
        const ports = {9223: "127.0.0.1:9222", 18081: "host.docker.internal:18081"}
        assert.deepEqual(resolveConfig({apps: {redir: {ports}}}).apps, {redir: {ports}})
    })

    it("keeps what is given", () => {
        const config = resolveConfig({
            node: {version: "24.11.1"},
            apps: {chrome: {channel: "beta", env: {LANGUAGE: "ja"}}},
            timezone: "Asia/Tokyo",
            screen: {width: 1920, height: 1080},
            packages: ["fonts-noto-cjk"],
        })
        assert.equal(config.node.version, "24.11.1")
        assert.deepEqual(config.apps.chrome, {channel: "beta", env: {LANGUAGE: "ja"}})
        assert.equal(config.timezone, "Asia/Tokyo")
        assert.deepEqual(config.screen, {width: 1920, height: 1080})
        assert.deepEqual(config.packages, ["fonts-noto-cjk"])
    })

    it("leaves out a package without a value", () => {
        const packages = ["curl", null, undefined, "git"] as string[]
        assert.deepEqual(resolveConfig({packages}).packages, ["curl", "git"])
    })

    // Each case is a value that would otherwise reach a Dockerfile or a shell script.
    const refused: [string, unknown][] = [
        ["a misspelled key", {timezome: "Asia/Tokyo"}],
        ["a version range", {node: {version: "^24"}}],
        ["a version with a prefix", {node: {version: "v24.11.1"}}],
        ["an unknown application", {apps: {firefox: {}}}],
        ["an unknown channel", {apps: {chrome: {channel: "canary"}}}],
        ["an environment name with a space", {apps: {chrome: {env: {"A B": "1"}}}}],
        ["an environment value that is not a string", {apps: {chrome: {env: {A: 1}}}}],
        ["redir without ports", {apps: {redir: {}}}],
        ["redir with no port", {apps: {redir: {ports: {}}}}],
        ["a redir port that is not a number", {apps: {redir: {ports: {cdp: "127.0.0.1:9222"}}}}],
        ["a redir port below 1024", {apps: {redir: {ports: {80: "127.0.0.1:8080"}}}}],
        ["a redir target with shell syntax", {apps: {redir: {ports: {9223: "127.0.0.1:9222; id"}}}}],
        ["a redir target with an option after it", {apps: {redir: {ports: {9223: "127.0.0.1:9222 -t 3"}}}}],
        ["a redir target that starts with a hyphen", {apps: {redir: {ports: {9223: "-t:3"}}}}],
        ["a redir target without a port", {apps: {redir: {ports: {9223: "127.0.0.1"}}}}],
        ["a redir target that is not a string", {apps: {redir: {ports: {9223: 9222}}}}],
        ["a time zone with shell syntax", {timezone: "Asia/Tokyo; rm -rf /"}],
        ["a time zone that climbs out of zoneinfo", {timezone: "../../etc/passwd"}],
        ["a package with shell syntax", {packages: ["curl && true"]}],
        ["packages that are not an array", {packages: "fonts-noto-cjk"}],
        ["a screen with a fraction", {screen: {width: 1280.5}}],
        ["a screen too large", {screen: {height: 100000}}],
    ]

    for (const [name, input] of refused) {
        it(`refuses ${name}`, () => {
            assert.throws(() => resolveConfig(input as WayuseBuild.Config), ConfigError)
        })
    }
})
