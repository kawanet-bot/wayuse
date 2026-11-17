import {stat} from "node:fs/promises"
import {join} from "node:path"

/** The files read without -c, in this order. ESM only, so a .cjs is not among them. */
export const CONFIG_FILES = ["wayuse.config.ts", "wayuse.config.mjs", "wayuse.config.js"]

export const isFile = (path: string): Promise<boolean> => stat(path).then(stats => stats.isFile(), () => false)

/**
 * The name of the first of CONFIG_FILES that dir has, or undefined.
 */
export const findConfigFile = async (dir: string): Promise<string | undefined> => {
    for (const name of CONFIG_FILES) {
        if (await isFile(join(dir, name))) return name
    }
}
