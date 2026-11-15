# wayuse-client

[![npm version](https://img.shields.io/npm/v/wayuse-client)](https://www.npmjs.com/package/wayuse-client)

The API client and CLI for a wayuse container.

## SYNOPSIS

```sh
export WAYUSE_URL=http://127.0.0.1:3000/    # where wayuse-server is reached
export WAYUSE_JWT=...                       # see TOKENS below

npx wayuse chrome open https://example.com/ # open the URL in Chrome, filling the screen
npx wayuse slot capture -o screen.png       # a PNG of the screen
npx wayuse chrome eval 'document.title'     # run JavaScript in the page
npx wayuse chrome capture -o page.jpg       # a JPEG of the page alone
npx wayuse slot list                        # every screen, as JSON
```

The same from a program. It uses web standards alone, so it runs in Node.js and in a browser:

```ts
import {createClient} from "wayuse-client"

const client = createClient({url: "http://127.0.0.1:3000/", token: process.env.WAYUSE_JWT})
const tab = await client.openChromeTab({url: "https://example.com/"})
const {value} = await client.evaluateChromeTab(tab.id, "document.title")
const png = await client.captureSlot(tab.sway.output)
```

## COMMAND

```
Usage: wayuse <command> [options]
  auth me                         print the claims of WAYUSE_JWT, as the server reads them
  config                          print the configuration the image was built from
  slot list                       print every screen
  slot show [--slot <slot>]       print one screen
  slot capture [--slot <slot>] [-o <file>]
                                  write a PNG of one screen (default: to the standard output)
  slot clear [--slot <slot>]      close every window on one screen
  slot click <x> <y> [--slot <slot>] [--button <button>]
                                  click a pixel of the screen's capture, whatever is there
  slot key <keys> [--slot <slot>] send keys to the screen: "ctrl+l .. ctrl+v .. Return"
  clipboard get                   print the text on the clipboard
  clipboard set <text>            put the text on the clipboard
  status                          print the load and the memory of the host
  chrome list                     print every tab of Chrome
  chrome open <url> [--slot <slot>] [--size <width>x<height>] [--context temporary] [--add]
                                  open the URL in a new window that replaces what is on the slot,
                                  or with --add in one more window over it
  chrome show [--tab <id>]        print one tab
  chrome close [--tab <id>]       close one tab
  chrome capture [--tab <id>] [-o <file>]
                                  write a JPEG of what one tab shows
  chrome html [--tab <id>] [-o <file>]
                                  write the tab's DOM as lightened HTML
  chrome click <x> <y> [--tab <id>] [--button <button>]
                                  click a pixel of the tab's capture
  chrome eval <expression> [--tab <id>]
                                  evaluate JavaScript in the tab's page, and print the result
  jwt keygen                      print a new key pair, as lines for an .env file
  jwt public-key                  print the public key of WAYUSE_JWT_PRIVATE_KEY
  jwt sign --sub <subject> [--claim <name>[=<value>]]...
                                  print a JWT signed with WAYUSE_JWT_PRIVATE_KEY, for WAYUSE_JWT_AUDIENCE
  -v, --version                   print this package's version
  -h, --help                      print this usage
```

`--slot` is the first screen when left out. `--tab` may be left out while Chrome has one tab.

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
