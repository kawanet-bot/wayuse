import {defineConfig} from "wayuse-build"

export default defineConfig({
    node: {
        version: "26.13.1",
    },
    apps: {
        chrome: {
            channel: "stable",
            env: {LANGUAGE: "ja"},
        },
    },
    timezone: "Asia/Tokyo",
    packages: [
        "fonts-noto-cjk",
        "fonts-noto-color-emoji",
        "fonts-noto-core",
        "fonts-morisawa-bizud-gothic",
        "fonts-morisawa-bizud-mincho",
    ],
})
