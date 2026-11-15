/** https://github.com/kawanet/wayuse */

export {} // external module indicator

export declare namespace WayuseClient {

    /** What the image was defined to hold, with every default filled in. Baked in as /etc/wayuse/wayuse.json. */
    interface Config {
        /** The wayuse-builder that filled in the defaults. */
        builder: {version: string}
        node: {version: string}
        /** The installed applications. A key is present only for an installed one. */
        apps: {chrome?: ChromeConfig}
        timezone: string
        /** The size a screen has until a client resizes it. */
        screen: {width: number, height: number}
        packages: string[]
    }

    interface ChromeConfig {
        channel: "stable" | "beta" | "unstable"
        env: Record<string, string>
    }

    /** A screen: one sway output, HEADLESS-1 and up. */
    interface Slot {
        /** The name of the sway output, such as "HEADLESS-1". */
        id: string
        /** As `swaymsg -t get_outputs` and `get_tree` report them. */
        sway: {output: SwayOutput, windows: SwayWindow[]}
        /** The number of VNC clients now connected to the screen. */
        wayvnc: {clients: number}
    }

    interface SlotList {
        data: Slot[]
    }

    interface SwayOutput {
        name: string
        active: boolean
        /** The place among all outputs, which sway lays side by side. */
        rect: Rect
        current_workspace: string
    }

    interface SwayWindow {
        id: number
        app_id: string
        pid: number
        /** The title of the window. */
        name: string
        marks: string[]
        focused: boolean
        /** In the coordinates of all outputs, not of the window's own output. */
        rect: Rect
    }

    interface Rect {
        x: number
        y: number
        width: number
        height: number
    }

    /** A tab of Chrome. Its id is the targetId of the Chrome DevTools Protocol. */
    interface ChromeTab {
        id: string
        target: {type: string, url: string, title: string, context: ChromeContext}
        /** The size alone: on Wayland Chrome does not know where its window is. */
        window: {windowId: number, bounds: {width: number, height: number, windowState: string}}
        /** The renderer has crashed, and the tab shows Chrome's error page. */
        crashed?: true
        /** Missing for a crashed tab and for a page that does not answer. A tab behind another is "hidden". */
        document?: {visibilityState: string}
        /** The sway window, known only for a window the server opened. */
        sway?: {id: number, output: string}
    }

    interface ChromeTabList {
        data: ChromeTab[]
    }

    /** "temporary" is a context the server made for one window. "other" is any it did not make, such as an incognito window. */
    type ChromeContext = "default" | "temporary" | "other"

    /** The body of PUT and POST /app/chrome/tab/. */
    interface ChromeOpenRequest {
        /** http:, https: or about: */
        url: string
        /** Default: the first slot. */
        slot?: string
        /** 768 to 2560, given together with height. Default: the size in the image's configuration. */
        width?: number
        height?: number
        /** "temporary" shares no login and no cookie with any other window. Default: "default". */
        context?: "default" | "temporary"
    }

    /** The body of POST /app/chrome/tab/:id/click. */
    interface ChromeClickRequest {
        /** A pixel of the tab's capture.jpg. */
        x: number
        y: number
        /** In the notation of sway's bindsym: "button1" to "button3", with "shift+", "ctrl+", "mod1+" or "mod4+". Default: "button1". */
        button?: string
    }

    /** The result of the Protocol's Runtime.evaluate, by value: a DOM element or a function has none. */
    interface ChromeEvaluateResult {
        type: string
        subtype?: string
        value?: unknown
        description?: string
    }

    interface ChromeEvaluateResponse {
        result: ChromeEvaluateResult
    }

    /** A JPEG of what a tab shows. */
    interface ChromeCapture {
        jpeg: Uint8Array
        /** Where the page's main video is in the image, as "880x495+16-427", when it has one. */
        videoGeometry?: string
    }

    /** The claims wayuse-server reads. Any other claim passes through to GET /auth/me. */
    interface JwtClaims {
        /** Must equal the server's WAYUSE_JWT_AUDIENCE. */
        aud: string
        /** Who the token was issued to. */
        sub: string
        /** Seconds since the epoch. */
        iat: number
        /** Seconds since the epoch. A token without it never expires. */
        exp?: number
        [name: string]: unknown
    }

    /** The claims to sign. iat is the current time unless given. */
    type JwtInput = Omit<JwtClaims, "iat"> & {iat?: number}

    /** An Ed25519 key pair, each key one line of base64: PKCS#8 for the private key, SPKI for the public key. */
    interface KeyPair {
        privateKey: string
        publicKey: string
    }

    interface ClientOptions {
        /** Where the server is reached, a path ahead of its routes included: "http://127.0.0.1:3000/". */
        url: string
        /** The JWT, or a function that returns the one to send with each request. */
        token?: string | (() => string | undefined | Promise<string | undefined>)
        /** Default: the global fetch. */
        fetch?: (input: URL, init?: RequestInit) => Promise<Response>
    }

    /** One method per API of wayuse-server. Each rejects with an ApiError when the server refuses. */
    interface Client {
        /** The claims of the token, as the server reads them. */
        getMe(): Promise<JwtClaims>
        getConfig(): Promise<Config>
        getSlots(): Promise<Slot[]>
        getSlot(id: string): Promise<Slot>
        /** A PNG of the whole screen. */
        captureSlot(id: string): Promise<Uint8Array>
        /** Closes every window on the screen. */
        clearSlot(id: string): Promise<Slot>

        getChromeTabs(): Promise<ChromeTab[]>
        getChromeTab(id: string): Promise<ChromeTab>
        /** Closes every window on the slot, sets the screen to the size, and opens the URL in a window that fills it. */
        openChromeTab(request: ChromeOpenRequest): Promise<ChromeTab>
        /** Opens the URL in one more window of the size, over what is on the slot. */
        addChromeTab(request: ChromeOpenRequest): Promise<ChromeTab>
        /** Resolves to the tab as it was before it closed. */
        closeChromeTab(id: string): Promise<ChromeTab>
        captureChromeTab(id: string): Promise<ChromeCapture>
        clickChromeTab(id: string, request: ChromeClickRequest): Promise<ChromeTab>
        /** Rejects with an ApiError of status 400 when the expression throws. */
        evaluateChromeTab(id: string, expression: string): Promise<ChromeEvaluateResult>
    }

    interface CLIOptions {
        /** The arguments as the executable gets them: process.argv.slice(2). */
        args: string[]
        /** Where WAYUSE_URL, WAYUSE_JWT and the other variables are read from. Default: process.env. */
        env?: Record<string, string | undefined>
    }
}

/** Makes a new key pair. The private key stays with whoever signs, and the public key goes to the container. */
export declare function generateKeyPair(): WayuseClient.KeyPair

/** The public key that belongs to a private key. */
export declare function publicKeyOf(privateKey: string): string

/** Signs a JWT that wayuse-server verifies with the public key. */
export declare function signJwt(claims: WayuseClient.JwtInput, privateKey: string): string

/** The server's answer when it is not a success: its status, and its message as the error's message. */
export declare class ApiError extends Error {
    status: number

    constructor(status: number, message: string)
}

/** A client of wayuse-server on web standards alone, so the same code runs in Node.js and in a browser. */
export declare function createClient(options: WayuseClient.ClientOptions): WayuseClient.Client

/** Runs the command line once per process and resolves to its exit code. The caller ends the process. */
export declare function CLI(options: WayuseClient.CLIOptions): Promise<number>
