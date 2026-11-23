/** https://github.com/kawanet/wayuse */

export {} // external module indicator

export declare namespace WayuseBuild {

    /** The default export of wayuse.config.ts. Every item may be left out. */
    interface Config {
        /** Where the build directory is written. */
        output?: OutputConfig
        /** Node.js in the image. */
        node?: NodeConfig
        /** Applications in the image. One without a key is not installed. */
        apps?: AppsConfig
        /** IANA time zone of the whole container, such as "Asia/Tokyo". Default: "Etc/UTC". */
        timezone?: string
        /** The size a screen has until a client resizes it, and the bounds of a resize. */
        screen?: ScreenConfig
        /** Additional apt packages, fonts among them. */
        packages?: string[]
        /** `false` builds an image whose server asks for no token: every API is open to whoever reaches its port. */
        auth?: false
        /** The console's pages. `false` leaves the console out of the image, which then has the API alone. */
        console?: ConsoleConfig | false
    }

    interface OutputConfig {
        /** The build directory to write, from the current directory. `--dir` of the command comes ahead of it, and one of the two is required. */
        dir?: string
    }

    interface NodeConfig {
        /** A full version such as "24.11.1". Ranges and aliases are refused. Default: the Node.js that runs @wayuse/build. */
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
        /** Chrome's managed policies, under Chrome's own names. Given, they replace the defaults, which keep Chrome to one profile. */
        policies?: Record<string, unknown>
    }

    interface RedirConfig {
        /** The ports to listen on, each with where it forwards to. {9223: "127.0.0.1:9222"} forwards port 9223 to Chrome DevTools Protocol. */
        ports: Record<number, string>
    }

    interface ScreenConfig {
        /** Default: 1280. */
        width?: number
        /** Default: 960. */
        height?: number
        /** The smallest size a client may resize a screen to. Default: 768. */
        minWidth?: number
        /** Default: 768. */
        minHeight?: number
        /** The largest size a client may resize a screen to. A larger screen takes more of /dev/shm. Default: 1920. */
        maxWidth?: number
        /** Default: 1920. */
        maxHeight?: number
    }

    interface ConsoleConfig {
        /** Where the entry sends a visitor without a token, on the console's own origin. The path to come back to is added at its end. Default: the entry asks for a token. */
        signIn?: string
        /** What the pages show where their HTML has {{name}}: `icon` and `title` in the header. A value is text, and anyone can read it in the page. */
        vars?: Record<string, string>
        /** Whether the scripts of the pages, and the packages they load, are made small with terser. Default: true. */
        terser?: boolean
    }

    interface CLIOptions {
        /** The arguments as the executable gets them: process.argv.slice(2). `wayuse build` gives those after `build`. */
        args: string[]
    }
}

/** Returns the configuration as given. It only brings the types to wayuse.config.ts. */
export declare function defineConfig(config: WayuseBuild.Config): WayuseBuild.Config

/** Runs the command line once per process and resolves to its exit code. The caller ends the process. */
export declare function CLI(options: WayuseBuild.CLIOptions): Promise<number>
