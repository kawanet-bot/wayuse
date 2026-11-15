# wayuse-builder

[![npm version](https://img.shields.io/npm/v/wayuse-builder)](https://www.npmjs.com/package/wayuse-builder)

Build the wayuse Docker image.

## SYNOPSIS

`wayuse.config.ts` defines what the image holds:

```ts
import {defineConfig} from "wayuse-builder"

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
```

`wayuse-build` writes the build directory, and Docker builds the image from it:

```sh
npx wayuse-build
docker build -t my-wayuse .wayuse
docker run --rm --shm-size 256m -p 127.0.0.1:3000:3000 -e WAYUSE_OUTPUTS=2 -v my-wayuse-config:/home/wayuse/.config my-wayuse
```

## CONFIGURATION

Every item may be left out.

| Item | Default | Meaning |
|---|---|---|
| `node.version` | the Node.js that runs `wayuse-build` | Node.js in the image. A full version: ranges are refused. |
| `apps.chrome` | not installed | Installs Google Chrome. Without it, every API under `/app/chrome/` answers 404. |
| `apps.chrome.channel` | `"stable"` | `"stable"`, `"beta"` or `"unstable"`. The version is the channel's current one when the image is built. |
| `apps.chrome.env` | `{}` | Environment variables for the Chrome process alone. `LANGUAGE` sets Chrome's language. No secrets: they are baked into the image. |
| `timezone` | `"Etc/UTC"` | IANA time zone of the whole container. |
| `screen.width`, `screen.height` | `1280`, `960` | The size a screen has until a client resizes it. |
| `packages` | `[]` | Additional apt packages, fonts among them. |

## COMMAND

```
Usage: wayuse-build [options]
  -c, --config <file>      the configuration to read (default: wayuse.config.ts)
  -o, --outdir <dir>       the build directory to write, emptied first (default: .wayuse)
  --server-tarball <file>  a wayuse-server tarball to install in place of the one on npm
  -v, --version            print this package's version
  -h, --help               print this usage
```

The build directory holds the `Dockerfile` and `rootfs/`, which mirrors the image's file system.
`wayuse-build` also bundles [noVNC](https://github.com/novnc/noVNC) into it, as `rootfs/opt/wayuse/vendor/novnc.js`, for the console's vnc page.
noVNC is under the MPL 2.0. It comes from its own package and is in none of wayuse's, and its notices stay in the bundle.
The resolved configuration is baked in as `/etc/wayuse/wayuse.json`.

## CONTAINER

| `docker run` | Meaning |
|---|---|
| `--shm-size 256m` | Required. sway dies of a bus error on the 64MB Docker gives by default. |
| `-e WAYUSE_OUTPUTS=<n>` | The number of screens, `HEADLESS-1` and up. Default: 1. |
| `-e WAYUSE_USER_AGENT=<string>` | Chrome's User-Agent. Default: Chrome's own. |
| `-e WAYUSE_JWT_PUBLIC_KEY=<key>` | The key wayuse-server verifies tokens with. Without it, every API that needs a token is refused. |
| `-e WAYUSE_JWT_AUDIENCE=<string>` | The `aud` a token must carry. Default: `wayuse`. |
| `-v <volume>:/home/wayuse/.config` | Keeps Chrome's profile when the image is rebuilt. |
| `--uts=host` | Optional. `GET /status/` then reports the host's name in place of the container's id. |

The container runs as the user `wayuse` (uid 1000).
It keeps a session D-Bus, sway, wayvnc, Chrome and wayuse-server running: one that exits is started again.
tini is PID 1 in the image, so `--init` is not needed.

| Port | Listener |
|---|---|
| 3000 | wayuse-server. Publish it with `-p` to reach the container from outside |
| 9222 | Chrome DevTools Protocol, on 127.0.0.1 inside the container |
| 5900 + n | wayvnc for `HEADLESS-n`, on 127.0.0.1 inside the container |

## SEE ALSO

- https://github.com/kawanet/wayuse
