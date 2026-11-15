import type * as declared from "wayuse-builder"
import type {WayuseBuilder} from "wayuse-builder"
import type {WayuseClient} from "wayuse-client"
import {VERSION} from "./version.ts"

type Input = WayuseBuilder.Config
type Resolved = WayuseClient.Config

// The current LTS when this builder was released: a default a newer builder may move.
const DEFAULT_NODE_VERSION = "26.13.1"

const CHANNELS = ["stable", "beta", "unstable"] as const

// Every value below ends up in a Dockerfile or a shell script, so each takes only what its syntax allows.
const NODE_VERSION = /^\d+\.\d+\.\d+$/
const TIMEZONE = /^[A-Za-z0-9_+-]+(\/[A-Za-z0-9_+-]+)*$/
const APT_PACKAGE = /^[a-z0-9][a-z0-9+.-]+$/
const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/

// sway refuses nothing here, so the bounds are those of the screens the server resizes to.
const SCREEN_MIN = 1
const SCREEN_MAX = 2560

export class ConfigError extends Error {
}

export const defineConfig: typeof declared.defineConfig = config => config

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value != null && typeof value === "object" && !Array.isArray(value)

// A misspelled key would otherwise be dropped in silence and the default taken.
const recordOf = (value: unknown, path: string, keys: readonly string[]): Record<string, unknown> => {
    if (value === undefined) return {}
    if (!isRecord(value)) throw new ConfigError(`${path} must be an object`)
    for (const key of Object.keys(value)) {
        if (!keys.includes(key)) throw new ConfigError(`${path}.${key} is not a known item`)
    }
    return value
}

const stringOf = (value: unknown, path: string, pattern: RegExp, fallback: string): string => {
    if (value === undefined) return fallback
    if (typeof value !== "string" || !pattern.test(value)) throw new ConfigError(`${path} is not valid: ${JSON.stringify(value)}`)
    return value
}

const sizeOf = (value: unknown, path: string, fallback: number): number => {
    if (value === undefined) return fallback
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

/**
 * Fills in every default and refuses what the generated files could not carry.
 */
export const resolveConfig = (input: Input): Resolved => {
    const config = recordOf(input ?? {}, "config", ["node", "apps", "timezone", "screen", "packages"])
    const node = recordOf(config.node, "config.node", ["version"])
    const apps = recordOf(config.apps, "config.apps", ["chrome"])
    const screen = recordOf(config.screen, "config.screen", ["width", "height"])

    const packages = config.packages ?? []
    if (!Array.isArray(packages)) throw new ConfigError("config.packages must be an array")
    packages.forEach((name, i) => stringOf(name, `config.packages[${i}]`, APT_PACKAGE, ""))

    return {
        builder: {version: VERSION},
        node: {version: stringOf(node.version, "config.node.version", NODE_VERSION, DEFAULT_NODE_VERSION)},
        apps: apps.chrome === undefined ? {} : {chrome: chromeOf(apps.chrome)},
        timezone: stringOf(config.timezone, "config.timezone", TIMEZONE, "Etc/UTC"),
        screen: {
            width: sizeOf(screen.width, "config.screen.width", 1280),
            height: sizeOf(screen.height, "config.screen.height", 960),
        },
        packages: packages as string[],
    }
}
