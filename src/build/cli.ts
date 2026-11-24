import type * as declared from "@wayuse/build"
import {basename, dirname, join, resolve} from "node:path"
import {pathToFileURL} from "node:url"
import {parseArgs} from "node:util"
import {findConfigFile, isFile} from "./config-file.ts"
import {ConfigError, consoleTerserOf, consoleVarsOf, outputDirOf, resolveConfig} from "./config.ts"
import {writeBuildDir} from "./files.ts"
import {VERSION} from "./version.ts"

const USAGE = `
Usage: wayuse-build [options]
  -c, --config <file>      the configuration to read (default: wayuse.config.ts, .mjs or .js)
  -d, --dir <dir>          the build directory to write (default: output.dir of the configuration)
  --server-tarball <file>  a @wayuse/server tarball to install in place of the one on npm
  -v, --version            print this package's version
  -h, --help               print this usage
`.trimStart()

const EXIT_USAGE = 2

const readArgs = (args: string[]) => parseArgs({
    args,
    options: {
        config: {type: "string", short: "c"},
        dir: {type: "string", short: "d"},
        "server-tarball": {type: "string"},
        version: {type: "boolean", short: "v"},
        help: {type: "boolean", short: "h"},
    },
}).values

// Node strips the types of a .ts file outside node_modules, so the file is imported as it is.
const loadConfig = async (file: string): Promise<unknown> => {
    // Checked ahead, so a module the configuration itself imports is not taken for the configuration.
    if (!await isFile(file)) throw new ConfigError("not found")
    const module = await import(pathToFileURL(resolve(file)).href) as {default?: unknown}
    if (module.default == null) throw new ConfigError(`${file} has no default export`)
    return module.default
}

export const CLI: typeof declared.CLI = async ({args}) => {
    let options: ReturnType<typeof readArgs>

    try {
        options = readArgs(args)
    } catch (error) {
        process.stderr.write(`${(error as Error).message}\n${USAGE}`)
        return EXIT_USAGE
    }

    if (options.help) {
        process.stdout.write(USAGE)
        return 0
    }

    if (options.version) {
        process.stdout.write(`@wayuse/build ${VERSION}\n`)
        return 0
    }

    // With no configuration here, the usage helps more than an error of import.
    const configFile = options.config ?? await findConfigFile(process.cwd())
    if (configFile == null) {
        process.stderr.write(USAGE)
        return EXIT_USAGE
    }

    try {
        const input = await loadConfig(configFile) as declared.WayuseBuild.Config
        // The directory is left out, so the image tells nothing of where it was built.
        const config = resolveConfig(input, basename(configFile))
        const dir = outputDirOf(input, options.dir)
        // Outside rootfs/, the scripts name the image after the directory, as Docker Compose names its project.
        const project = basename(dirname(resolve(configFile)))
        const files = await writeBuildDir(config, dir, {serverTarball: options["server-tarball"], vars: consoleVarsOf(input), terser: consoleTerserOf(input), project})
        for (const file of files) process.stdout.write(`${join(dir, file)}\n`)
        return 0
    } catch (error) {
        if (!(error instanceof ConfigError)) throw error
        process.stderr.write(`${configFile}: ${error.message}\n`)
        return 1
    }
}
