import type {Context, MiddlewareHandler} from "hono"
import type {WayuseClient} from "wayuse-client"
import {type AuthOptions, verifyJwt} from "./jwt-verify.ts"

/** The Hono environment of a route behind jwtCheck(). */
export type AuthEnv = {Variables: {jwt: WayuseClient.JwtClaims}}

/** Answers a request that has no valid token, in the form the application's other errors have. */
type Refuse = (c: Context<AuthEnv>) => Response | Promise<Response>

/**
 * Lets a request through only with a valid Bearer token, whose claims the handler reads as c.get("jwt").
 */
export const jwtCheck = (options: AuthOptions, refuse: Refuse): MiddlewareHandler<AuthEnv> => async (c, next) => {
    const jwt = c.req.header("authorization")?.match(/^Bearer\s+(\S+)$/)?.[1]
    const claims = jwt && verifyJwt(jwt, options)
    if (!claims) {
        // A 401 has to name the scheme the server wants.
        c.header("WWW-Authenticate", "Bearer")
        return refuse(c)
    }
    c.set("jwt", claims)
    await next()
}
