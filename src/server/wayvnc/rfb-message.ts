// The client messages of RFB that carry input, as bytes. A function each, so a test reads them without a socket.

/** SetEncodings with the one encoding that lets a key be sent by its place: QEMU Extended Key Event. */
export const setEncodingsMessage = (): Buffer => {
    const buf = Buffer.alloc(8)
    buf.writeUInt8(2, 0)
    buf.writeUInt16BE(1, 2)
    buf.writeInt32BE(-258, 4)
    return buf
}

/** KeyEvent: the keysym alone, and wayvnc finds a key for it. */
export const keyEventMessage = (keysym: number, down: boolean): Buffer => {
    const buf = Buffer.alloc(8)
    buf.writeUInt8(4, 0)
    buf.writeUInt8(down ? 1 : 0, 1)
    buf.writeUInt32BE(keysym, 4)
    return buf
}

/** QEMU Extended Key Event: the keysym with the XT scancode of the key's place. */
export const qemuKeyEventMessage = (keysym: number, down: boolean, scancode: number): Buffer => {
    // An extended scancode starts with 0xe0, and goes as its low byte with the high bit set, as noVNC sends it.
    const keycode = (scancode >> 8) === 0xe0 ? (scancode & 0x7f) | 0x80 : scancode
    const buf = Buffer.alloc(12)
    buf.writeUInt8(255, 0)
    buf.writeUInt16BE(down ? 1 : 0, 2)
    buf.writeUInt32BE(keysym, 4)
    buf.writeUInt32BE(keycode, 8)
    return buf
}

/** PointerEvent: bit 0 of the mask is button1. The position is from the output's top left. */
export const pointerEventMessage = (x: number, y: number, buttonMask: number): Buffer => {
    const buf = Buffer.alloc(6)
    buf.writeUInt8(5, 0)
    buf.writeUInt8(buttonMask, 1)
    buf.writeUInt16BE(x, 2)
    buf.writeUInt16BE(y, 4)
    return buf
}
