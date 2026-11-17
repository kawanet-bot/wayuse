// One source for the version: the build inlines this package.json, and Node reads it as is.
import pkg from "../../packages/server/package.json" with {type: "json"}

export const VERSION: string = pkg.version
