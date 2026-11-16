// noVNC comes with no types. Those of @types/novnc__novnc name an entry that noVNC had before, so they are passed on to the one it has now.

declare module "@novnc/novnc" {
    import RFB from "@novnc/novnc/lib/rfb"

    export default RFB
}
