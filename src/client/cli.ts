import {parseArgs} from "node:util"
import type * as declared from "wayuse-client"
import {DEFAULT_AUDIENCE} from "../jwt/jwt-format.ts"
import {generateKeyPair, publicKeyOf, signJwt} from "./jwt-sign.ts"
import {VERSION} from "./version.ts"

const USAGE = [
    "Usage: wayuse <command> [options]",
    "  jwt keygen                    print a new key pair, as lines for an .env file",
    "  jwt public-key                print the public key of WAYUSE_JWT_PRIVATE_KEY",
    "  jwt sign --sub <subject> [--claim <name>[=<value>]]...",
    "                                print a JWT signed with WAYUSE_JWT_PRIVATE_KEY, for WAYUSE_JWT_AUDIENCE",
    "  -v, --version                 print this package's version",
    "  -h, --help                    print this usage",
].map(line => `${line}\n`).join("")

const EXIT_USAGE = 2

class UsageError extends Error {
}

// The private key comes by the environment alone: an argument would show in `ps` and in the shell's history.
const privateKeyOf = (env: NodeJS.ProcessEnv): string => {
    const key = env.WAYUSE_JWT_PRIVATE_KEY
    if (!key) throw new UsageError("WAYUSE_JWT_PRIVATE_KEY is not set")
    return key
}

// `--claim admin` is a flag set to true, `--claim name=value` a string.
const claimsOf = (items: string[]): Record<string, unknown> => {
    const claims: Record<string, unknown> = {}
    for (const item of items) {
        const at = item.indexOf("=")
        const name = at < 0 ? item : item.slice(0, at)
        if (!name) throw new UsageError(`--claim takes <name>[=<value>]: ${item}`)
        claims[name] = at < 0 ? true : item.slice(at + 1)
    }
    return claims
}

const runJwt = (command: string | undefined, values: {sub?: string, claim?: string[]}, env: NodeJS.ProcessEnv): string => {
    if (command === "keygen") {
        const {privateKey, publicKey} = generateKeyPair()
        return `WAYUSE_JWT_PRIVATE_KEY=${privateKey}\nWAYUSE_JWT_PUBLIC_KEY=${publicKey}\n`
    }

    if (command === "public-key") {
        return `WAYUSE_JWT_PUBLIC_KEY=${publicKeyOf(privateKeyOf(env))}\n`
    }

    if (command === "sign") {
        if (!values.sub) throw new UsageError("--sub is required")
        const aud = env.WAYUSE_JWT_AUDIENCE || DEFAULT_AUDIENCE
        return `${signJwt({...claimsOf(values.claim ?? []), aud, sub: values.sub}, privateKeyOf(env))}\n`
    }

    throw new UsageError(`unknown command: jwt ${command ?? ""}`)
}

export const CLI: typeof declared.CLI = async ({args, env = process.env}) => {
    try {
        const {positionals, values} = parseArgs({
            args,
            allowPositionals: true,
            options: {
                sub: {type: "string"},
                claim: {type: "string", multiple: true},
                version: {type: "boolean", short: "v"},
                help: {type: "boolean", short: "h"},
            },
        })

        const [group, command] = positionals

        if (values.help) {
            process.stdout.write(USAGE)
        } else if (values.version) {
            process.stdout.write(`wayuse-client ${VERSION}\n`)
        } else if (group === "jwt") {
            process.stdout.write(runJwt(command, values, env))
        } else {
            throw new UsageError(group ? `unknown command: ${group}` : "")
        }

        return 0
    } catch (error) {
        // parseArgs reports an unknown option as a TypeError with a code of its own.
        if (!(error instanceof UsageError) && !(error instanceof TypeError && "code" in error)) throw error
        if (error.message) process.stderr.write(`${error.message}\n`)
        process.stderr.write(USAGE)
        return EXIT_USAGE
    }
}
