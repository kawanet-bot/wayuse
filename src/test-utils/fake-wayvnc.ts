// A wayvnc for the tests: the RFB handshake a client needs before input, and a record of what it sends after.

import net from "node:net"

export interface FakeWayvnc {
    port: number
    /** Everything the clients sent after ClientInit, once every connection has closed: the last bytes arrive after the client is done. */
    received(): Promise<Buffer>
    close(): Promise<void>
}

export const createFakeWayvnc = async (): Promise<FakeWayvnc> => {
    const chunks: Buffer[] = []
    const closed: Promise<void>[] = []

    const server = net.createServer(socket => {
        closed.push(new Promise(resolve => socket.on("close", () => resolve())))
        let step = 0
        socket.write("RFB 003.008\n")
        socket.on("data", data => {
            if (step === 0) {
                // One security type, None.
                socket.write(Buffer.from([1, 1]))
            } else if (step === 1) {
                // SecurityResult: OK.
                socket.write(Buffer.alloc(4))
            } else if (step === 2) {
                // ServerInit, of which a client that asks for no picture reads nothing.
                socket.write(Buffer.alloc(24))
            } else {
                chunks.push(data)
            }
            step++
        })
    })

    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve))

    return {
        port: (server.address() as net.AddressInfo).port,
        received: async () => {
            await Promise.all(closed)
            return Buffer.concat(chunks)
        },
        close: () => new Promise(resolve => server.close(() => resolve())),
    }
}
