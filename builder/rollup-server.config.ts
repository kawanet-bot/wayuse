import json from "@rollup/plugin-json"
import sucrase from "@rollup/plugin-sucrase"
import type {RollupOptions} from "rollup"
import {showFiles} from "./show-files.ts"

const rollupConfig: RollupOptions = {
    input: "../src/server/server.ts",

    // Bare specifiers stay external; only relative paths are bundled.
    external: [/^[^.\/]/],

    // An application's code is imported only in an image that has it, so each is a file of its own beside the entry.
    output: {
        dir: "../packages/server/dist",
        format: "esm",
        entryFileNames: "wayuse-server.js",
        chunkFileNames: "server/[name].js",
    },

    plugins: [
        // The key tables are read whole, and named exports would write every key of them twice.
        json({namedExports: false}),

        sucrase({
            disableESTransforms: true,
            exclude: ["node_modules/**"],
            transforms: ["typescript"],
        }),

        showFiles({deny: /\W(build|client|test)\W/}),
    ],
}

export default rollupConfig
