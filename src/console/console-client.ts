// The client the console's pages share: the server beside the page, with the token the browser keeps.

import type {WayuseClient} from "wayuse-client"
import {createClient} from "../api/api-client.ts"
import {basePathOf} from "./console-util.ts"

const JWT_KEY = "wayuse:jwt"

/** The server's root, from where this page is, so a prefix a reverse proxy adds is followed. */
export const BASE = basePathOf(location.pathname)

export const getToken = (): string | undefined => localStorage.getItem(JWT_KEY) ?? undefined

export const setToken = (jwt: string | undefined): void => {
    if (jwt) localStorage.setItem(JWT_KEY, jwt)
    else localStorage.removeItem(JWT_KEY)
}

export const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T

/**
 * A client for a page behind the login: a refused token sends the browser back to the entry, where a new one is given.
 */
export const createConsoleClient = (): WayuseClient.Client => createClient({
    url: location.origin + BASE,
    token: getToken,
    fetch: async (input, init) => {
        const res = await fetch(input, init)
        if (res.status === 403) location.href = `${BASE}console/`
        return res
    },
})
