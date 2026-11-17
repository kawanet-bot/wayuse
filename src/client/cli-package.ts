// A subcommand that another package holds, such as `wayuse build`.

import type {CLIIO, CommandPackage} from "./cli-io.ts"

const EXIT_USAGE = 2

/**
 * Hands the arguments to the CLI() of the package, which knows its own options, and resolves to its exit code.
 */
export const runPackage = async (name: string, args: string[], io: CLIIO): Promise<number> => {
    let loaded: CommandPackage
    try {
        loaded = await (io.load ?? (name => import(name)))(name)
    } catch (error) {
        if ((error as {code?: unknown} | null)?.code !== "ERR_MODULE_NOT_FOUND") throw error
        io.stderr.write(`${name} is not installed: npm install -D ${name}\n`)
        return EXIT_USAGE
    }
    return loaded.CLI({args})
}
