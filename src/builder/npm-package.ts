// The wayuse-server this builder was written against. A tarball stands in while that is not on npm.
const SERVER_RANGE = "^0.0.0"

/** The tarball's name in the image: fixed, so the generated files do not change with its version. */
export const SERVER_TARBALL = "wayuse-server.tgz"

/**
 * The package.json of /opt/wayuse: what npm installs into the image.
 */
export const npmPackageOf = (tarball: boolean): string => JSON.stringify({
    name: "wayuse-image",
    private: true,
    dependencies: {
        "wayuse-server": tarball ? `file:${SERVER_TARBALL}` : SERVER_RANGE,
    },
}, null, 2) + "\n"
