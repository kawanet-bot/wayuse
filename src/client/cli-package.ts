// A subcommand that another package holds, such as `wayuse build`.

import {createRequire} from "node:module"
import {join} from "node:path"
import {pathToFileURL} from "node:url"
import type {CLIIO, CommandPackage} from "./cli-io.ts"

const EXIT_USAGE = 2

// The project in the current directory comes first: npx may keep this package apart from what the project installed.
const loadPackage = async (name: string): Promise<CommandPackage> => {
    let specifier = name
    try {
        specifier = pathToFileURL(createRequire(join(process.cwd(), "package.json")).resolve(name)).href
    } catch {
        // Not in the project. The import below looks beside this package, and fails when it is nowhere.
    }
    return import(specifier)
}

/**
 * Hands the arguments to the CLI() of the package, which knows its own options, and resolves to its exit code.
 */
export const runPackage = async (name: string, args: string[], io: CLIIO): Promise<number> => {
    let loaded: CommandPackage
    try {
        loaded = await (io.load ?? loadPackage)(name)
    } catch (error) {
        if ((error as {code?: unknown} | null)?.code !== "ERR_MODULE_NOT_FOUND") throw error
        io.stderr.write(`${name} is not installed: npm install -D ${name}\n`)
        return EXIT_USAGE
    }
    return loaded.CLI({args})
}
