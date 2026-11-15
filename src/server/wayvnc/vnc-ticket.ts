import {randomUUID} from "node:crypto"

/** How long a ticket may wait to be used, in seconds. A connection made in time is not cut when it passes. */
export const VNC_TICKET_TTL = 30

export interface VncTickets {
    /** A ticket to connect once to the wayvnc of HEADLESS-n. */
    issue(n: number): string
    /** Uses a ticket up and returns its n, or undefined for one that is unknown, used or expired. */
    take(id: string): number | undefined
}

/**
 * The tickets of one server, in memory alone, so the server that issues one must be the one that takes it.
 */
export const createVncTickets = (now: () => number = Date.now): VncTickets => {
    const tickets = new Map<string, {n: number, expires: number}>()

    return {
        issue: n => {
            // One that was never used is dropped here, when the next is issued.
            for (const [id, ticket] of tickets) {
                if (ticket.expires <= now()) tickets.delete(id)
            }

            const id = randomUUID()
            tickets.set(id, {n, expires: now() + VNC_TICKET_TTL * 1000})
            return id
        },

        take: id => {
            const ticket = tickets.get(id)
            tickets.delete(id)
            return ticket && now() < ticket.expires ? ticket.n : undefined
        },
    }
}
