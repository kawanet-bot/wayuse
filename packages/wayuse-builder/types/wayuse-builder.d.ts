/** https://github.com/kawanet/wayuse */

export {} // external module indicator

export declare namespace WayuseBuilder {

    /** The default export of wayuse.config.ts. Every item may be left out. */
    interface Config {
        /** Node.js in the image. */
        node?: NodeConfig
        /** Applications in the image. One without a key is not installed. */
        apps?: AppsConfig
        /** IANA time zone of the whole container, such as "Asia/Tokyo". Default: "Etc/UTC". */
        timezone?: string
        /** The size a screen has until a client resizes it. */
        screen?: ScreenConfig
        /** Additional apt packages, fonts among them. */
        packages?: string[]
    }

    interface NodeConfig {
        /** A full version such as "24.11.1". Ranges and aliases are refused. Default: the Node.js that runs wayuse-build. */
        version?: string
    }

    interface AppsConfig {
        chrome?: ChromeConfig
        redir?: RedirConfig
    }

    interface ChromeConfig {
        /** Default: "stable". */
        channel?: "stable" | "beta" | "unstable"
        /** Environment variables for the Chrome process alone. They are baked into the image, so no secrets. */
        env?: Record<string, string>
    }

    interface RedirConfig {
        /** The arguments of redir. ":9223 127.0.0.1:9222" forwards port 9223 to Chrome DevTools Protocol. */
        args: string
    }

    interface ScreenConfig {
        /** Default: 1280. */
        width?: number
        /** Default: 960. */
        height?: number
    }

    interface CLIOptions {
        /** The arguments as the executable gets them: process.argv.slice(2). */
        args: string[]
    }
}

/** Returns the configuration as given. It only brings the types to wayuse.config.ts. */
export declare function defineConfig(config: WayuseBuilder.Config): WayuseBuilder.Config

/** Runs the command line once per process and resolves to its exit code. The caller ends the process. */
export declare function CLI(options: WayuseBuilder.CLIOptions): Promise<number>
