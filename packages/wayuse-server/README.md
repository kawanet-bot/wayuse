# wayuse-server

[![npm version](https://img.shields.io/npm/v/wayuse-server)](https://www.npmjs.com/package/wayuse-server)

The HTTP and MCP server that runs inside the wayuse container.

The image [wayuse-builder](../wayuse-builder/README.md) builds installs and starts it. It listens on port 3000 there.

## API

| Request | Response |
|---|---|
| `GET /ok` | An empty 200, for a health check. |
| `GET /config` | The resolved configuration the image was built from, as JSON. |

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
