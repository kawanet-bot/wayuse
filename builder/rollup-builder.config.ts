import json from "@rollup/plugin-json"
import sucrase from "@rollup/plugin-sucrase"
import type {RollupOptions} from "rollup"
import {showFiles} from "./show-files.ts"

const rollupConfig: RollupOptions = {
    input: "../src/builder/builder.ts",

    // Bare specifiers stay external; only relative paths are bundled.
    external: [/^[^.\/]/],

    output: {
        file: "../packages/wayuse-build/dist/wayuse-build.js",
        format: "esm",
    },

    plugins: [
        json(),

        sucrase({
            disableESTransforms: true,
            exclude: ["node_modules/**"],
            transforms: ["typescript"],
        }),

        showFiles({deny: /\W(server|client|test)\W/}),
    ],
}

export default rollupConfig
