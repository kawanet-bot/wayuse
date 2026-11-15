/** https://github.com/kawanet/wayuse */

export {} // external module indicator

export declare namespace WayuseServer {

    interface CLIOptions {
        /** The arguments as the executable gets them: process.argv.slice(2). */
        args: string[]
    }
}

/** Runs the server and resolves to its exit code once it is closed. The caller ends the process. */
export declare function CLI(options: WayuseServer.CLIOptions): Promise<number>
