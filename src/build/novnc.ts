import terser from "@rollup/plugin-terser"
import {fileURLToPath} from "node:url"
import {rollup} from "rollup"

/**
 * Bundles noVNC, as npm installed it beside this package, into one file for the console's vnc page.
 */
export const bundleNovnc = async (file: string): Promise<void> => {
    const bundle = await rollup({
        input: fileURLToPath(import.meta.resolve("@novnc/novnc")),

        // noVNC is under the MPL 2.0, and its notices stay in the file that carries its code.
        plugins: [terser({format: {comments: /Copyright|License/}})],

        // A warning here is a missed import, which would break the page only once it is opened.
        onwarn: warning => {
            throw new Error(`noVNC: ${warning.message}`)
        },
    })

    try {
        // An ES module, as noVNC uses a top-level await.
        await bundle.write({file, format: "esm"})
    } finally {
        await bundle.close()
    }
}
