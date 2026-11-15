import {createSerializer} from "../utils/serialize.ts"

export interface SwayLocks {
    /** One at a time per slot, so opening, closing and input on one screen do not mix. Never called inside withSeat. */
    withSlot<T>(id: string, fn: () => Promise<T>): Promise<T>
    /** One at a time for all slots: sway has one focus, one pointer and one keyboard. Held for as short as it can be. */
    withSeat<T>(fn: () => Promise<T>): Promise<T>
}

/**
 * The queues of one server. The order is always slot, then seat, and never two slots at once, so they cannot deadlock.
 */
export const createSwayLocks = (): SwayLocks => {
    const slots = new Map<string, ReturnType<typeof createSerializer>>()

    return {
        withSlot: (id, fn) => {
            const serialize = slots.get(id) ?? createSerializer()
            slots.set(id, serialize)
            return serialize(fn)
        },
        withSeat: createSerializer(),
    }
}
