import {DEFAULT_AUDIENCE} from "../jwt/jwt-format.ts"
import {type Env, UsageError} from "./cli-io.ts"
import {generateKeyPair, publicKeyOf, signJwt} from "./jwt-sign.ts"

// The private key comes by the environment alone: an argument would show in `ps` and in the shell's history.
const privateKeyOf = (env: Env): string => {
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

/**
 * The jwt commands, which need the keys and never the server.
 */
export const runJwt = (command: string | undefined, values: {sub?: string, claim?: string[]}, env: Env): string => {
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
