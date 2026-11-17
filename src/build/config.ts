import type * as declared from "@wayuse/build"
import type {WayuseBuild} from "@wayuse/build"
import type {WayuseClient} from "wayuse"
import {VERSION} from "./version.ts"

type Input = WayuseBuild.Config
type Resolved = WayuseClient.Config

// The Node.js that runs @wayuse/build: the one the image's owner already develops and tests with.
const DEFAULT_NODE_VERSION = process.versions.node

const CHANNELS = ["stable", "beta", "unstable"] as const

// What the pages show where their HTML has {{icon}} and {{title}}, for an image that names neither.
export const DEFAULT_VARS: Record<string, string> = {icon: "🖥️", title: "wayuse"}

// They keep Chrome to its one profile. Policies given in a configuration replace them.
export const DEFAULT_POLICIES: Record<string, unknown> = {BrowserGuestModeEnabled: false, BrowserAddPersonEnabled: false}

// Every value below ends up in a Dockerfile or a shell script, so each takes only what its syntax allows.
const NODE_VERSION = /^\d+\.\d+\.\d+$/
const TIMEZONE = /^[A-Za-z0-9_+-]+(\/[A-Za-z0-9_+-]+)*$/
const APT_PACKAGE = /^[a-z0-9][a-z0-9+.-]+$/
const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/
// A host name or an address, then the port there. One that starts with a hyphen would be read as an option of redir.
const REDIR_TARGET = /^[A-Za-z0-9][A-Za-z0-9.-]*:\d+$/

// The entry comes back from there by a path alone, so the address has no scheme and no host of its own.
const SIGN_IN = /^(?![A-Za-z][A-Za-z0-9+.-]*:|[\/\\]{2})\S+$/

// sway refuses nothing here, so the bounds are those of the screens the server resizes to.
const SCREEN_MIN = 1
const SCREEN_MAX = 2560

// The container's user cannot listen on a port below 1024.
const PORT_MIN = 1024
const PORT_MAX = 65535

export class ConfigError extends Error {
}

export const defineConfig: typeof declared.defineConfig = config => config

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value != null && typeof value === "object" && !Array.isArray(value)

// A misspelled key would otherwise be dropped in silence and the default taken.
const recordOf = (value: unknown, path: string, keys: readonly string[]): Record<string, unknown> => {
    if (value == null) return {}
    if (!isRecord(value)) throw new ConfigError(`${path} must be an object`)
    for (const key of Object.keys(value)) {
        if (!keys.includes(key)) throw new ConfigError(`${path}.${key} is not a known item`)
    }
    return value
}

const stringOf = (value: unknown, path: string, pattern: RegExp, fallback: string): string => {
    if (value == null) return fallback
    if (typeof value !== "string" || !pattern.test(value)) throw new ConfigError(`${path} is not valid: ${JSON.stringify(value)}`)
    return value
}

const sizeOf = (value: unknown, path: string, fallback: number): number => {
    if (value == null) return fallback
    if (!Number.isInteger(value) || (value as number) < SCREEN_MIN || (value as number) > SCREEN_MAX) {
        throw new ConfigError(`${path} must be an integer from ${SCREEN_MIN} to ${SCREEN_MAX}: ${JSON.stringify(value)}`)
    }
    return value as number
}

const chromeOf = (value: unknown): WayuseClient.ChromeConfig => {
    const chrome = recordOf(value, "config.apps.chrome", ["channel", "env", "policies"])

    const channel = chrome.channel ?? "stable"
    if (!CHANNELS.includes(channel as typeof CHANNELS[number])) {
        throw new ConfigError(`config.apps.chrome.channel must be one of ${CHANNELS.join(", ")}: ${JSON.stringify(channel)}`)
    }

    const env: Record<string, string> = {}
    for (const [name, text] of Object.entries(recordOf(chrome.env, "config.apps.chrome.env", Object.keys(chrome.env ?? {})))) {
        if (!ENV_NAME.test(name)) throw new ConfigError(`config.apps.chrome.env has an invalid name: ${JSON.stringify(name)}`)
        if (typeof text !== "string") throw new ConfigError(`config.apps.chrome.env.${name} must be a string`)
        env[name] = text
    }

    // Chrome's own names and values, written to its file as given. Only Chrome can tell a wrong one.
    const policies = chrome.policies ?? DEFAULT_POLICIES
    if (!isRecord(policies)) throw new ConfigError("config.apps.chrome.policies must be an object")

    return {channel: channel as typeof CHANNELS[number], env, policies: {...policies}}
}

