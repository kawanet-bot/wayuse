import net from "node:net"
import type {ServerDeps} from "../deps.ts"
import {HttpError} from "../http-error.ts"
import type {Key} from "../input/key-sequence.ts"
import {swaymsg} from "../sway/swaymsg.ts"
import {waitFor} from "../utils/wait-for.ts"
import {keyEventMessage, pointerEventMessage, qemuKeyEventMessage, setEncodingsMessage} from "./rfb-message.ts"

// The bits of wl_seat's capabilities.
const SEAT_POINTER = 1
const SEAT_KEYBOARD = 2
const SEAT_READY = SEAT_POINTER | SEAT_KEYBOARD

/** Input sent over one VNC connection, so that modifiers and clicks keep their order. */
export interface VncInput {
    key(key: Key, down: boolean): void
    pointer(x: number, y: number, buttonMask: number): void
}

// The RFB 3.8 handshake with no authentication, up to ServerInit. No update is asked for, so wayvnc sends no picture.
const connectRFB = (port: number) => new Promise<net.Socket>((resolve, reject) => {
    const socket = net.connect(port, "127.0.0.1")
    const fail = (message: string) => {
        socket.destroy()
        // wayvnc is started again by the supervisor, so the client may try again.
        reject(new HttpError(503, `wayvnc ${port}: ${message}`))
    }
    let step = 0

    socket.on("error", error => fail(String(error)))
    socket.setTimeout(1000, () => fail("timeout"))
    socket.on("data", buf => {
        if (step === 0) {
            if (!buf.toString().startsWith("RFB ")) return fail("not RFB")
            socket.write("RFB 003.008\n")
        } else if (step === 1) {
            if (!buf.subarray(1, 1 + buf[0]!).includes(1)) return fail("security type None not offered")
            socket.write(Buffer.from([1]))
        } else if (step === 2) {
            if (buf.readUInt32BE(0) !== 0) return fail("security failed")
            // ClientInit, shared: a person watching over VNC is not disconnected.
            socket.write(Buffer.from([1]))
        } else if (step === 3) {
            socket.setTimeout(0)
            resolve(socket)
        }
        step++
    })
})

/**
 * Connects to the wayvnc of HEADLESS-n for the length of fn. sway has no input device of its own: wayvnc gives each client a virtual pointer and keyboard.
 */
export const withVncInput = async <T>(deps: Pick<ServerDeps, "exec" | "vncPort">, n: number, fn: (vnc: VncInput) => Promise<T>): Promise<T> => {
    const socket = await connectRFB(deps.vncPort(n))
    try {
        socket.write(setEncodingsMessage())

        // The virtual devices appear a moment after the connection, and input sent before that is lost.
        const ready = async () => ((await swaymsg<{capabilities: number}[]>(deps.exec, ["-t", "get_seats"])).reduce((caps, seat) => caps | seat.capabilities, 0) & SEAT_READY) === SEAT_READY
        await waitFor(ready, "Seat input not ready", 1000)

        const result = await fn({
            key: ({keysym, scancode}, down) => {
                socket.write(scancode ? qemuKeyEventMessage(keysym, down, scancode) : keyEventMessage(keysym, down))
            },
            pointer: (x, y, buttonMask) => {
                socket.write(pointerEventMessage(x, y, buttonMask))
            },
        })

        // Ended only once everything is written, so wayvnc reads all of it before the connection goes.
        await new Promise<void>(resolve => socket.end(resolve))
        return result
    } finally {
        socket.destroy()
    }
}
