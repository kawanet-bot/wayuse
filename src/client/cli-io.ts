import {writeFile} from "node:fs/promises"
import type {WayuseClient} from "wayuse"

export type Env = Record<string, string | undefined>

/** What a command line touches besides its arguments, so a test stands in for each. */
export interface CLIIO {
    env: Env
    stdout: {write(data: string | Uint8Array): unknown}
    stderr: {write(data: string): unknown}
    fetch?: WayuseClient.ClientOptions["fetch"]
    /** Loads the package of a subcommand. Default: the one the project has, or else the one beside this package. */
    load?: (name: string) => Promise<CommandPackage>
}

/** A package that holds a subcommand. Its CLI() takes the arguments after the subcommand, and resolves to the exit code. */
export interface CommandPackage {
    CLI(options: {args: string[]}): Promise<number>
}

/** The options of the commands that call the server, as parseArgs gives them. */
export interface ApiValues {
    output?: string
    slot?: string
    size?: string
    context?: string
    add?: boolean
    tab?: string
    button?: string
}

/** Wrong arguments: they end in the reason, the usage and exit code 2. */
export class UsageError extends Error {
}

export const printJson = (io: CLIIO, value: unknown): void => {
    io.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

// A capture is written as it is, to the file or else to the standard output for a pipe.
export const writeOutput = (io: CLIIO, file: string | undefined, data: string | Uint8Array): Promise<void> | void =>
    (file ? writeFile(file, data) : void io.stdout.write(data))

// Two whole numbers, as both click commands take a pixel.
export const pointOf = (args: string[], usage: string): {x: number, y: number} => {
    const [x, y] = args.map(Number)
    if (args.length !== 2 || !Number.isInteger(x) || !Number.isInteger(y)) throw new UsageError(usage)
    return {x: x!, y: y!}
}
