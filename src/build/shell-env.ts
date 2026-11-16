// Single quotes keep every character as it is, so a value can never run as shell.
const quote = (value: string): string => `'${value.replaceAll("'", "'\\''")}'`

/**
 * Environment variables as a file a shell script sources.
 */
export const shellEnvOf = (env: Record<string, string>): string =>
    Object.entries(env).map(([name, value]) => `${name}=${quote(value)}\n`).join("")
