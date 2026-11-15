import type {WayuseClient} from "wayuse-client"
import type {Exec} from "./exec.ts"
import type {SwayLocks} from "./sway/sway-lock.ts"

/** What the routes share: everything outside the process they reach, and the state of this one server. */
export interface ServerDeps {
    /** The resolved configuration the image was built from. */
    config: WayuseClient.Config
    /** Runs sway's, wayvnc's and grim's commands. */
    exec: Exec
    /** XDG_RUNTIME_DIR, where wayvnc-start.sh puts the control socket of each wayvnc. */
    runtimeDir: string
    /** Where Chrome's DevTools Protocol is reached. */
    cdpOrigin: string
    locks: SwayLocks
    /** One line to the server's log, for what changes a screen. */
    log(message: string): void
}
