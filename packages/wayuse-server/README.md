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

Every API but `/ok` needs `Authorization: Bearer <JWT>`, and answers 403 without a valid one.
An error is answered as `{"error": {"message": "..."}}` with its status.
The server takes its routes from `/`. A reverse proxy may put a path ahead of them.
The server holds the public key alone. [wayuse-client](../wayuse-client/README.md) makes the key pair and signs the tokens.

| Environment variable | Meaning |
|---|---|
| `WAYUSE_JWT_PUBLIC_KEY` | The key tokens are verified with. Without it, every API that needs a token is refused. |
| `WAYUSE_JWT_AUDIENCE` | The `aud` a token must carry. Default: `wayuse`. |

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
