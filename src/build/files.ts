import {EN} from "html-ele"
import {cp, mkdir, readFile, readdir, rm, writeFile} from "node:fs/promises"
import {dirname, join, relative} from "node:path"
import {fileURLToPath} from "node:url"
import {minify} from "terser"
import type {WayuseClient} from "wayuse"
import {composeOf} from "./compose.ts"
import {DEFAULT_VARS} from "./config.ts"
import {dockerBuildOf, dockerRunOf} from "./docker-scripts.ts"
import {type BuildOptions, dockerfileOf} from "./dockerfile.ts"
import {npmPackageOf} from "./npm-package.ts"
import {chromeStartOf, redirStartOf, swayStartOf, wayvncStartOf} from "./start-scripts.ts"
import {SWAY_CONFIG, swayConfigOf} from "./sway-config.ts"
import {TERSER, bundleVendor} from "./vendor.ts"

type Resolved = WayuseClient.Config

// Resolved by name, so the sources under test and the built copy find the same assets.
const assetsRoot = (): string => fileURLToPath(new URL("../assets/", import.meta.resolve("@wayuse/build")))

// The console's scripts are built from src/console/, beside this package's own file.
const consoleScripts = (): string => fileURLToPath(new URL("./console/", import.meta.resolve("@wayuse/build")))

// Where the image has what the server serves, and the console in it, laid out as its URLs are.
const HTDOCS = "rootfs/opt/wayuse/htdocs"
const CONSOLE = `${HTDOCS}/console`

// The scripts the container runs.
const BIN = "rootfs/opt/wayuse/bin"

// The directory of the image that is this package's alone. A build writes it anew.
const OWNED = "rootfs/opt/wayuse"

// Chrome reads every file beside it, so the file is in a directory that is not this package's alone.
const POLICIES = "rootfs/etc/opt/chrome/policies/managed/wayuse.json"

/**
 * The generated files by their path in the build directory. rootfs/ mirrors the image's file system.
 */
export const generatedFilesOf = (config: Resolved, options: BuildOptions = {}): Record<string, string> => {
    const files: Record<string, string> = {
        "Dockerfile": dockerfileOf(config),
        "compose.yml": composeOf(config),
        "docker-build.sh": dockerBuildOf(config, options),
        "docker-run.sh": dockerRunOf(config, options),
        "rootfs/opt/wayuse/wayuse.config.json": JSON.stringify(config, null, 2) + "\n",
        [`rootfs${SWAY_CONFIG}`]: swayConfigOf(config),
        "rootfs/opt/wayuse/package.json": npmPackageOf(config),
        [`${BIN}/sway-start.sh`]: swayStartOf(config),
        [`${BIN}/wayvnc-start.sh`]: wayvncStartOf(config),
    }

    // assets/ cannot hold it. npm pack leaves out a directory with a .gitignore in it.
    files[`${OWNED}/.gitignore`] = "# A build writes this directory anew, so git keeps none of it.\n*\n"

    // The entry reads it before it has a token, which the API would ask for.
    if (config.console) files[`${CONSOLE}/config.json`] = JSON.stringify(config.console, null, 2) + "\n"

    const {chrome, redir} = config.apps
    if (chrome) files[`${BIN}/chrome-start.sh`] = chromeStartOf(config)
    // One file holds every policy. Chrome does not say which wins when two files name the same one.
    if (chrome) files[POLICIES] = JSON.stringify(chrome.policies, null, 2) + "\n"
    if (redir) files[`${BIN}/redir-start.sh`] = redirStartOf(config)

    return files
}

// The packages of others that the console's pages load, each as one file under vendor/.
const VENDORS: [string, string][] = [["@novnc/novnc", "novnc.js"], ["html-ele", "html-ele.js"]]

// A script of the console's own is made small one file at a time, so its imports stay as they are.
const minifyScript = async (code: string): Promise<string> => (await minify(code, {...TERSER, module: true})).code ?? code

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
 * Writes the console into the build directory, and returns the paths of what it generated.
 */
const writeConsole = async (outdir: string, options: BuildOptions): Promise<string[]> => {
    const paths: string[] = []
    const small = options.terser ?? true

    await fillVars(join(outdir, HTDOCS), options.vars ?? DEFAULT_VARS)

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

    return paths
}

// Every file under the directory, by its path from there.
const filesUnder = async (dir: string): Promise<string[]> =>
    (await readdir(dir, {recursive: true, withFileTypes: true})).filter(entry => entry.isFile()).map(entry => relative(dir, join(entry.parentPath, entry.name)))

/**
 * Writes the build directory and returns the paths of the files it wrote.
 * The directory may be one that has other files, which are neither removed nor read.
 */
export const writeBuildDir = async (config: Resolved, outdir: string, options: BuildOptions = {}): Promise<string[]> => {
    // A file an earlier configuration generated must not linger and reach the image.
    await rm(join(outdir, OWNED), {recursive: true, force: true})
    await cp(assetsRoot(), outdir, {recursive: true})
    // Listed with the generated files, as the next build writes over these too.
    const copied = await filesUnder(assetsRoot())

    // An image without the console keeps the directory the server serves, with nothing of the console in it.
    if (!config.console) {
        await rm(join(outdir, HTDOCS), {recursive: true})
        await mkdir(join(outdir, HTDOCS))
    }

    const files = generatedFilesOf(config, options)

    for (const [path, content] of Object.entries(files)) {
        const file = join(outdir, path)
        await mkdir(dirname(file), {recursive: true})
        // Written anew, so that a link there is not written through and a script gets its mode, which a new file alone takes.
        await rm(file, {force: true})
        await writeFile(file, content, path.endsWith(".sh") ? {mode: 0o755} : {})
    }

    const paths = [...copied.filter(path => config.console || !path.startsWith(`${HTDOCS}/`)), ...Object.keys(files)]
    if (config.console) paths.push(...await writeConsole(outdir, options))

    return [...new Set(paths)].sort()
}
