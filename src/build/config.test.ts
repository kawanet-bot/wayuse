import type {WayuseBuild} from "@wayuse/build"
import assert from "node:assert/strict"
import {describe, it} from "node:test"
import {ConfigError, DEFAULT_POLICIES, consoleTerserOf, consoleVarsOf, outputDirOf, resolveConfig} from "./config.ts"

const TITLE = "build/config.test.ts"

describe(TITLE, () => {
    it("fills in every default", () => {
        const config = resolveConfig({}, "wayuse.config.ts")
        assert.match(config.wayuse.build.version, /^\d+\.\d+\.\d+/)
        assert.equal(config.node.version, process.versions.node)
        assert.deepEqual(config.apps, {})
        assert.equal(config.timezone, "Etc/UTC")
        assert.deepEqual(config.screen, {width: 1280, height: 960})
        assert.deepEqual(config.packages, [])
        assert.equal(config.auth, true)
        assert.deepEqual(config.console, {})
    })

    it("keeps the file name of the configuration", () => {
        assert.equal(resolveConfig({}, "chrome.config.ts").wayuse.build.config, "chrome.config.ts")
    })

    it("installs Chrome only when its key is present", () => {
        assert.deepEqual(resolveConfig({apps: {chrome: {}}}, "wayuse.config.ts").apps, {chrome: {channel: "stable", env: {}, policies: DEFAULT_POLICIES}})
        assert.deepEqual(resolveConfig({apps: {}}, "wayuse.config.ts").apps, {})
    })

    it("installs redir only when its key is present, with the ports as given", () => {
        const ports = {9223: "127.0.0.1:9222", 18081: "host.docker.internal:18081"}
        assert.deepEqual(resolveConfig({apps: {redir: {ports}}}, "wayuse.config.ts").apps, {redir: {ports}})
    })

    it("keeps what is given", () => {
        const config = resolveConfig({
            node: {version: "24.11.1"},
            apps: {chrome: {channel: "beta", env: {LANGUAGE: "ja"}, policies: {AutoplayAllowlist: ["https://www.youtube.com"]}}},
            timezone: "Asia/Tokyo",
            screen: {width: 1920, height: 1080},
            packages: ["fonts-noto-cjk"],
            console: {signIn: "../../sign-in/?next=", vars: {title: "my-wayuse"}},
        }, "wayuse.config.ts")
        assert.equal(config.node.version, "24.11.1")
        // The policies given are all there is: the defaults are not kept beside them.
        assert.deepEqual(config.apps.chrome, {channel: "beta", env: {LANGUAGE: "ja"}, policies: {AutoplayAllowlist: ["https://www.youtube.com"]}})
        assert.equal(config.timezone, "Asia/Tokyo")
        assert.deepEqual(config.screen, {width: 1920, height: 1080})
        assert.deepEqual(config.packages, ["fonts-noto-cjk"])
        // The values of vars go into the pages alone. The server would show this object to a client.
        assert.deepEqual(config.console, {signIn: "../../sign-in/?next="})
    })

    it("gives Chrome no policy for an empty object, and the defaults for no value", () => {
        assert.deepEqual(resolveConfig({apps: {chrome: {policies: {}}}}, "wayuse.config.ts").apps.chrome?.policies, {})
        const policies = null as unknown as undefined
        assert.deepEqual(resolveConfig({apps: {chrome: {policies}}}, "wayuse.config.ts").apps.chrome?.policies, DEFAULT_POLICIES)
    })

    // The sample names the defaults for a reader to change, so it has to name them as they are.
    it("has in the sample the defaults it would fill in", async () => {
        const {default: sample} = await import("../../packages/build/sample/wayuse.config.ts")
        assert.deepEqual(sample.apps?.chrome?.policies, DEFAULT_POLICIES)
        assert.deepEqual(sample.screen, resolveConfig({}, "wayuse.config.ts").screen)
    })

    it("takes the values of the pages as given, an empty one among them, and the defaults for the rest", () => {
        assert.deepEqual(consoleVarsOf({}), {icon: "🖥️", title: "wayuse"})
        assert.deepEqual(consoleVarsOf({console: {vars: {title: "my-wayuse"}}}), {icon: "🖥️", title: "my-wayuse"})
        assert.deepEqual(consoleVarsOf({console: {vars: {icon: "", notice: "<b>"}}}), {icon: "", title: "wayuse", notice: "<b>"})
        const title = null as unknown as string
        assert.deepEqual(consoleVarsOf({console: {vars: {title}}}), {icon: "🖥️", title: "wayuse"})
    })

    it("refuses a value of the pages that is not a string", () => {
        const vars = {title: 1} as unknown as Record<string, string>
        assert.throws(() => consoleVarsOf({console: {vars}}), ConfigError)
        const list = ["my-wayuse"] as unknown as Record<string, string>
        assert.throws(() => consoleVarsOf({console: {vars: list}}), ConfigError)
    })

    it("makes the console's scripts small unless the configuration says not to", () => {
        assert.equal(consoleTerserOf({}), true)
        assert.equal(consoleTerserOf({console: {terser: false}}), false)
        assert.equal(consoleTerserOf({console: {terser: true}}), true)
        const terser = "no" as unknown as boolean
        assert.throws(() => consoleTerserOf({console: {terser}}), ConfigError)
    })

    it("opens the APIs for false alone", () => {
        assert.equal(resolveConfig({auth: false}, "wayuse.config.ts").auth, false)
        const auth = true as unknown as false
        assert.equal(resolveConfig({auth}, "wayuse.config.ts").auth, true)
    })

    it("leaves the console out of an image that says false for it", () => {
        assert.equal(resolveConfig({console: false}, "wayuse.config.ts").console, undefined)
        const console = null as unknown as undefined
        assert.deepEqual(resolveConfig({console}, "wayuse.config.ts").console, {})
    })

    it("leaves out a package without a value", () => {
        const packages = ["curl", null, undefined, "git"] as string[]
        assert.deepEqual(resolveConfig({packages}, "wayuse.config.ts").packages, ["curl", "git"])
    })

    // Each case is a value that would otherwise reach a Dockerfile or a shell script.
    it("takes the build directory from the configuration", () => {
        assert.equal(outputDirOf({output: {dir: "my-wayuse"}}), "my-wayuse")
    })

    it("takes the build directory of the command line ahead of the configuration's", () => {
        assert.equal(outputDirOf({output: {dir: "my-wayuse"}}, "other"), "other")
        assert.equal(outputDirOf({}, "other"), "other")
    })

    it("does not take an empty build directory of the command line for none", () => {
        assert.throws(() => outputDirOf({output: {dir: "my-wayuse"}}, ""), /--dir must not be empty/)
    })

    it("refuses to build where neither gives the build directory", () => {
        assert.throws(() => outputDirOf({}), /config\.output\.dir is not set, and --dir is not given/)
        assert.throws(() => outputDirOf({output: {}}), ConfigError)
        assert.throws(() => outputDirOf({output: {dir: ""}}, "other"), /config\.output\.dir must not be empty/)
    })

    it("refuses a build directory that is not a string, and an item of output it does not know", () => {
        assert.throws(() => outputDirOf({output: {dir: 1}} as unknown as WayuseBuild.Config, "other"), ConfigError)
        assert.throws(() => outputDirOf({output: {file: "my-wayuse"}} as unknown as WayuseBuild.Config, "other"), ConfigError)
    })

    it("keeps the build directory out of the resolved configuration", () => {
        assert.deepEqual(resolveConfig({output: {dir: "my-wayuse"}}, "wayuse.config.ts"), resolveConfig({}, "wayuse.config.ts"))
    })

    const refused: [string, unknown][] = [
        ["a misspelled key", {timezome: "Asia/Tokyo"}],
        ["a version range", {node: {version: "^24"}}],
        ["a version with a prefix", {node: {version: "v24.11.1"}}],
        ["an unknown application", {apps: {firefox: {}}}],
        ["an unknown channel", {apps: {chrome: {channel: "canary"}}}],
        ["an environment name with a space", {apps: {chrome: {env: {"A B": "1"}}}}],
        ["an environment value that is not a string", {apps: {chrome: {env: {A: 1}}}}],
        ["policies in a list", {apps: {chrome: {policies: ["AutoplayAllowlist"]}}}],
        ["policies as the name of a file", {apps: {chrome: {policies: "./chrome-policies.json"}}}],
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
        ["a console that is only said to be there", {console: true}],
        ["an auth that is a word", {auth: "off"}],
        ["an auth that is a number", {auth: 0}],
        ["a sign-in address on another origin", {console: {signIn: "https://example.com/sign-in/?next="}}],
        ["a sign-in address that starts with two slashes", {console: {signIn: "//example.com/sign-in/?next="}}],
        ["a sign-in address that runs a script", {console: {signIn: "javascript:alert(1)//"}}],
        ["a sign-in address with a space", {console: {signIn: "/sign in/?next="}}],
        ["a sign-in address that is not a string", {console: {signIn: true}}],
        ["a screen with a fraction", {screen: {width: 1280.5}}],
        ["a screen too large", {screen: {height: 100000}}],
    ]

    for (const [name, input] of refused) {
        it(`refuses ${name}`, () => {
            assert.throws(() => resolveConfig(input as WayuseBuild.Config, "wayuse.config.ts"), ConfigError)
        })
    }
})
