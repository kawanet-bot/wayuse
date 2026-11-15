// What the signer and the verifier must agree on, kept in one place so neither can drift from the other.

// The verifier compares this whole string, which shuts out `alg: none` and any other algorithm.
export const JWT_HEADER = Buffer.from(JSON.stringify({alg: "EdDSA", typ: "JWT"})).toString("base64url")

/** The audience both sides take when WAYUSE_JWT_AUDIENCE is not set. */
export const DEFAULT_AUDIENCE = "wayuse"
