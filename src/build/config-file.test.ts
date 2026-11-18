import assert from "node:assert/strict"
import {mkdir, mkdtemp, rm, writeFile} from "node:fs/promises"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {describe, it} from "node:test"
import {findConfigFile} from "./config-file.ts"

const TITLE = "build/config-file.test.ts"

describe(TITLE, () => {
    it("finds nothing in a directory without a configuration", async () => {
        const dir = await mkdtemp(join(tmpdir(), "wayuse-"))
        try {
            assert.equal(await findConfigFile(dir), undefined)
        } finally {
            await rm(dir, {recursive: true, force: true})
        }
    })

    it("finds each of the three names alone", async () => {
        const dir = await mkdtemp(join(tmpdir(), "wayuse-"))
        try {
            await writeFile(join(dir, "wayuse.config.js"), "")
            assert.equal(await findConfigFile(dir), "wayuse.config.js")
            await rm(join(dir, "wayuse.config.js"))

            await writeFile(join(dir, "wayuse.config.mjs"), "")
            assert.equal(await findConfigFile(dir), "wayuse.config.mjs")
            await rm(join(dir, "wayuse.config.mjs"))

            await writeFile(join(dir, "wayuse.config.ts"), "")
            assert.equal(await findConfigFile(dir), "wayuse.config.ts")
        } finally {
            await rm(dir, {recursive: true, force: true})
        }
    })

    it("takes .ts ahead of .mjs, and .mjs ahead of .js", async () => {
        const dir = await mkdtemp(join(tmpdir(), "wayuse-"))
        try {
            await writeFile(join(dir, "wayuse.config.js"), "")
            await writeFile(join(dir, "wayuse.config.mjs"), "")
            assert.equal(await findConfigFile(dir), "wayuse.config.mjs")

            await writeFile(join(dir, "wayuse.config.ts"), "")
            assert.equal(await findConfigFile(dir), "wayuse.config.ts")
        } finally {
            await rm(dir, {recursive: true, force: true})
        }
    })

    it("passes over a directory of the same name", async () => {
        const dir = await mkdtemp(join(tmpdir(), "wayuse-"))
        try {
            await mkdir(join(dir, "wayuse.config.ts"))
            await writeFile(join(dir, "wayuse.config.js"), "")
            assert.equal(await findConfigFile(dir), "wayuse.config.js")
        } finally {
            await rm(dir, {recursive: true, force: true})
        }
    })

    it("ignores a CommonJS configuration", async () => {
        const dir = await mkdtemp(join(tmpdir(), "wayuse-"))
        try {
            await writeFile(join(dir, "wayuse.config.cjs"), "")
            assert.equal(await findConfigFile(dir), undefined)
        } finally {
            await rm(dir, {recursive: true, force: true})
        }
    })
})
