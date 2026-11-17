// A command that another package holds, such as `wayuse build` in @wayuse/build.

import {type CLIIO, type CommandPackage, UsageError} from "./cli-io.ts"

const EXIT_FAILURE = 1

// What a package name takes after the scope. Anything else, a path among them, names no package.
const COMMAND = /^[a-z][a-z0-9-]*$/

/** The package of a command this one does not have. Only the owners of the scope publish there. */
export const packageOf = (command: string | undefined): string | undefined =>
    (command != null && COMMAND.test(command) ? `@wayuse/${command}` : undefined)

/**
 * Hands the arguments to the CLI() of the package, which knows its own options, and resolves to its exit code.
 */
export const runPackage = async (name: string, args: string[], io: CLIIO): Promise<number> => {
    let loaded: Partial<CommandPackage>
    try {
        loaded = await (io.load ?? (name => import(name)))(name)
    } catch (error) {
        // A package that is there and cannot load one of its own is another failure, and is shown as it is.
        const {code, message} = error as {code?: unknown, message?: unknown}
        if (code !== "ERR_MODULE_NOT_FOUND" || !String(message).includes(`'${name}'`)) throw error
        throw new UsageError(`${name} is not installed`)
    }

    if (typeof loaded.CLI !== "function") {
        io.stderr.write(`${name} has no CLI()\n`)
        return EXIT_FAILURE
    }

    return loaded.CLI({args})
}
