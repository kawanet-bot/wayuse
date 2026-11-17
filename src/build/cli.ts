import type * as declared from "@wayuse/build"
import {resolve} from "node:path"
import {pathToFileURL} from "node:url"
import {parseArgs} from "node:util"
import {ConfigError, consoleVarsOf, resolveConfig} from "./config.ts"
import {writeBuildDir} from "./files.ts"
import {VERSION} from "./version.ts"

const USAGE = `
Usage: wayuse-build [options]
  -c, --config <file>      the configuration to read (default: wayuse.config.ts)
  -o, --outdir <dir>       the build directory to write, emptied first (default: .wayuse)
  --server-tarball <file>  a @wayuse/server tarball to install in place of the one on npm
  -v, --version            print this package's version
  -h, --help               print this usage
`.trimStart()

const EXIT_USAGE = 2

const readArgs = (args: string[]) => parseArgs({
    args,
    options: {
        config: {type: "string", short: "c", default: "wayuse.config.ts"},
        outdir: {type: "string", short: "o", default: ".wayuse"},
        "server-tarball": {type: "string"},
        version: {type: "boolean", short: "v"},
        help: {type: "boolean", short: "h"},
    },
}).values

// Node strips the types of a .ts file outside node_modules, so the file is imported as it is.
const loadConfig = async (file: string): Promise<unknown> => {
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

    try {
        const input = await loadConfig(options.config) as declared.WayuseBuild.Config
        const config = resolveConfig(input)
        const files = await writeBuildDir(config, options.outdir, {serverTarball: options["server-tarball"], vars: consoleVarsOf(input)})
        for (const file of files) process.stdout.write(`${options.outdir}/${file}\n`)
        return 0
    } catch (error) {
        if (!(error instanceof ConfigError)) throw error
        process.stderr.write(`${options.config}: ${error.message}\n`)
        return 1
    }
}
