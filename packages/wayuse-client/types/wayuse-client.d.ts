/** https://github.com/kawanet/wayuse */

export {} // external module indicator

export declare namespace WayuseClient {

    /** What the image was defined to hold, with every default filled in. Baked in as /etc/wayuse/wayuse.json. */
    interface Config {
        /** The wayuse-builder that filled in the defaults. */
        builder: {version: string}
        node: {version: string}
        /** The installed applications. A key is present only for an installed one. */
        apps: {chrome?: ChromeConfig}
        timezone: string
        /** The size a screen has until a client resizes it. */
        screen: {width: number, height: number}
        packages: string[]
    }

    interface ChromeConfig {
        channel: "stable" | "beta" | "unstable"
        env: Record<string, string>
    }

    /** The claims wayuse-server reads. Any other claim passes through to GET /auth/me. */
    interface JwtClaims {
        /** Must equal the server's WAYUSE_JWT_AUDIENCE. */
        aud: string
        /** Who the token was issued to. */
        sub: string
        /** Seconds since the epoch. */
        iat: number
        /** Seconds since the epoch. A token without it never expires. */
        exp?: number
        [name: string]: unknown
    }

    /** The claims to sign. iat is the current time unless given. */
    type JwtInput = Omit<JwtClaims, "iat"> & {iat?: number}

    /** An Ed25519 key pair, each key one line of base64: PKCS#8 for the private key, SPKI for the public key. */
    interface KeyPair {
        privateKey: string
        publicKey: string
    }

    interface CLIOptions {
        /** The arguments as the executable gets them: process.argv.slice(2). */
        args: string[]
        /** Where WAYUSE_JWT_PRIVATE_KEY and WAYUSE_JWT_AUDIENCE are read from. Default: process.env. */
        env?: Record<string, string | undefined>
    }
}

/** Makes a new key pair. The private key stays with whoever signs, and the public key goes to the container. */
export declare function generateKeyPair(): WayuseClient.KeyPair

/** The public key that belongs to a private key. */
export declare function publicKeyOf(privateKey: string): string

/** Signs a JWT that wayuse-server verifies with the public key. */
export declare function signJwt(claims: WayuseClient.JwtInput, privateKey: string): string

/** Runs the command line once per process and resolves to its exit code. The caller ends the process. */
export declare function CLI(options: WayuseClient.CLIOptions): Promise<number>
