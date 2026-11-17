// The entry of the console: goes on to the monitor with a token the server accepts, and asks for one otherwise.

import type {WayuseClient} from "wayuse"
import {createClient} from "../api/api-client.ts"
import {$, BASE, getToken, setToken} from "./console-client.ts"
import {failureOf, isRefusal, signInUrlOf, tokenOfHash} from "./console-util.ts"

type ConsoleConfig = WayuseClient.Config["console"]

// What wayuse-build wrote beside this page. A console served without the file has no sign-in address.
const signInOf = async (): Promise<string | undefined> => {
    const res = await fetch("config.json").catch(() => undefined)
    const config: ConsoleConfig | undefined = res?.ok ? await res.json().catch(() => undefined) : undefined
    return config?.signIn || undefined
}

// Not the console's client: here a refused token is an answer to show, not a reason to come back to this page.
// Only the server's own 401 is a refusal. Anything else is thrown, and leaves the token as it is.
const accepts = async (jwt: string): Promise<boolean> =>
    createClient({url: location.origin + BASE, token: jwt}).getMe().then(() => true, error => {
        if (isRefusal(error)) return false
        throw new Error(`The server gave no answer on the token: ${failureOf(error)}`)
    })

const show = (message: string, error = false): void => {
    $("message").textContent = message
    $("message").classList.toggle("is-error", error)
    $("form").hidden = false
}

const enter = (): void => location.replace("./monitor/")

const start = async (): Promise<void> => {
    // A token in the link is taken out of the address bar at once, so it stays in no history.
    const linked = tokenOfHash(location.hash)
    if (linked) {
        history.replaceState(null, "", location.pathname)
        setToken(linked)
    }

    const saved = getToken()
    if (saved && await accepts(saved)) return enter()

    // Every server under this origin shares the saved token, so only a refusal takes it away.
    setToken(undefined)

    // A token the link brought and the server refused would come back the same, so the visitor is not sent again.
    const signIn = linked ? undefined : await signInOf()
    if (signIn) return location.replace(signInUrlOf(signIn, location.pathname))

    show(saved ? "The server refused the token." : "Paste a token to sign in.", !!saved)
}

$("form").addEventListener("submit", event => {
    event.preventDefault()
    const jwt = $<HTMLTextAreaElement>("jwt").value.trim()
    if (!jwt) return
    void accepts(jwt).then(ok => {
        if (!ok) return show("The server refused the token.", true)
        setToken(jwt)
        enter()
    }, error => show((error as Error).message, true))
})

start().catch(error => show((error as Error).message, true))
