import type {WayuseClient} from "wayuse"
import type {Exec} from "./exec.ts"
import type {SwayLocks} from "./sway/sway-lock.ts"
import type {VncTickets} from "./wayvnc/vnc-ticket.ts"

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
    /** The port the wayvnc of HEADLESS-n listens on. */
    vncPort(n: number): number
    locks: SwayLocks
    /** Shared with the WebSocket relay, which takes the tickets the routes issue. */
    tickets: VncTickets
    /** One line to the server's log, for what changes a screen. */
    log(message: string): void
}
