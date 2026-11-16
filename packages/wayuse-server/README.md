# wayuse-server

[![npm version](https://img.shields.io/npm/v/wayuse-server)](https://www.npmjs.com/package/wayuse-server)

The HTTP server that runs inside the wayuse container.

The image [wayuse-build](../wayuse-build/README.md) builds installs and starts it. It listens on port 9580 there.

## API

| Request | Response |
|---|---|
| `GET /ok` | An empty 200, for a health check. No token needed. |
| `GET /auth/me` | The claims of the token, as `{"me": {...}}`. |
| `GET /wayuse/config` | The resolved configuration the image was built from, as JSON. |
| `GET /wayuse/status` | The load and the memory of the host. |
| `GET /slot/` | Every screen, as `{"data": [...]}`: its sway output, the windows on it, and the number of VNC clients. |
| `GET /slot/HEADLESS-1` | One screen. |
| `GET /slot/HEADLESS-1/capture.png` | A PNG of the whole screen. |
| `DELETE /slot/HEADLESS-1` | Closes every window on the screen. |
| `POST /slot/HEADLESS-1/click` | Clicks a pixel of the capture, whatever is there: `{"x": 100, "y": 200, "button": "ctrl+button1"}`. |
| `POST /slot/HEADLESS-1/key` | Sends keys to the screen: `{"keys": "ctrl+l .. ctrl+v .. Return"}`. |
| `POST /slot/HEADLESS-1/vnc-ticket` | Issues a ticket to connect by VNC once: `{"path": "wayvnc/<UUID>", "expires_in": 30}`. |
| `GET /clipboard` | The text on the clipboard, as `{"text": "..."}`. |
| `PUT /clipboard` | Puts `{"text": "..."}` on the clipboard. |

`button` and `keys` are in the notation of sway's bindsym. A key is the name of an X11 keysym, such as `Return` or `at`, or the character itself.
The modifiers are `shift`, `ctrl`, `mod1` (Alt) and `mod4` (Meta). In `keys`, two to ten dots pause for 100ms each.
The input of `/slot/` goes through wayvnc, so it reaches whatever is on the screen, Chrome's own address bar included.

An image with Chrome also has these. In one without, they answer 404 with `Application not installed: chrome`. A tab's id is the targetId of the Chrome DevTools Protocol.

| Request | Response |
|---|---|
| `GET /app/chrome/tab/` | Every tab, as `{"data": [...]}`. |
| `PUT /app/chrome/tab/` | Closes every window on the slot, sets the screen to the size, and opens the URL in a window that fills it. Returns the new tab. |
| `POST /app/chrome/tab/` | Opens the URL in one more window of the size, over what is on the slot. Returns the new tab. |
| `GET /app/chrome/tab/:id` | One tab. |
| `DELETE /app/chrome/tab/:id` | Closes the tab, and returns it as it was. |
| `GET /app/chrome/tab/:id/capture.jpg` | A JPEG of what the tab shows. `Page-Video-Geometry` tells where the page's main video is, as `880x495+16-427`. |
| `GET /app/chrome/tab/:id/capture.html` | The tab's DOM as it is now, as HTML lightened by [html-slim](https://github.com/kawanet/html-slim): no scripts, styles or comments. Structured data (`application/ld+json`) stays. |
| `POST /app/chrome/tab/:id/click` | Clicks a pixel of the capture: `{"x": 100, "y": 200, "button": "ctrl+button1"}`. |
| `POST /app/chrome/tab/:id/evaluate` | Evaluates `{"expression": "document.title"}` in the page, and returns `{"result": {"type": "string", "value": "..."}}`. An exception is a 400. |

The body of PUT and POST:

```json
{
  "url": "https://example.com/",
  "slot": "HEADLESS-1",
  "width": 1920,
  "height": 1080,
  "context": "temporary"
}
```

| Item | Default | Meaning |
|---|---|---|
| `url` | required | `http:`, `https:` or `about:`. |
| `slot` | the first screen | The screen the window opens on. |
| `width`, `height` | the size in the image's configuration | 768 to 2560, given together. |
| `context` | `"default"` | `"temporary"` opens the window in a context of its own, which shares no login and no cookie with any other. |

An error is answered as `{"error": {"message": "..."}}` with its status.
The server takes its routes from `/`. A reverse proxy may put a path ahead of them.

## TOKENS

Every API needs `Authorization: Bearer <JWT>`, and answers 401 without a valid one. Only `/ok` and the pages under `/console/` are open.

The server verifies a token with a public key, which it reads from the environment of the container.
The key is given when the container starts, not when the image is built, so one image serves any number of key pairs:

```sh
npx wayuse jwt keygen > .env    # once: WAYUSE_JWT_PRIVATE_KEY= and WAYUSE_JWT_PUBLIC_KEY=
set -a; . ./.env; set +a
docker run -e WAYUSE_JWT_PUBLIC_KEY ... my-wayuse
```

In a `docker-compose.yml`, which reads `.env` by itself:

```yaml
services:
  wayuse:
    environment:
      WAYUSE_JWT_PUBLIC_KEY: "${WAYUSE_JWT_PUBLIC_KEY}"
```

The private key never goes to the container. [wayuse-client](../wayuse-client/README.md) makes the key pair and signs the tokens with it.

| Environment variable | Meaning |
|---|---|
| `WAYUSE_JWT_PUBLIC_KEY` | The key tokens are verified with. Without it, every API that needs a token is refused. |
| `WAYUSE_JWT_AUDIENCE` | The `aud` a token must carry. Default: `wayuse`. |

## CONSOLE

The server has pages for a person, at `/console/`:

| Page | What it is |
|---|---|
| `/console/` | The entry. It goes on to the monitor with a token the server accepts, and asks for one otherwise. |
| `/console/monitor/` | Every screen as a still picture, with the host's load. A click on a picture is sent as a click. |
| `/console/vnc/#!?slot=HEADLESS-1` | One screen over VNC, seen and operated in the browser. |
| `/console/api/` | A form that tries each API, and shows its URL and the `wayuse` command that does the same. |

The pages keep the token in the browser's `localStorage`, as `wayuse:jwt`.
A link of the form `/console/#!?jwt=<JWT>` signs in with the token in it. A browser sends what follows the `#` to no server.
The pages and their scripts need no token to load, as they carry no secret. Every API they call does.

The vnc page loads [noVNC](https://github.com/novnc/noVNC) from `/console/vendor/novnc.js`. It is not in this package: wayuse-build puts it into the image.
The monitor and the API form load [html-ele](https://github.com/kawanet/html-ele) from `/console/vendor/html-ele.mjs`, which wayuse-build puts there as well.

## VNC

A screen is reached by VNC over a WebSocket, as noVNC speaks it, at the path a ticket gives: `ws://<host>/wayvnc/<UUID>`.
A browser cannot send a token with a WebSocket, so the path's ticket stands in for it. A ticket connects once, and expires in 30 seconds unused.
The server relays the WebSocket to the wayvnc of the screen, which listens inside the container alone.

## LICENSES

This package is under the MIT license, but for what it carries of others:

- The key tables are made from X.Org's keysymdef.h and from keycodemapdb, the latter under its BSD license. Their notices are in [src/server/input/data/](../../src/server/input/data/).

## COMMAND

```
Usage: wayuse-server [options]
  -p, --port <port>    the port to listen on (default: 9580)
  -c, --config <file>  the resolved configuration (default: /etc/wayuse/wayuse.json)
  --htdocs <dir>       the files a browser loads without a token (default: /opt/wayuse/htdocs)
  -v, --version        print this package's version
  -h, --help           print this usage
```

The access log goes to the standard error, one line per response and without a time.

## SEE ALSO

- https://github.com/kawanet/wayuse
