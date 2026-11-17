import {copyFile, cp, mkdir, readdir, rm, writeFile} from "node:fs/promises"
import {dirname, join} from "node:path"
import {fileURLToPath} from "node:url"
import type {WayuseClient} from "wayuse"
import {type BuildOptions, dockerfileOf} from "./dockerfile.ts"
import {bundleNovnc} from "./novnc.ts"
import {SERVER_TARBALL, npmPackageOf} from "./npm-package.ts"
import {shellEnvOf} from "./shell-env.ts"
import {swayConfigOf} from "./sway-config.ts"

type Resolved = WayuseClient.Config

// Resolved by name, so the sources under test and the built copy find the same assets.
const assetsRoot = (): string => fileURLToPath(new URL("../assets/", import.meta.resolve("wayuse-build")))

// The console's scripts are built from src/console/, beside this package's own file.
const consoleScripts = (): string => fileURLToPath(new URL("./console/", import.meta.resolve("wayuse-build")))

// Where the image has the console, laid out as its URLs are.
const CONSOLE = "rootfs/opt/wayuse/htdocs/console"

/**
 * The generated files by their path in the build directory. rootfs/ mirrors the image's file system.
 */
export const generatedFilesOf = (config: Resolved, options: BuildOptions = {}): Record<string, string> => {
    const files: Record<string, string> = {
        "Dockerfile": dockerfileOf(config, options),
        "rootfs/etc/wayuse/wayuse.json": JSON.stringify(config, null, 2) + "\n",
        "rootfs/etc/wayuse/sway/config": swayConfigOf(config),
        "rootfs/opt/wayuse/package.json": npmPackageOf(config, options.serverTarball != null),
        // The entry reads it before it has a token, which the API would ask for.
        [`${CONSOLE}/config.json`]: JSON.stringify(config.console, null, 2) + "\n",
    }

    const {chrome, redir} = config.apps
    if (chrome) files["rootfs/etc/wayuse/chrome.env"] = shellEnvOf(chrome.env)
    // One file holds every policy. Chrome does not say which wins when two files name the same one.
    if (chrome) files["rootfs/etc/opt/chrome/policies/managed/wayuse.json"] = JSON.stringify(chrome.policies, null, 2) + "\n"
    // One line per redir, for the start script to read: the port to listen on, then where it forwards to.
    if (redir) files["rootfs/etc/wayuse/redir.conf"] = Object.entries(redir.ports).map(([port, target]) => `${port} ${target}\n`).join("")

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

    // The pages are already there, written by hand in assets/. Their scripts join them.
    await mkdir(join(outdir, CONSOLE, "js"), {recursive: true})
    for (const name of (await readdir(consoleScripts())).sort()) {
        const script = `${CONSOLE}/js/${name}`
        await copyFile(join(consoleScripts(), name), join(outdir, script))
        paths.push(script)
    }

    // Made here and never shipped in a wayuse package: noVNC comes from its own, under its own license.
    const novnc = `${CONSOLE}/vendor/novnc.js`
    await bundleNovnc(join(outdir, novnc))
    paths.push(novnc)

    // One file as npm installed it, which the console's pages import to build their elements.
    const htmlEle = `${CONSOLE}/vendor/html-ele.mjs`
    await copyFile(fileURLToPath(import.meta.resolve("html-ele")), join(outdir, htmlEle))
    paths.push(htmlEle)

    if (options.serverTarball != null) {
        const path = `rootfs/opt/wayuse/${SERVER_TARBALL}`
        await copyFile(options.serverTarball, join(outdir, path))
        paths.push(path)
    }

    return paths
}
