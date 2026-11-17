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

## SIGN IN

Without a token, the entry asks for one to be pasted. An image can send the visitor to a page of its user's own instead, one that knows who is signed in:

```ts
export default defineConfig({
    console: {
        signIn: "/front/screen-sign-in/?next=",
    },
})
```

`signIn` is the address of that page, written up to where the entry adds the path to come back to. Opened as `/screen/tokyo-1/console/`, the entry goes to:

```
/front/screen-sign-in/?next=%2Fscreen%2Ftokyo-1%2Fconsole%2F%23!%3Fjwt%3D
```

The page adds a JWT at the end of what it was given, and goes there:

```
/screen/tokyo-1/console/#!?jwt=<JWT>
```

- The page is on the origin of the console. `signIn` is a path, or an address relative to the entry, and what comes back is a path.
- The page must go only to a path of its own site. Such a path starts with `/` and has none of `/`, `\`, a tab or a line break as its second character. As a regular expression, `/^\/[^\/\\\t\r\n]/`. A browser reads `/\example.com` as it reads `//example.com`, as another site, and the token would go there.
- A token that comes back and is refused is not sent for again. The entry shows the refusal and asks for a token.
- The other pages come back to the entry when the server refuses their token, so a token that has run out takes the same way.

## FILES

`wayuse-build` writes the console into the build directory as `rootfs/opt/wayuse/htdocs/console/`, laid out as its URLs are.
The image has it as `/opt/wayuse/htdocs/console/`, and [wayuse-server](../packages/server/README.md) serves that `htdocs/`.

| Under `console/` | What it is |
|---|---|
| `index.html`, `monitor/`, `api/`, `vnc/` | The pages. |
| `css/` | Their styles. |
| `js/` | Their scripts, built from `src/console/`. |
| `vendor/novnc.js` | [noVNC](https://github.com/novnc/noVNC), bundled when the build directory is written. It is under the MPL 2.0, and its notices stay in the bundle. |
| `config.json` | The `console` of the configuration, which the entry reads before it has a token. |
| `vendor/html-ele.mjs` | [html-ele](https://github.com/kawanet/html-ele), as npm installed it. The pages build their elements with it. |

A server that runs outside an image has no such directory, and no console.

## ANOTHER WEB SERVER

The console is files and calls to the API, so another web server can serve it. Three things hold wherever it is served from:

- A page takes everything ahead of `console/` in its own URL as the root of the API. `/some/prefix/console/monitor/` calls `/some/prefix/slot/`.
- The API is on the origin of the pages. The server sends no CORS headers.
- The vnc page opens a WebSocket at `wayvnc/<UUID>` under the same root.
