import json from "@rollup/plugin-json"
import sucrase from "@rollup/plugin-sucrase"
import type {RollupOptions} from "rollup"
import {showFiles} from "./show-files.ts"

const rollupConfig: RollupOptions = {
    input: "../src/server/server.ts",

    // Bare specifiers stay external; only relative paths are bundled.
    external: [/^[^.\/]/],

    output: {
        file: "../packages/wayuse-server/dist/wayuse-server.js",
        format: "esm",
    },

    plugins: [
        json(),

        sucrase({
            disableESTransforms: true,
            exclude: ["node_modules/**"],
            transforms: ["typescript"],
        }),

        showFiles({deny: /\W(builder|client|test)\W/}),
    ],
}

export default rollupConfig
