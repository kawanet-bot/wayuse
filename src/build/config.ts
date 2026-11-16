import type * as declared from "wayuse-build"
import type {WayuseBuild} from "wayuse-build"
import type {WayuseClient} from "wayuse-client"
import {VERSION} from "./version.ts"

type Input = WayuseBuild.Config
type Resolved = WayuseClient.Config

// The Node.js that runs wayuse-build: the one the image's owner already develops and tests with.
const DEFAULT_NODE_VERSION = process.versions.node

const CHANNELS = ["stable", "beta", "unstable"] as const

// Every value below ends up in a Dockerfile or a shell script, so each takes only what its syntax allows.
const NODE_VERSION = /^\d+\.\d+\.\d+$/
const TIMEZONE = /^[A-Za-z0-9_+-]+(\/[A-Za-z0-9_+-]+)*$/
const APT_PACKAGE = /^[a-z0-9][a-z0-9+.-]+$/
const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/
// A host name or an address, then the port there. One that starts with a hyphen would be read as an option of redir.
const REDIR_TARGET = /^[A-Za-z0-9][A-Za-z0-9.-]*:\d+$/

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
    const chrome = recordOf(value, "config.apps.chrome", ["channel", "env"])

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

    return {channel: channel as typeof CHANNELS[number], env}
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
 * Fills in every default and refuses what the generated files could not carry.
 */
export const resolveConfig = (input: Input): Resolved => {
    const config = recordOf(input ?? {}, "config", ["node", "apps", "timezone", "screen", "packages"])
    const node = recordOf(config.node, "config.node", ["version"])
    const apps = recordOf(config.apps, "config.apps", ["chrome", "redir"])
    const screen = recordOf(config.screen, "config.screen", ["width", "height"])

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
    }
}
