import type {MiddlewareHandler} from "hono"
import type {WayuseClient} from "wayuse-client"
import {type AuthOptions, verifyJwt} from "./jwt-verify.ts"

/** The Hono environment of a route behind jwtCheck(). */
export type AuthEnv = {Variables: {jwt: WayuseClient.JwtClaims}}

// A 401 has to name the scheme the server wants.
const UNAUTHORIZED = 401
const CHALLENGE = {"WWW-Authenticate": "Bearer"}

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
