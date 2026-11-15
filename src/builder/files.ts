import {copyFile, cp, mkdir, rm, writeFile} from "node:fs/promises"
import {dirname, join} from "node:path"
import {fileURLToPath} from "node:url"
import type {WayuseClient} from "wayuse-client"
import {type BuildOptions, dockerfileOf} from "./dockerfile.ts"
import {SERVER_TARBALL, npmPackageOf} from "./npm-package.ts"
import {shellEnvOf} from "./shell-env.ts"
import {swayConfigOf} from "./sway-config.ts"

type Resolved = WayuseClient.Config

// Resolved by name, so the sources under test and the built copy find the same assets.
const assetsRoot = (): string => fileURLToPath(new URL("../assets/", import.meta.resolve("wayuse-builder")))

/**
 * The generated files by their path in the build directory. rootfs/ mirrors the image's file system.
 */
export const generatedFilesOf = (config: Resolved, options: BuildOptions = {}): Record<string, string> => {
    const files: Record<string, string> = {
        "Dockerfile": dockerfileOf(config, options),
        "rootfs/etc/wayuse/wayuse.json": JSON.stringify(config, null, 2) + "\n",
        "rootfs/etc/wayuse/sway/config": swayConfigOf(config),
        "rootfs/opt/wayuse/package.json": npmPackageOf(options.serverTarball != null),
    }

    const {chrome} = config.apps
    if (chrome) files["rootfs/etc/wayuse/chrome.env"] = shellEnvOf(chrome.env)

    return files
}

/**
 * Writes the build directory anew and returns the paths of what it generated.
 */
export const writeBuildDir = async (config: Resolved, outdir: string, options: BuildOptions = {}): Promise<string[]> => {
    // A file an earlier configuration generated must not linger and reach the image.
    await rm(outdir, {recursive: true, force: true})
    await cp(assetsRoot(), outdir, {recursive: true})

    const files = generatedFilesOf(config, options)
    for (const [path, content] of Object.entries(files)) {
        const file = join(outdir, path)
        await mkdir(dirname(file), {recursive: true})
        await writeFile(file, content)
    }

    const paths = Object.keys(files)

    if (options.serverTarball != null) {
        const path = `rootfs/opt/wayuse/${SERVER_TARBALL}`
        await copyFile(options.serverTarball, join(outdir, path))
        paths.push(path)
    }

    return paths
}
