import json from "@rollup/plugin-json"
import sucrase from "@rollup/plugin-sucrase"
import type {RollupOptions} from "rollup"
import {showFiles} from "./show-files.ts"

const rollupConfig: RollupOptions = {
    input: "../src/client/client.ts",

    // Bare specifiers stay external; only relative paths are bundled.
    external: [/^[^.\/]/],

    output: {
        file: "../packages/wayuse-client/dist/wayuse-client.js",
        format: "esm",
    },

    plugins: [
        json(),

        sucrase({
            disableESTransforms: true,
            exclude: ["node_modules/**"],
            transforms: ["typescript"],
        }),

        showFiles({deny: /\W(build|server|test)\W/}),
    ],
}

export default rollupConfig
