import {EN} from "html-ele"
import {copyFile, cp, mkdir, readFile, readdir, rm, writeFile} from "node:fs/promises"
import {dirname, join} from "node:path"
import {fileURLToPath} from "node:url"
import {minify} from "terser"
import type {WayuseClient} from "wayuse"
import {DEFAULT_VARS} from "./config.ts"
import {type BuildOptions, dockerfileOf} from "./dockerfile.ts"
import {SERVER_TARBALL, npmPackageOf} from "./npm-package.ts"
import {shellEnvOf} from "./shell-env.ts"
import {swayConfigOf} from "./sway-config.ts"
import {bundleVendor} from "./vendor.ts"

type Resolved = WayuseClient.Config

// Resolved by name, so the sources under test and the built copy find the same assets.
const assetsRoot = (): string => fileURLToPath(new URL("../assets/", import.meta.resolve("@wayuse/build")))

// The console's scripts are built from src/console/, beside this package's own file.
const consoleScripts = (): string => fileURLToPath(new URL("./console/", import.meta.resolve("@wayuse/build")))

// Where the image has what the server serves, and the console in it, laid out as its URLs are.
const HTDOCS = "rootfs/opt/wayuse/htdocs"
const CONSOLE = `${HTDOCS}/console`

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

// The packages of others that the console's pages load, each as one file under vendor/.
const VENDORS: [string, string][] = [["@novnc/novnc", "novnc.js"], ["html-ele", "html-ele.js"]]

// A script of the console's own is made small one file at a time, so its imports stay as they are.
const minifyScript = async (code: string): Promise<string> => (await minify(code, {module: true, compress: true, mangle: true})).code ?? code

// A page of assets/ has {{name}} where a value of console.vars goes. The value is text, so it is escaped.
const fillVars = async (dir: string, vars: Record<string, string>): Promise<void> => {
    for (const name of await readdir(dir, {recursive: true})) {
        if (!name.endsWith(".html")) continue
        const file = join(dir, name)
        const html = (await readFile(file, "utf8")).replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
            if (vars[key] == null) throw new Error(`${name} has {{${key}}}, which has no value`)
            return String(EN`${vars[key]}`)
        })
        await writeFile(file, html)
    }
}

/**
 * Writes the build directory anew and returns the paths of what it generated.
 */
export const writeBuildDir = async (config: Resolved, outdir: string, options: BuildOptions = {}): Promise<string[]> => {
    // A file an earlier configuration generated must not linger and reach the image.
    await rm(outdir, {recursive: true, force: true})
    await cp(assetsRoot(), outdir, {recursive: true})
    await fillVars(join(outdir, HTDOCS), options.vars ?? DEFAULT_VARS)

    const files = generatedFilesOf(config, options)
    for (const [path, content] of Object.entries(files)) {
        const file = join(outdir, path)
        await mkdir(dirname(file), {recursive: true})
        await writeFile(file, content)
    }

    const paths = Object.keys(files)
    const small = options.terser ?? true

    // The pages are already there, written by hand in assets/. Their scripts join them.
    await mkdir(join(outdir, CONSOLE, "js"), {recursive: true})
    for (const name of (await readdir(consoleScripts())).sort()) {
        const script = `${CONSOLE}/js/${name}`
        const code = await readFile(join(consoleScripts(), name), "utf8")
        await writeFile(join(outdir, script), small ? await minifyScript(code) : code)
        paths.push(script)
    }

    // Made here and never shipped in a wayuse package: each comes from its own package, under its own license.
    for (const [name, file] of VENDORS) {
        const vendor = `${CONSOLE}/vendor/${file}`
        await bundleVendor(name, join(outdir, vendor), small)
        paths.push(vendor)
    }

    if (options.serverTarball != null) {
        const path = `rootfs/opt/wayuse/${SERVER_TARBALL}`
        await copyFile(options.serverTarball, join(outdir, path))
        paths.push(path)
    }

    return paths
}
