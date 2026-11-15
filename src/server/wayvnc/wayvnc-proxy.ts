import type {IncomingMessage} from "node:http"
import net from "node:net"
import type {Duplex} from "node:stream"
import {pipeline} from "node:stream/promises"
import {WebSocketServer, createWebSocketStream} from "ws"
import type {VncTickets} from "./vnc-ticket.ts"

export interface WayvncProxyOptions {
    tickets: VncTickets
    /** The port the wayvnc of HEADLESS-n listens on. */
    vncPort(n: number): number
    log(message: string): void
}

const TICKET_PATH = /^\/wayvnc\/([0-9a-f-]{36})$/

const refuse = (socket: Duplex, status: string): void => {
    socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`)
}

/**
 * The handler of the HTTP server's "upgrade": relays a WebSocket at /wayvnc/<ticket> to the TCP of the ticket's wayvnc.
 */
export const createWayvncProxy = ({tickets, vncPort, log}: WayvncProxyOptions) => {
    const wss = new WebSocketServer({noServer: true, perMessageDeflate: false})

    // A browser's WebSocket cannot carry an Authorization header, so the path's one-time ticket stands in for the token.
    return (req: IncomingMessage, socket: Duplex, head: Buffer): void => {
        const ticket = TICKET_PATH.exec(req.url ?? "")?.[1]
        if (!ticket) return refuse(socket, "404 Not Found")
        const n = tickets.take(ticket)
        if (!n) return refuse(socket, "403 Forbidden")

        // The path's UUID tells nobody which screen it is, so the log names the output.
        const name = `wayvnc HEADLESS-${n}`

        // wayvnc is connected first, so one that cannot be reached is a 502 rather than a WebSocket that closes at once.
        let upgraded = false
        const tcp = net.connect(vncPort(n), "127.0.0.1")
        tcp.on("error", error => {
            log(`${name} ${error}`)
            if (!upgraded) refuse(socket, "502 Bad Gateway")
        })

        // The browser may leave before the upgrade, and then wayvnc is not left with a client that never speaks.
        socket.once("close", () => {
            if (!upgraded) tcp.destroy()
        })

        tcp.once("connect", () => {
            wss.handleUpgrade(req, socket, head, ws => {
                upgraded = true
                const started = Date.now()
                const stream = createWebSocketStream(ws)
                const close = () => {
                    tcp.destroy()
                    stream.destroy()
                }

                // Both ways at once, and when either side closes the other goes too.
                void Promise.all([
                    pipeline(tcp, stream).catch(close),
                    pipeline(stream, tcp).catch(close),
                ]).finally(() => log(`${name} closed ${tcp.bytesRead} bytes ${Date.now() - started} ms`))
            })
        })
    }
}
