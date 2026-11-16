import {createPrivateKey, createPublicKey, generateKeyPairSync, sign} from "node:crypto"
import type * as declared from "wayuse-client"
import {JWT_HEADER} from "./jwt-format.ts"

// Keys travel as one line of base64 over DER, the form an environment variable carries.
const parsePrivateKey = (privateKey: string) => {
    const key = createPrivateKey({key: Buffer.from(privateKey, "base64"), format: "der", type: "pkcs8"})
    if (key.asymmetricKeyType !== "ed25519") throw new Error(`the private key must be Ed25519: ${key.asymmetricKeyType}`)
    return key
}

export const publicKeyOf: typeof declared.publicKeyOf = privateKey =>
    createPublicKey(parsePrivateKey(privateKey)).export({format: "der", type: "spki"}).toString("base64")

export const generateKeyPair: typeof declared.generateKeyPair = () => {
    const privateKey = generateKeyPairSync("ed25519").privateKey.export({format: "der", type: "pkcs8"}).toString("base64")
    return {privateKey, publicKey: publicKeyOf(privateKey)}
}

export const signJwt: typeof declared.signJwt = (claims, privateKey) => {
    // A claim given as undefined is left out by JSON.stringify, so a caller may pass optional ones as they are.
    const payload = {iat: Math.floor(Date.now() / 1000), ...claims}
    const input = `${JWT_HEADER}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}`
    const signature = sign(null, Buffer.from(input), parsePrivateKey(privateKey))
    return `${input}.${signature.toString("base64url")}`
}
