# @wayuse/build

[![npm version](https://img.shields.io/npm/v/@wayuse/build)](https://www.npmjs.com/package/@wayuse/build)

Build the wayuse Docker image.

## SYNOPSIS

`wayuse.config.ts` defines what the image holds:

```ts
import {defineConfig} from "@wayuse/build"

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

Install this package beside [wayuse](../wayuse/README.md), whose `build` command runs it.
It writes the build directory, and Docker builds the image from it:

```sh
npm install -D wayuse @wayuse/build
npx wayuse build -d docker/wayuse
docker build -t my-wayuse docker/wayuse
docker run --rm --shm-size 256m -p 127.0.0.1:9580:9580 -e WAYUSE_SCREEN_OUTPUTS=2 -e WAYUSE_JWT_PUBLIC_KEY -v my-wayuse-config:/home/wayuse/.config my-wayuse
```

The server in the image needs `WAYUSE_JWT_PUBLIC_KEY`, the public key of the tokens it is to take. Without it, every request gets `503`. [@wayuse/server](../server/README.md#tokens) shows how to make the pair.

The package ships a `wayuse.config.ts` in [sample/](sample/) that writes out the defaults too, with a [docker-compose.yml](sample/docker-compose.yml) that includes the `compose.yml` of its build.
Copy them, make the keys once, and start the container:

```sh
cp node_modules/@wayuse/build/sample/* .
npx wayuse jwt keygen > .env
chmod 600 .env
npx wayuse build && docker compose up --build -d
```

Docker Compose reads `.env` by itself. Of the two keys in it, only the public key reaches the container.
The private key is in `.env` too. Keep the file to its owner and out of version control.
The two files work only as copies. Node.js runs no `.ts` under `node_modules`, and Docker Compose looks for `.env` and `docker/wayuse` beside its file.

## CONFIGURATION

Every item may be left out.

| Item | Default | Meaning |
|---|---|---|
| `output.dir` | none | The build directory to write, from the current directory. Required, unless `--dir` gives it. The sample writes to `docker/wayuse`. |
| `node.version` | the Node.js that runs `@wayuse/build` | Node.js in the image. A full version: ranges are refused. |
| `apps.chrome` | not installed | Installs Google Chrome. Without it, every API under `/app/chrome/` answers 404. |
| `apps.chrome.channel` | `"stable"` | `"stable"`, `"beta"` or `"unstable"`. The version is the channel's current one when the image is built. |
| `apps.chrome.env` | `{}` | Environment variables for Chrome alone, such as `LANGUAGE`. `-e` of the same name wins. Baked in, so no secrets. |
| `apps.chrome.policies` | the two of the [sample](sample/wayuse.config.ts) | Chrome's [managed policies](https://chromeenterprise.google/policies/), under Chrome's own names. Given, they replace the defaults, which keep Chrome to one profile. |
| `apps.redir` | not installed | Installs [redir](https://github.com/troglobit/redir) and keeps it running. It forwards TCP ports inside the container. |
| `apps.redir.ports` | required | The ports to listen on, from 1024 up, each with where it forwards to. `{9223: "127.0.0.1:9222"}` forwards port 9223 to Chrome DevTools Protocol. |
| `timezone` | `"Etc/UTC"` | IANA time zone of the whole container. |
| `screen.outputs` | `1` | The number of screens, `HEADLESS-1` and up: 1 to 8. `-e WAYUSE_SCREEN_OUTPUTS` wins. |
| `screen.width`, `screen.height` | `1280`, `960` | The size a screen has until a client resizes it. |
| `screen.minWidth`, `screen.minHeight` | `768`, `768` | The smallest size a client may resize a screen to. |
| `screen.maxWidth`, `screen.maxHeight` | `1920`, `1920` | The largest size a client may resize a screen to. A larger screen needs more `--shm-size`. |
| `packages` | `[]` | Additional apt packages, fonts among them. |
| `auth` | tokens are checked | `false` builds an image whose server asks for no token. Every API is then open to whoever reaches its port, so publish the port to no one else. Given a key, its server answers every request with `503`. |
| `console` | in the image | `false` leaves the [console](https://github.com/kawanet/wayuse/blob/main/docs/console.md) out of the image. Nothing of it is built or copied, and the image has the API alone. |
| `console.vars` | `icon` and `title` | What the [console](https://github.com/kawanet/wayuse/blob/main/docs/console.md)'s pages show as their icon and title. A value is text, written into the HTML of the image. |
| `console.terser` | `true` | Makes the console's scripts, and the packages they load, small with terser. `false` writes them as they are. |
| `console.signIn` | none | Where the [console](https://github.com/kawanet/wayuse/blob/main/docs/console.md)'s entry sends a visitor without a token, on the console's own origin. Without it, the entry asks for a token. |

## COMMAND

```
Usage: wayuse-build [options]
  -c, --config <file>  the configuration to read (default: wayuse.config.ts, .mjs or .js)
  -d, --dir <dir>      the build directory to write (default: output.dir of the configuration)
  -v, --version        print this package's version
  -h, --help           print this usage
```

Without `-c`, it reads the first of `wayuse.config.ts`, `wayuse.config.mjs` and `wayuse.config.js` in the current directory.
Without any of them, it prints the usage.
Without `-d`, it writes to `output.dir` of the configuration. With neither, it stops and writes nothing.
It prints the path of every file it writes.
`npx wayuse build` takes the same options and passes them on.

The build directory holds the `Dockerfile`, a [compose.yml](#docker-compose), [two scripts](#without-docker-compose) and `rootfs/`, which mirrors the image's file system.
[docs/container.md](https://github.com/kawanet/wayuse/blob/main/docs/container.md#build-directory) shows the files of the build directory.

## CONTAINER

[docs/container.md](https://github.com/kawanet/wayuse/blob/main/docs/container.md#docker-run) explains each option of `docker run`, and the ports of the container.

### Docker Compose

A build writes `compose.yml` beside the `Dockerfile`. The compose file of the project includes it, as the sample's does:

```yaml
include:
  - "docker/wayuse/compose.yml"
```

[docs/container.md](https://github.com/kawanet/wayuse/blob/main/docs/container.md#docker-compose) shows the `compose.yml` a build writes, the variables it passes on, and a setting of the project's own over it.

### Without Docker Compose

A build writes `docker-build.sh` and `docker-run.sh` beside `compose.yml`, for a host that runs the image without Docker Compose, such as from a systemd unit:

```sh
docker/wayuse/docker-build.sh
docker/wayuse/docker-run.sh
```

`docker-run.sh` runs the container in the foreground, for systemd to watch. It gives the container what `compose.yml` gives.
[docs/container.md](https://github.com/kawanet/wayuse/blob/main/docs/container.md#without-docker-compose) shows the `docker-run.sh` a build writes, and how to give it variables and options.

### Chrome DevTools Protocol from the host

Chrome listens on 127.0.0.1 inside the container, so `-p 9222:9222` alone reaches nothing.
`apps.redir` forwards another port to it:

```ts
export default defineConfig({
    apps: {
        chrome: {},
        redir: {ports: {9223: "127.0.0.1:9222"}},
    },
})
```

Publish that port to the host's `127.0.0.1` only. The host may give it any number, 9222 included:

```sh
docker run --rm --shm-size 256m -p 127.0.0.1:9580:9580 -p 127.0.0.1:9222:9223 my-wayuse
curl http://127.0.0.1:9222/json/version
```

A client of the protocol, such as Playwright or Puppeteer, connects to `webSocketDebuggerUrl` of the answer:

```json
{
  "Browser": "Chrome/...",
  "Protocol-Version": "1.3",
  "webSocketDebuggerUrl": "ws://127.0.0.1:9222/devtools/browser/<id>"
}
```

Chrome DevTools Protocol has no authentication, and it passes by the token of @wayuse/server.
Whoever reaches the port drives Chrome, reads its cookies and opens `file://` in the container.
[docs/container.md](https://github.com/kawanet/wayuse/blob/main/docs/container.md#chrome-devtools-protocol) shows it with Docker Compose, and the names Chrome refuses.

### A server on the host

A development server on the host, such as `wrangler dev`, is opened in the container as `http://host.docker.internal:<port>/`.
On Linux a container does not reach the host's `127.0.0.1`, so two things are needed.

1. Give the container the host's name, with `docker run --add-host host.docker.internal:host-gateway`. The `compose.yml` of the build directory does it with `extra_hosts`.

2. Make the server listen on more than `127.0.0.1`, which is where `wrangler dev`, like most development servers, listens by default:

   ```sh
   npx wrangler dev --ip 0.0.0.0 --port 8787
   ```

Then the page opens and is captured as any other:

```sh
npx wayuse chrome open http://host.docker.internal:8787/
npx wayuse slot capture -o screen.png
```

[docs/container.md](https://github.com/kawanet/wayuse/blob/main/docs/container.md#a-server-on-the-host) shows who reaches the server by the address it listens on, a secure context with `apps.redir`, and `--network host`.

## SEE ALSO

- https://github.com/kawanet/wayuse
