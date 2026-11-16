import json from "@rollup/plugin-json"
import sucrase from "@rollup/plugin-sucrase"
import type {RollupOptions} from "rollup"
import {showFiles} from "./show-files.ts"

const rollupConfig: RollupOptions = {
    // One script per page of the console. What they share goes into a chunk beside them.
    input: {
        login: "../src/console/login.ts",
        monitor: "../src/console/monitor.ts",
        api: "../src/console/api.ts",
        vnc: "../src/console/vnc.ts",
    },

    // Bare specifiers stay external; only relative paths are bundled.
    external: [/^[^.\/]/],

    output: {
        dir: "../packages/wayuse-server/dist/console",
        format: "esm",
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",

        // noVNC is no part of this package. wayuse-build bundles it into the image, and the page loads it from there.
        paths: {"@novnc/novnc": "../../vendor/novnc.js"},
    },

    plugins: [
        json(),

        sucrase({
            disableESTransforms: true,
            exclude: ["node_modules/**"],
            transforms: ["typescript"],
        }),

        // The browser gets nothing of Node: only src/console/ and the client both sides share.
        showFiles({deny: /^src\/(builder|server|client|jwt|test-utils)\/|\.test\./}),
    ],
}

export default rollupConfig
