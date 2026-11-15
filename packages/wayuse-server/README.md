# wayuse-server

[![npm version](https://img.shields.io/npm/v/wayuse-server)](https://www.npmjs.com/package/wayuse-server)

The HTTP and MCP server that runs inside the wayuse container.

The image [wayuse-builder](../wayuse-builder/README.md) builds installs and starts it. It listens on port 3000 there.

## API

| Request | Response |
|---|---|
| `GET /ok` | An empty 200, for a health check. No token needed. |
| `GET /auth/me` | The claims of the token, as `{"me": {...}}`. |
| `GET /config` | The resolved configuration the image was built from, as JSON. |
| `GET /slot/` | Every screen, as `{"data": [...]}`: its sway output, the windows on it, and the number of VNC clients. |
| `GET /slot/HEADLESS-1` | One screen. |
| `GET /slot/HEADLESS-1/capture.png` | A PNG of the whole screen. |
| `DELETE /slot/HEADLESS-1` | Closes every window on the screen. |
| `POST /slot/HEADLESS-1/click` | Clicks a pixel of the capture, whatever is there: `{"x": 100, "y": 200, "button": "ctrl+button1"}`. |
| `POST /slot/HEADLESS-1/key` | Sends keys to the screen: `{"keys": "ctrl+l .. ctrl+v .. Return"}`. |
| `POST /slot/HEADLESS-1/vnc-ticket` | Issues a ticket to connect by VNC once: `{"path": "wayvnc/<UUID>", "expires_in": 30}`. |
| `GET /clipboard` | The text on the clipboard, as `{"text": "..."}`. |
| `PUT /clipboard` | Puts `{"text": "..."}` on the clipboard. |
| `GET /status/` | The load and the memory of the host. |

`button` and `keys` are in the notation of sway's bindsym. A key is the name of an X11 keysym, such as `Return` or `at`, or the character itself.
The modifiers are `shift`, `ctrl`, `mod1` (Alt) and `mod4` (Meta). In `keys`, two to ten dots pause for 100ms each.
The input of `/slot/` goes through wayvnc, so it reaches whatever is on the screen, Chrome's own address bar included.

An image with Chrome also has these. A tab's id is the targetId of the Chrome DevTools Protocol.

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

The body of PUT and POST is `{"url": "https://...", "slot": "HEADLESS-1", "width": 1920, "height": 1080, "context": "temporary"}`.
Only `url` is required. `slot` is the first screen when left out, and the size is that of the image's configuration.
`"context": "temporary"` opens the window in a context of its own, which shares no login and no cookie with any other.

Every API but `/ok` needs `Authorization: Bearer <JWT>`, and answers 403 without a valid one.
An error is answered as `{"error": {"message": "..."}}` with its status.
The server takes its routes from `/`. A reverse proxy may put a path ahead of them.
The server holds the public key alone. [wayuse-client](../wayuse-client/README.md) makes the key pair and signs the tokens.

| Environment variable | Meaning |
|---|---|
| `WAYUSE_JWT_PUBLIC_KEY` | The key tokens are verified with. Without it, every API that needs a token is refused. |
| `WAYUSE_JWT_AUDIENCE` | The `aud` a token must carry. Default: `wayuse`. |

## VNC

A screen is reached by VNC over a WebSocket, as noVNC speaks it, at the path a ticket gives: `ws://<host>/wayvnc/<UUID>`.
A browser cannot send a token with a WebSocket, so the path's ticket stands in for it. A ticket connects once, and expires in 30 seconds unused.
The server relays the WebSocket to the wayvnc of the screen, which listens inside the container alone.

## LICENSES

The key tables in this package are made from X.Org's keysymdef.h and from keycodemapdb, the latter under its BSD license.
Their notices are in [src/server/input/data/](../../src/server/input/data/).

## COMMAND

```
Usage: wayuse-server [options]
  -p, --port <port>    the port to listen on (default: 3000)
  -c, --config <file>  the resolved configuration (default: /etc/wayuse/wayuse.json)
  -v, --version        print this package's version
  -h, --help           print this usage
```

The access log goes to the standard error, one line per response and without a time.

## SEE ALSO

- https://github.com/kawanet/wayuse
