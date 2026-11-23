import {defineConfig} from "@wayuse/build"

export default defineConfig({
    output: {
        dir: "docker/wayuse",
    },
    node: {
        version: "26.13.1",
    },
    apps: {
        chrome: {
            channel: "stable",
            env: {LANGUAGE: "ja"},
            // The defaults. What is written here replaces them.
            policies: {
                BrowserGuestModeEnabled: false,
                BrowserAddPersonEnabled: false,
            },
        },
    },
    timezone: "Asia/Tokyo",
    screen: {
        outputs: 1,
        width: 1280,
        height: 960,
        minWidth: 768,
        minHeight: 768,
        maxWidth: 1920,
        maxHeight: 1920,
    },
    packages: [
        "fonts-noto-cjk",
        "fonts-noto-color-emoji",
        "fonts-noto-core",
        "fonts-morisawa-bizud-gothic",
        "fonts-morisawa-bizud-mincho",
    ],
})
