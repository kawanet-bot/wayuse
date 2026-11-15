import {parseArgs} from "node:util"
import type * as declared from "wayuse-client"
import {ApiError} from "../api/api-client.ts"
import {runApi} from "./cli-api.ts"
import {type CLIIO, UsageError} from "./cli-io.ts"
import {runJwt} from "./cli-jwt.ts"
import {VERSION} from "./version.ts"

const USAGE = [
    "Usage: wayuse <command> [options]",
    "  auth me                         print the claims of WAYUSE_JWT, as the server reads them",
    "  config                          print the configuration the image was built from",
    "  slot list                       print every screen",
    "  slot show [<slot>]              print one screen",
    "  slot capture [<slot>] [-o <file>]",
    "                                  write a PNG of one screen (default: to the standard output)",
    "  jwt keygen                      print a new key pair, as lines for an .env file",
    "  jwt public-key                  print the public key of WAYUSE_JWT_PRIVATE_KEY",
    "  jwt sign --sub <subject> [--claim <name>[=<value>]]...",
    "                                  print a JWT signed with WAYUSE_JWT_PRIVATE_KEY, for WAYUSE_JWT_AUDIENCE",
    "  -v, --version                   print this package's version",
    "  -h, --help                      print this usage",
    "<slot> may be left out while the container has one screen.",
    "Environment:",
    "  WAYUSE_URL                      where the server is reached (default: http://127.0.0.1:3000/)",
    "  WAYUSE_JWT                      the token sent with each request",
].map(line => `${line}\n`).join("")

const EXIT_FAILURE = 1
const EXIT_USAGE = 2

/**
 * The command line with everything it touches passed in. CLI() below fills in the process's own.
 */
export const runCLI = async (args: string[], io: CLIIO): Promise<number> => {
    try {
        const {positionals, values} = parseArgs({
            args,
            allowPositionals: true,
            options: {
                sub: {type: "string"},
                claim: {type: "string", multiple: true},
                output: {type: "string", short: "o"},
                version: {type: "boolean", short: "v"},
                help: {type: "boolean", short: "h"},
            },
        })

        if (values.help) {
            io.stdout.write(USAGE)
        } else if (values.version) {
            io.stdout.write(`wayuse-client ${VERSION}\n`)
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