const redirOf = (value: unknown): WayuseClient.RedirConfig => {
    const redir = recordOf(value, "config.apps.redir", ["ports"])

    const ports: Record<number, string> = {}
    for (const [port, target] of Object.entries(recordOf(redir.ports, "config.apps.redir.ports", Object.keys(redir.ports ?? {})))) {
        if (!/^\d+$/.test(port) || +port < PORT_MIN || +port > PORT_MAX) {
            throw new ConfigError(`config.apps.redir.ports takes a port from ${PORT_MIN} to ${PORT_MAX}: ${JSON.stringify(port)}`)
        }
        if (typeof target !== "string" || !REDIR_TARGET.test(target)) {
            throw new ConfigError(`config.apps.redir.ports.${port} is not valid: ${JSON.stringify(target)}`)
        }
        ports[+port] = target
    }

    // With no port there is no redir to keep running, and the start script would end at once.
    if (!Object.keys(ports).length) throw new ConfigError("config.apps.redir.ports is required")

    return {ports}
}

/**
 * The values the pages are written with. They go into the HTML alone, and the resolved configuration does not have them.
 */
export const consoleVarsOf = (input: Input): Record<string, string> => {
    const given = isRecord(input) && isRecord(input.console) ? input.console.vars : undefined
    if (given != null && !isRecord(given)) throw new ConfigError("config.console.vars must be an object")

    const vars = {...DEFAULT_VARS}
    for (const [name, value] of Object.entries(given ?? {})) {
        // An empty string is a value. Only no value at all leaves the default.
        if (value == null) continue
        if (typeof value !== "string") throw new ConfigError(`config.console.vars.${name} must be a string`)
        vars[name] = value
    }
    return vars
}

/**
 * Whether the console's scripts are made small. It decides how the files are written, and the resolved configuration does not have it.
 */
export const consoleTerserOf = (input: Input): boolean => {
    const given = isRecord(input) && isRecord(input.console) ? input.console.terser : undefined
    if (given != null && typeof given !== "boolean") throw new ConfigError("config.console.terser must be true or false")
    return given ?? true
}

/**
 * Fills in every default and refuses what the generated files could not carry.
 */
export const resolveConfig = (input: Input): Resolved => {
    const config = recordOf(input ?? {}, "config", ["node", "apps", "timezone", "screen", "packages", "console"])
    const node = recordOf(config.node, "config.node", ["version"])
    const apps = recordOf(config.apps, "config.apps", ["chrome", "redir"])
    const screen = recordOf(config.screen, "config.screen", ["width", "height"])
    const signIn = stringOf(recordOf(config.console, "config.console", ["signIn", "vars", "terser"]).signIn, "config.console.signIn", SIGN_IN, "")

    const installed: Resolved["apps"] = {}
    if (apps.chrome != null) installed.chrome = chromeOf(apps.chrome)
    if (apps.redir != null) installed.redir = redirOf(apps.redir)

    const given = config.packages ?? []
    if (!Array.isArray(given)) throw new ConfigError("config.packages must be an array")

    // An element without a value names no package. It is left out, where it would reach the Dockerfile as a word.
    const packages: string[] = []
    given.forEach((name, i) => {
        if (name != null) packages.push(stringOf(name, `config.packages[${i}]`, APT_PACKAGE, ""))
    })

    return {
        wayuse: {build: {version: VERSION}},
        // The default is checked like a given value: a nightly build of Node.js has no release to download.
        node: {version: stringOf(node.version ?? DEFAULT_NODE_VERSION, "config.node.version", NODE_VERSION, "")},
        apps: installed,
        timezone: stringOf(config.timezone, "config.timezone", TIMEZONE, "Etc/UTC"),
        screen: {
            width: sizeOf(screen.width, "config.screen.width", 1280),
            height: sizeOf(screen.height, "config.screen.height", 960),
        },
        packages,
        console: signIn ? {signIn} : {},
    }
}
