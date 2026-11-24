import type {WayuseClient} from "wayuse"
import {VERSION} from "./version.ts"

// The server is released first at the same version, and a later compatible one serves this build too.
const SERVER_RANGE = `^${VERSION}`

/** What @wayuse/server needs for an application and leaves out of its own dependencies, as an optional peer. */
export const APP_PACKAGES: Record<keyof WayuseClient.Config["apps"], Record<string, string>> = {
    chrome: {"html-slim": "^0.5.0"},
    redir: {},
}

/**
 * The package.json of /opt/wayuse: what npm installs into the image, with only what the chosen applications need.
 */
export const npmPackageOf = (config: WayuseClient.Config): string => {
    const dependencies: Record<string, string> = {"@wayuse/server": SERVER_RANGE}

    for (const app of Object.keys(config.apps) as (keyof typeof APP_PACKAGES)[]) Object.assign(dependencies, APP_PACKAGES[app])

    return JSON.stringify({name: "wayuse-image", private: true, dependencies}, null, 2) + "\n"
}
