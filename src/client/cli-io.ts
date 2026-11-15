import type {WayuseClient} from "wayuse-client"

export type Env = Record<string, string | undefined>

/** What a command line touches besides its arguments, so a test stands in for each. */
export interface CLIIO {
    env: Env
    stdout: {write(data: string | Uint8Array): unknown}
    stderr: {write(data: string): unknown}
    fetch?: WayuseClient.ClientOptions["fetch"]
}

/** Wrong arguments: they end in the reason, the usage and exit code 2. */
export class UsageError extends Error {
}
