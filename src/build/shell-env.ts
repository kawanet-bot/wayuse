// In double quotes, a backslash keeps each of \ $ ` and " as it is, so a value can never run as shell.
const quote = (value: string): string => `"${value.replace(/[\\$`"]/g, "\\$&")}"`

/**
 * Lines that export each variable with its value as the default. A value the process already has, and not empty, wins.
 */
export const shellDefaultsOf = (env: Record<string, string>): string =>
    Object.entries(env).map(([name, value]) => `export ${name}=\${${name}:-${quote(value)}}\n`).join("")
