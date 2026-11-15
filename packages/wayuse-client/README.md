# wayuse-client

[![npm version](https://img.shields.io/npm/v/wayuse-client)](https://www.npmjs.com/package/wayuse-client)

The API client and CLI for a wayuse container.

## TOKENS

wayuse-server takes a JWT signed with Ed25519, and holds the public key alone.
The private key stays with whoever issues the tokens, outside the container.

```sh
npx wayuse jwt keygen > .env         # WAYUSE_JWT_PRIVATE_KEY= and WAYUSE_JWT_PUBLIC_KEY=
set -a; . ./.env; set +a
npx wayuse jwt sign --sub alice      # a JWT for "alice"
npx wayuse jwt public-key            # WAYUSE_JWT_PUBLIC_KEY= again, from the private key
```

Give the container `WAYUSE_JWT_PUBLIC_KEY`, and never the private key.

| Environment variable | Read by | Meaning |
|---|---|---|
| `WAYUSE_JWT_PRIVATE_KEY` | `wayuse jwt sign`, `wayuse jwt public-key` | The key tokens are signed with. |
| `WAYUSE_JWT_PUBLIC_KEY` | wayuse-server | The key tokens are verified with. |
| `WAYUSE_JWT_AUDIENCE` | both | The `aud` of a token. It must be the same on both sides. Default: `wayuse`. |

A token carries `aud`, `sub` and `iat`. It never expires unless it carries `exp`.
`--claim <name>` adds a claim set to true, and `--claim <name>=<value>` one set to a string.

The same from a program:

```ts
import {generateKeyPair, signJwt} from "wayuse-client"

const {privateKey, publicKey} = generateKeyPair()
const jwt = signJwt({aud: "wayuse", sub: "alice"}, privateKey)
```

## SEE ALSO

- https://github.com/kawanet/wayuse
