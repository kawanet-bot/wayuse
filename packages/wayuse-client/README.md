# wayuse-client

[![npm version](https://img.shields.io/npm/v/wayuse-client)](https://www.npmjs.com/package/wayuse-client)

The API client and CLI for a wayuse container.

## SYNOPSIS

```sh
export WAYUSE_URL=http://127.0.0.1:3000/    # where wayuse-server is reached
export WAYUSE_JWT=...                       # see TOKENS below

npx wayuse slot list                        # every screen, as JSON
npx wayuse slot capture -o screen.png       # a PNG of the screen
npx wayuse slot capture HEADLESS-2 -o 2.png # of one screen, when the container has more
```

The same from a program. It uses web standards alone, so it runs in Node.js and in a browser:

```ts
import {createClient} from "wayuse-client"

const client = createClient({url: "http://127.0.0.1:3000/", token: process.env.WAYUSE_JWT})
const slots = await client.getSlots()
const png = await client.captureSlot(slots[0].id)
```

## COMMAND

```
Usage: wayuse <command> [options]
  auth me                         print the claims of WAYUSE_JWT, as the server reads them
  config                          print the configuration the image was built from
  slot list                       print every screen
  slot show [<slot>]              print one screen
  slot capture [<slot>] [-o <file>]
                                  write a PNG of one screen (default: to the standard output)
  jwt keygen                      print a new key pair, as lines for an .env file
  jwt public-key                  print the public key of WAYUSE_JWT_PRIVATE_KEY
  jwt sign --sub <subject> [--claim <name>[=<value>]]...
                                  print a JWT signed with WAYUSE_JWT_PRIVATE_KEY, for WAYUSE_JWT_AUDIENCE
  -v, --version                   print this package's version
  -h, --help                      print this usage
```

`<slot>` may be left out while the container has one screen.

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
