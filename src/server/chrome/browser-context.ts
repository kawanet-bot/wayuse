import type {WayuseClient} from "wayuse-client"
import type {CDP} from "./cdp.ts"

type Kind = WayuseClient.ChromeContext

export interface BrowserContexts {
    /** Makes a context for one window alone. opened() follows once its first tab is there. */
    create(cdp: CDP): Promise<string>
    opened(browserContextId: string): void
    dispose(cdp: CDP, browserContextId: string): Promise<void>
    /** Disposes the temporary contexts left without a tab: Chrome keeps a context when its window closes. */
    sweep(cdp: CDP): Promise<void>
    /** Tells the default context, one this server made, and any other, such as an incognito window opened by hand. */
    kindOf(cdp: CDP): Promise<(browserContextId: string) => Kind>
}

/**
 * The temporary contexts of one server, remembered in memory alone: one made before a restart is left as "other".
 */
export const createBrowserContexts = (log: (message: string) => void): BrowserContexts => {
    const temporary = new Set<string>()

    // Between create() and opened() a context has no tab yet, and a sweep must not take it for an empty one.
    const opening = new Set<string>()

    const dispose = async (cdp: CDP, browserContextId: string): Promise<void> => {
        // Forgotten even if Chrome cannot dispose it, which happens after Chrome itself was restarted.
        temporary.delete(browserContextId)
        opening.delete(browserContextId)
        log(`context dispose ${browserContextId}`)
        await cdp.send("Target.disposeBrowserContext", {browserContextId}).catch(error => log(`${browserContextId} ${error}`))
    }

    return {
        // No disposeOnDetach: each API call closes its connection, which would take the window with it.
        create: async cdp => {
            const {browserContextId} = await cdp.send<{browserContextId: string}>("Target.createBrowserContext")
            temporary.add(browserContextId)
            opening.add(browserContextId)
            log(`context create ${browserContextId}`)
            return browserContextId
        },

        opened: browserContextId => {
            opening.delete(browserContextId)
        },

        dispose,

        sweep: async cdp => {
            // Chosen before the tabs are listed: a context that finishes opening after that has no tab in the list.
            const candidates = [...temporary].filter(id => !opening.has(id))
            if (!candidates.length) return
            const {targetInfos} = await cdp.send<{targetInfos: {type: string, browserContextId: string}[]}>("Target.getTargets")
            const used = new Set(targetInfos.filter(t => t.type === "page").map(t => t.browserContextId))
            for (const id of candidates) {
                // Another sweep running at the same time may have disposed it already.
                if (!used.has(id) && temporary.has(id)) await dispose(cdp, id)
            }
        },

        kindOf: async cdp => {
            const {defaultBrowserContextId} = await cdp.send<{defaultBrowserContextId: string}>("Target.getBrowserContexts")
            return id => (id === defaultBrowserContextId ? "default" : temporary.has(id) ? "temporary" : "other")
        },
    }
}
