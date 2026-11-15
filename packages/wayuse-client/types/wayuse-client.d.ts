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
}
