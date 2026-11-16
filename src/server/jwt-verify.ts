import type {MiddlewareHandler} from "hono"
import {type KeyObject, createPublicKey, verify} from "node:crypto"
import type {WayuseClient} from "wayuse-client"
import {JWT_HEADER} from "../jwt/jwt-format.ts"

type Claims = WayuseClient.JwtClaims

export interface AuthOptions {
    /** Without a key no token can be verified, so every API behind the check is refused. */
    publicKey?: KeyObject
    audience: string
}

/** The Hono environment of a route behind jwtCheck(). */
export type AuthEnv = {Variables: {jwt: Claims}}

// A 401 has to name the scheme the server wants.
const UNAUTHORIZED = 401
const CHALLENGE = {"WWW-Authenticate": "Bearer"}

export const parsePublicKey = (base64: string): KeyObject => {
    const key = createPublicKey({key: Buffer.from(base64, "base64"), format: "der", type: "spki"})
    // verify() below names no algorithm, so the key's own type is what fixes it.
    if (key.asymmetricKeyType !== "ed25519") throw new Error(`the public key must be Ed25519: ${key.asymmetricKeyType}`)
    return key
}

/**
 * The claims of a token this server accepts, or undefined for any other.
 */
export const verifyJwt = (jwt: string, {publicKey, audience}: AuthOptions, now: number = Date.now()): Claims | undefined => {
    if (!publicKey) return

    const [header, payload, signature, ...rest] = jwt.split(".")
    if (header !== JWT_HEADER || !payload || !signature || rest.length) return

    if (!verify(null, Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature, "base64url"))) return

    let claims: Claims
    try {
        claims = JSON.parse(Buffer.from(payload, "base64url").toString())
    } catch {
        return
    }

    if (claims?.aud !== audience || typeof claims.sub !== "string" || !claims.sub) return

    // exp is optional, but one that is given is honored, as any JWT library would.
    if (claims.exp != null && !(typeof claims.exp === "number" && now < claims.exp * 1000)) return

    return claims
}

/**
 * Lets a request through only with a valid Bearer token, whose claims the handler reads as c.get("jwt").
 */
export const jwtCheck = (options: AuthOptions): MiddlewareHandler<AuthEnv> => async (c, next) => {
    const jwt = c.req.header("authorization")?.match(/^Bearer\s+(\S+)$/)?.[1]
    const claims = jwt && verifyJwt(jwt, options)
    if (!claims) return c.json({error: {message: "invalid token"}}, UNAUTHORIZED, CHALLENGE)
    c.set("jwt", claims)
    await next()
}
