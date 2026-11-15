import assert from "node:assert/strict"
import {describe, it} from "node:test"
import type {WayuseBuilder} from "wayuse-builder"
import {ConfigError, resolveConfig} from "./config.ts"

const TITLE = "builder/config.test.ts"

describe(TITLE, () => {
    it("fills in every default", () => {
        const config = resolveConfig({})
        assert.match(config.builder.version, /^\d+\.\d+\.\d+/)
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

    // Each case is a value that would otherwise reach a Dockerfile or a shell script.
    const refused: [string, unknown][] = [
        ["a misspelled key", {timezome: "Asia/Tokyo"}],
        ["a version range", {node: {version: "^24"}}],
        ["a version with a prefix", {node: {version: "v24.11.1"}}],
        ["an unknown application", {apps: {firefox: {}}}],
        ["an unknown channel", {apps: {chrome: {channel: "canary"}}}],
        ["an environment name with a space", {apps: {chrome: {env: {"A B": "1"}}}}],
        ["an environment value that is not a string", {apps: {chrome: {env: {A: 1}}}}],
        ["a time zone with shell syntax", {timezone: "Asia/Tokyo; rm -rf /"}],
        ["a time zone that climbs out of zoneinfo", {timezone: "../../etc/passwd"}],
        ["a package with shell syntax", {packages: ["curl && true"]}],
        ["packages that are not an array", {packages: "fonts-noto-cjk"}],
        ["a screen with a fraction", {screen: {width: 1280.5}}],
        ["a screen too large", {screen: {height: 100000}}],
    ]

    for (const [name, input] of refused) {
        it(`refuses ${name}`, () => {
            assert.throws(() => resolveConfig(input as WayuseBuilder.Config), ConfigError)
        })
    }
})
