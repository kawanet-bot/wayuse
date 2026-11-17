import terser from "@rollup/plugin-terser"
import {fileURLToPath} from "node:url"
import {rollup} from "rollup"

// The pages run in a browser of today. Without the year, terser writes for ES5 and passes over the shorter forms.
export const TERSER = {compress: true, ecma: 2020, mangle: true} as const

/**
 * Bundles a package of others, as npm installed it beside this one, into one file for the console's pages.
 */
export const bundleVendor = async (name: string, file: string, minify: boolean): Promise<void> => {
    const bundle = await rollup({
        input: fileURLToPath(import.meta.resolve(name)),

        // A license such as noVNC's asks that its notices stay in the file that carries the code.
        plugins: minify ? [terser({...TERSER, format: {comments: /Copyright|License/}})] : [],

        // A warning here is a missed import, which would break the page only once it is opened.
        onwarn: warning => {
            throw new Error(`${name}: ${warning.message}`)
        },
    })

    try {
        // An ES module, as noVNC uses a top-level await.
        await bundle.write({file, format: "esm"})
    } finally {
        await bundle.close()
    }
}
