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
npx wayuse build -d docker/my-wayuse
docker build -t my-wayuse docker/my-wayuse
docker run --rm --shm-size 256m -p 127.0.0.1:9580:9580 -e WAYUSE_OUTPUTS=2 -e WAYUSE_JWT_PUBLIC_KEY -v my-wayuse-config:/home/wayuse/.config my-wayuse
```

The server in the image needs `WAYUSE_JWT_PUBLIC_KEY`, the public key of the tokens it is to take. Without it, every request gets `503`. [@wayuse/server](../server/README.md#tokens) shows how to make the pair.

The package ships a `wayuse.config.ts` in [sample/](sample/) that writes out the defaults too, with a [docker-compose.yml](sample/docker-compose.yml) that runs its image.
Copy them, make the keys once, and start the container:

```sh
cp node_modules/@wayuse/build/sample/* .
npx wayuse jwt keygen > .env
chmod 600 .env
npx wayuse build && docker compose up --build -d
```

Docker Compose reads `.env` by itself, and only the public key in it reaches the container.
The private key is in `.env` too. Keep the file to its owner and out of version control.
The two files work only as copies. Node.js runs no `.ts` under `node_modules`, and Docker Compose looks for `.env` and `docker/my-wayuse` beside its file.

## CONFIGURATION

Every item may be left out.

| Item | Default | Meaning |
|---|---|---|
| `output.dir` | none | The build directory to write, from the current directory. Required, unless `--dir` gives it. The sample writes to `docker/my-wayuse`. |
| `node.version` | the Node.js that runs `@wayuse/build` | Node.js in the image. A full version: ranges are refused. |
| `apps.chrome` | not installed | Installs Google Chrome. Without it, every API under `/app/chrome/` answers 404. |
| `apps.chrome.channel` | `"stable"` | `"stable"`, `"beta"` or `"unstable"`. The version is the channel's current one when the image is built. |
| `apps.chrome.env` | `{}` | Environment variables for the Chrome process alone. `LANGUAGE` sets Chrome's language. No secrets: they are baked into the image. |
| `apps.chrome.policies` | the two of the [sample](sample/wayuse.config.ts) | Chrome's [managed policies](https://chromeenterprise.google/policies/), under Chrome's own names. Given, they replace the defaults, which keep Chrome to one profile. |
| `apps.redir` | not installed | Installs [redir](https://github.com/troglobit/redir) and keeps it running. It forwards TCP ports inside the container. |
| `apps.redir.ports` | required | The ports to listen on, from 1024 up, each with where it forwards to. `{9223: "127.0.0.1:9222"}` forwards port 9223 to Chrome DevTools Protocol. |
| `timezone` | `"Etc/UTC"` | IANA time zone of the whole container. |
| `screen.width`, `screen.height` | `1280`, `960` | The size a screen has until a client resizes it. |
| `packages` | `[]` | Additional apt packages, fonts among them. |
| `auth` | tokens are checked | `false` builds an image whose server asks for no token. Every API is then open to whoever reaches its port, so publish the port to no one else. Given a key, its server answers every request with `503`. |
| `console` | in the image | `false` leaves the [console](https://github.com/kawanet/wayuse/blob/main/docs/console.md) out of the image. Nothing of it is built or copied, and the image has the API alone. |
| `console.vars` | `icon` and `title` | What the [console](https://github.com/kawanet/wayuse/blob/main/docs/console.md)'s pages show as their icon and title. A value is text, written into the HTML of the image. |
| `console.terser` | `true` | Makes the console's scripts, and the packages they load, small with terser. `false` writes them as they are. |
| `console.signIn` | none | Where the [console](https://github.com/kawanet/wayuse/blob/main/docs/console.md)'s entry sends a visitor without a token, on the console's own origin. Without it, the entry asks for a token. |

## COMMAND

```
Usage: wayuse-build [options]
  -c, --config <file>      the configuration to read (default: wayuse.config.ts, .mjs or .js)
  -d, --dir <dir>          the build directory to write (default: output.dir of the configuration)
  --server-tarball <file>  a @wayuse/server tarball to install in place of the one on npm
  -v, --version            print this package's version
  -h, --help               print this usage
```

Without `-c`, it reads the first of `wayuse.config.ts`, `wayuse.config.mjs` and `wayuse.config.js` in the current directory.
Without any of them, it prints the usage.
Without `-d`, it writes to `output.dir` of the configuration. With neither, it stops and writes nothing.
`npx wayuse build` takes the same options and passes them on.

The build directory holds the `Dockerfile` and `rootfs/`, which mirrors the image's file system.
A build writes `rootfs/opt/wayuse/` and `rootfs/etc/wayuse/` anew, and its other files over those of the build before.
The [console](https://github.com/kawanet/wayuse/blob/main/docs/console.md) is in it as `rootfs/opt/wayuse/htdocs/console/`, laid out as its URLs are. The server serves that `htdocs/` without a token.
`@wayuse/build` also bundles [noVNC](https://github.com/novnc/noVNC) into it, as `console/vendor/novnc.js`, for the console's vnc page.
noVNC is under the MPL 2.0. It comes from its own package and is in none of wayuse's, and its notices stay in the bundle.
It bundles [html-ele](https://github.com/kawanet/html-ele) beside it the same way, as `console/vendor/html-ele.js`, for the console's pages to build their elements with.
The resolved configuration is baked in as `/etc/wayuse/wayuse.config.json`.

## CONTAINER

| `docker run` | Meaning |
|---|---|
| `--shm-size 256m` | Required. sway dies of a bus error on the 64MB Docker gives by default. |
| `-e WAYUSE_OUTPUTS=<n>` | The number of screens, `HEADLESS-1` and up. Default: 1. |
| `-e WAYUSE_USER_AGENT=<string>` | Chrome's User-Agent. Default: Chrome's own. |
| `-e WAYUSE_JWT_PUBLIC_KEY=<key>` | The key @wayuse/server verifies tokens with. Without it, every API that needs a token is refused. |
| `-e WAYUSE_JWT_AUDIENCE=<string>` | The `aud` a token must carry. Default: `wayuse`. |
| `-v <volume>:/home/wayuse/.config` | Keeps Chrome's profile when the image is rebuilt. |
| `--uts=host` | Optional. `GET /wayuse/status` then reports the host's name in place of the container's id. |

The container runs as the user `wayuse` (uid 1000).
It keeps a session D-Bus, sway, wayvnc, Chrome and @wayuse/server running: one that exits is started again.
tini is PID 1 in the image, so `--init` is not needed.

| Port | Listener |
|---|---|
| 9580 | @wayuse/server. Publish it with `-p` to reach the container from outside |
| 9222 | Chrome DevTools Protocol, on 127.0.0.1 inside the container |
| 5900 + n | wayvnc for `HEADLESS-n`, on 127.0.0.1 inside the container |

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

redir listens on every address of the container, one redir for each port.
Publish that port to the host's `127.0.0.1` only. The host may give it any number, 9222 included:

```sh
docker run --rm --shm-size 256m -p 127.0.0.1:9580:9580 -p 127.0.0.1:9222:9223 my-wayuse
curl http://127.0.0.1:9222/json/version
```

Chrome DevTools Protocol has no authentication, and it passes by the token of @wayuse/server.
Whoever reaches the port drives Chrome, reads its cookies and opens `file://` in the container.
Connect by an IP address or `localhost`. Chrome refuses a request whose `Host` header is another name.

### A server on the host

A development server on the host, such as `wrangler dev`, is opened in the container as `http://host.docker.internal:<port>/`.
On Linux a container does not reach the host's `127.0.0.1`, so two things are needed.

1. Give the container the host's name, with `docker run --add-host host.docker.internal:host-gateway`. The sample's `docker-compose.yml` does it with `extra_hosts`.

2. Make the server listen on more than `127.0.0.1`, which is where `wrangler dev`, like most development servers, listens by default:

   ```sh
   npx wrangler dev --ip 0.0.0.0 --port 8787
   ```

Then the page opens and is captured as any other:

```sh
npx wayuse chrome open http://host.docker.internal:8787/
npx wayuse slot capture -o screen.png
```

| The server on the host listens on | From the container |
|---|---|
| `0.0.0.0` | Reached. The network the host is on reaches it too. |
| the address of Docker's bridge, which `ip -4 addr show docker0` tells, such as `172.17.0.1` | Reached, and by the containers alone. |
| `127.0.0.1` | Not reached: Chrome shows that the connection was refused. |

`apps.redir` gives the page the same server as `http://127.0.0.1:8787/`, where a page is in a secure context:

```ts
redir: {ports: {8787: "host.docker.internal:8787"}},
```

redir looks the name up when it starts. Without `--add-host`, it ends at once and the supervisor keeps starting it again, every redir with it.

`docker run --network host` is another way: the container then shares the host's network, `127.0.0.1` included.
Its own ports are then the host's as well: 9580, on every address of the host, and 9222 and 5900 + n.

## SEE ALSO

- https://github.com/kawanet/wayuse
