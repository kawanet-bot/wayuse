// What the vnc page uses of noVNC, which comes with no types of its own.

declare module "@novnc/novnc" {
    /** A VNC connection drawn into an element. It reports "connect" and "disconnect" as events. */
    export default class RFB extends EventTarget {
        constructor(target: HTMLElement, url: string)

        scaleViewport: boolean
        resizeSession: boolean
        background: string

        focus(): void
    }
}
