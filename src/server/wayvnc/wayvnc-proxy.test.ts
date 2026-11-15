import assert from "node:assert/strict"
import http from "node:http"
import type net from "node:net"
import {after, before, describe, it} from "node:test"
import {ApiError, createClient} from "../../api/api-client.ts"
import {createFakeServer} from "../../test-utils/fake-server.ts"
import {type FakeWayvnc, createFakeWayvnc} from "../../test-utils/fake-wayvnc.ts"
import {VNC_TICKET_TTL, createVncTickets} from "./vnc-ticket.ts"
import {createWayvncProxy} from "./wayvnc-proxy.ts"

const TITLE = "server/wayvnc/wayvnc-proxy.test.ts"

// Opens a WebSocket and resolves to it, or rejects when the server answers the upgrade with anything else.
const connect = (url: string) => new Promise<WebSocket>((resolve, reject) => {
    const ws = new WebSocket(url)
    ws.binaryType = "arraybuffer"
    ws.addEventListener("open", () => resolve(ws), {once: true})
    ws.addEventListener("error", () => reject(new Error("refused")), {once: true})
})

const nextMessage = (ws: WebSocket) => new Promise<Buffer>(resolve => {
    ws.addEventListener("message", event => resolve(Buffer.from(event.data as ArrayBuffer)), {once: true})
})

describe(TITLE, () => {
    it("issues a ticket that is taken once, and not after it expires", () => {
        let now = 1000
        const tickets = createVncTickets(() => now)

        const first = tickets.issue(2)
        assert.match(first, /^[0-9a-f-]{36}$/)
        assert.equal(tickets.take(first), 2)
        assert.equal(tickets.take(first), undefined)
        assert.equal(tickets.take("nosuch"), undefined)

        const late = tickets.issue(1)
        now += VNC_TICKET_TTL * 1000
        assert.equal(tickets.take(late), undefined)
    })

    // The relay as the server mounts it, between a real WebSocket and a wayvnc that only shakes hands.
    describe("over a WebSocket", () => {
        const tickets = createVncTickets()
        const lines: string[] = []
        let wayvnc: FakeWayvnc
        let server: http.Server
        let origin: string
        let vncPort: number

        before(async () => {
            wayvnc = await createFakeWayvnc()
            vncPort = wayvnc.port
            server = http.createServer().on("upgrade", createWayvncProxy({tickets, vncPort: () => vncPort, log: line => lines.push(line)}))
            await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve))
            origin = `ws://127.0.0.1:${(server.address() as net.AddressInfo).port}`
        })

        after(async () => {
            server.closeAllConnections()
            await new Promise(resolve => server.close(resolve))
            await wayvnc.close()
        })

        it("relays both ways between the WebSocket and the wayvnc of the ticket", async () => {
            const ws = await connect(`${origin}/wayvnc/${tickets.issue(1)}`)

            // wayvnc speaks first, and its greeting comes through as a binary message.
            assert.equal((await nextMessage(ws)).toString(), "RFB 003.008\n")

            ws.send(Buffer.from("RFB 003.008\n"))
            assert.deepEqual([...await nextMessage(ws)], [1, 1])

            ws.close()
            await wayvnc.received()
        })

        it("refuses a ticket that was used, one it never issued, and any other path", async () => {
            const ticket = tickets.issue(1)
            const ws = await connect(`${origin}/wayvnc/${ticket}`)
            ws.close()

            await assert.rejects(connect(`${origin}/wayvnc/${ticket}`), /refused/)
            await assert.rejects(connect(`${origin}/wayvnc/00000000-0000-0000-0000-000000000000`), /refused/)
            await assert.rejects(connect(`${origin}/slot/HEADLESS-1`), /refused/)
        })

        it("refuses while the wayvnc cannot be reached, and logs why", async () => {
            const closed = await createFakeWayvnc()
            await closed.close()
            vncPort = closed.port
            await assert.rejects(connect(`${origin}/wayvnc/${tickets.issue(1)}`), /refused/)
            vncPort = wayvnc.port
            assert.match(lines.join("\n"), /^wayvnc HEADLESS-1 .*ECONNREFUSED/m)
        })
    })

    it("createVncTicket() issues a ticket the relay takes, with the WebSocket's URL beside the server's", async () => {
        const tickets = createVncTickets()
        const server = createFakeServer({tickets})

        const plain = await createClient({url: "http://wayuse.test/", token: server.jwt, fetch: server.fetch}).createVncTicket("HEADLESS-2")
        assert.match(plain.path, /^wayvnc\/[0-9a-f-]{36}$/)
        assert.equal(plain.expires_in, 30)
        assert.equal(plain.url, `ws://wayuse.test/${plain.path}`)
        assert.equal(tickets.take(plain.path.slice("wayvnc/".length)), 2)

        // Behind a reverse proxy the prefix and the scheme follow the server's URL.
        const prefixed = createClient({
            url: "https://wayuse.test/some/prefix/", token: server.jwt,
            fetch: (input, init) => server.fetch(new URL(input.pathname.replace("/some/prefix", ""), input), init),
        })
        const secure = await prefixed.createVncTicket("HEADLESS-1")
        assert.equal(secure.url, `wss://wayuse.test/some/prefix/${secure.path}`)

        const refused = createClient({url: "http://wayuse.test/", token: server.jwt, fetch: server.fetch}).createVncTicket("HEADLESS-9")
        await assert.rejects(refused, (error: unknown) => error instanceof ApiError && error.status === 404)
    })
})
