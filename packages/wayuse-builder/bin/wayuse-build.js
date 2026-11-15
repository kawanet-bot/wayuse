#!/usr/bin/env node

// exitCode rather than exit(), so output still on its way to a pipe is not cut off.

import {CLI} from "wayuse-builder"

CLI({
    args: process.argv.slice(2),
})
    .catch(error => {
        console.error(error)
        return 1
    })
    .then(code => {
        process.exitCode = code
    })
