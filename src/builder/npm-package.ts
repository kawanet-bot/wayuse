import type {WayuseClient} from "wayuse-client"

// The wayuse-server this builder was written against. A tarball stands in while that is not on npm.
const SERVER_RANGE = "^0.0.0"

/** The tarball's name in the image: fixed, so the generated files do not change with its version. */
export const SERVER_TARBALL = "wayuse-server.tgz"

/** What wayuse-server needs for an application and leaves out of its own dependencies, as an optional peer. */
export const APP_PACKAGES: Record<keyof WayuseClient.Config["apps"], Record<string, string>> = {
    chrome: {"html-slim": "^0.5.0"},
}

/**
 * The package.json of /opt/wayuse: what npm installs into the image, with only what the chosen applications need.
 */
export const npmPackageOf = (config: WayuseClient.Config, tarball: boolean): string => {
    const dependencies: Record<string, string> = {"wayuse-server": tarball ? `file:${SERVER_TARBALL}` : SERVER_RANGE}

    for (const app of Object.keys(config.apps) as (keyof typeof APP_PACKAGES)[]) Object.assign(dependencies, APP_PACKAGES[app])

    return JSON.stringify({name: "wayuse-image", private: true, dependencies}, null, 2) + "\n"
}
