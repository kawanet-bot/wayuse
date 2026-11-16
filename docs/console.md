# The console

An image that `wayuse-build` builds has pages for a person, at `/console/` of its server:

| Page | What it is |
|---|---|
| `/console/` | The entry. It goes on to the monitor with a token the server accepts, and asks for one otherwise. |
| `/console/monitor/` | Every screen as a still picture, with the host's load. A click on a picture is sent as a click. |
| `/console/vnc/#!?slot=HEADLESS-1` | One screen over VNC, seen and operated in the browser. |
| `/console/api/` | A form that tries each API, and shows its URL and the `wayuse` command that does the same. |

The pages keep the token in the browser's `localStorage`, as `wayuse:jwt`.
A link of the form `/console/#!?jwt=<JWT>` signs in with the token in it. A browser sends what follows the `#` to no server.
The pages and their scripts need no token to load, as they carry no secret. Every API they call does.

## FILES

`wayuse-build` writes the console into the build directory as `rootfs/opt/wayuse/htdocs/console/`, laid out as its URLs are.
The image has it as `/opt/wayuse/htdocs/console/`, and [wayuse-server](../packages/wayuse-server/README.md) serves that `htdocs/`.

| Under `console/` | What it is |
|---|---|
| `index.html`, `monitor/`, `api/`, `vnc/` | The pages. |
| `css/` | Their styles. |
| `js/` | Their scripts, built from `src/console/`. |
| `vendor/novnc.js` | [noVNC](https://github.com/novnc/noVNC), bundled when the build directory is written. It is under the MPL 2.0, and its notices stay in the bundle. |
| `vendor/html-ele.mjs` | [html-ele](https://github.com/kawanet/html-ele), as npm installed it. The pages build their elements with it. |

A server that runs outside an image has no such directory, and no console.

## ANOTHER WEB SERVER

The console is files and calls to the API, so another web server can serve it. Three things hold wherever it is served from:

- A page takes everything ahead of `console/` in its own URL as the root of the API. `/some/prefix/console/monitor/` calls `/some/prefix/slot/`.
- The API is on the origin of the pages. The server sends no CORS headers.
- The vnc page opens a WebSocket at `wayvnc/<UUID>` under the same root.
