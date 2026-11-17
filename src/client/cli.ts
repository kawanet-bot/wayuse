import {parseArgs} from "node:util"
import type * as declared from "wayuse"
import {ApiError} from "../api/api-client.ts"
import {DEFAULT_URL, runApi} from "./cli-api.ts"
import {type CLIIO, UsageError} from "./cli-io.ts"
import {runJwt} from "./cli-jwt.ts"
import {packageOf, runPackage} from "./cli-package.ts"
import {VERSION} from "./version.ts"

// The commands this package has. Any other belongs to a package of its own, which a project installs by itself.
const COMMANDS = ["auth", "config", "status", "slot", "clipboard", "chrome", "jwt"]

const USAGE = `
Usage: wayuse <command> [options]
  build [options]                 write the Docker build directory, with @wayuse/build
  <name> [options]                any other command is that of @wayuse/<name>, where the project has it installed
  auth me                         print the claims of WAYUSE_JWT, as the server reads them
  config                          print the configuration the image was built from
  slot list                       print every screen
  slot show [--slot <slot>]       print one screen
  slot capture [--slot <slot>] [-o <file>]
                                  write a PNG of one screen (default: to the standard output)
  slot clear [--slot <slot>]      close every window on one screen
  slot click <x> <y> [--slot <slot>] [--button <button>]
                                  click a pixel of the screen's capture, whatever is there
  slot key <keys> [--slot <slot>] send keys to the screen: "ctrl+l .. ctrl+v .. Return"
  slot vnc [--slot <slot>]        issue a one-time ticket, and print the WebSocket URL a VNC client connects to
  clipboard get                   print the text on the clipboard
  clipboard set <text>            put the text on the clipboard
  status                          print the load and the memory of the host
  chrome list                     print every tab of Chrome
  chrome open <url> [--slot <slot>] [--size <width>x<height>] [--context temporary] [--add]
                                  open the URL in a new window that replaces what is on the slot,
                                  or with --add in one more window over it
  chrome show [--tab <id>]        print one tab
  chrome close [--tab <id>]       close one tab
  chrome capture [--tab <id>] [-o <file>]
                                  write a JPEG of what one tab shows
  chrome html [--tab <id>] [-o <file>]
                                  write the tab's DOM as lightened HTML
  chrome click <x> <y> [--tab <id>] [--button <button>]
                                  click a pixel of the tab's capture
  chrome eval <expression> [--tab <id>]
                                  evaluate JavaScript in the tab's page, and print the result
  jwt keygen                      print a new key pair, as lines for an .env file
  jwt public-key                  print the public key of WAYUSE_JWT_PRIVATE_KEY
  jwt sign --sub <subject> [--claim <name>[=<value>]]...
                                  print a JWT signed with WAYUSE_JWT_PRIVATE_KEY, for WAYUSE_JWT_AUDIENCE
  -v, --version                   print this package's version
  -h, --help                      print this usage
--slot is the first screen when left out. --tab may be left out while Chrome has one tab.
Environment:
  WAYUSE_URL                      where the server is reached (default: ${DEFAULT_URL})
  WAYUSE_JWT                      the token sent with each request
`.trimStart()

const EXIT_FAILURE = 1
const EXIT_USAGE = 2

/**
 * The command line with everything it touches passed in. CLI() below fills in the process's own.
 */
export const runCLI = async (args: string[], io: CLIIO): Promise<number> => {
    try {
        // What follows the command is for the other package, whose options the parser below would refuse.
        const other = COMMANDS.includes(args[0]!) ? undefined : packageOf(args[0])
        if (other) return await runPackage(other, args.slice(1), io)

        const {positionals, values} = parseArgs({
            args,
            allowPositionals: true,
            options: {
                sub: {type: "string"},
                claim: {type: "string", multiple: true},
                output: {type: "string", short: "o"},
                slot: {type: "string"},
                size: {type: "string"},
                context: {type: "string"},
                add: {type: "boolean"},
                tab: {type: "string"},
                button: {type: "string"},
                version: {type: "boolean", short: "v"},
                help: {type: "boolean", short: "h"},
            },
        })

        if (values.help) {
            io.stdout.write(USAGE)
        } else if (values.version) {
            io.stdout.write(`wayuse ${VERSION}\n`)
        } else if (positionals[0] === "jwt") {
            io.stdout.write(runJwt(positionals[1], values, io.env))
        } else {
            await runApi(positionals, values, io)
        }

        return 0
    } catch (error) {
        // The server's refusal is the whole story: a stack trace would bury it.
        if (error instanceof ApiError) {
            io.stderr.write(`${error.status} ${error.message}\n`)
            return EXIT_FAILURE
        }

        // fetch() hides why it could not connect in the cause, which is the line worth showing.
        if (error instanceof TypeError && error.cause instanceof Error) {
            io.stderr.write(`${error.cause.message}\n`)
            return EXIT_FAILURE
        }

        // parseArgs reports an unknown option as a TypeError with a code of its own.
        if (!(error instanceof UsageError) && !(error instanceof TypeError && "code" in error)) throw error
        if (error.message) io.stderr.write(`${error.message}\n`)
        io.stderr.write(USAGE)
        return EXIT_USAGE
    }
}

export const CLI: typeof declared.CLI = ({args, env = process.env}) =>
    runCLI(args, {env, stdout: process.stdout, stderr: process.stderr})
