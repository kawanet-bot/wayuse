# The tables behind the key API. They do not change, so the JSON files are kept in git and made here by hand.

ALL := keysymdef.json keymaps.json LICENSE.xorgproto LICENSE.keycodemapdb

all: $(ALL)

# The names and numbers of the keysyms, from X.Org: `#define XK_Return 0xff0d` becomes "Return": "0xff0d".
keysymdef.json: keysymdef.h
	node -e 'const fs = require("fs"); const out = {}; for (const [, name, hex] of fs.readFileSync(process.argv[1], "utf8").matchAll(/^#define XK_(\w+)\s+(0x[0-9a-fA-F]+)/gm)) out[name] = hex; fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 2) + "\n")' $< $@

# Where each key is on a keyboard, as an XT scancode: column 13 is the keysym's name and column 5 the AT set 1 keycode.
keymaps.json: keymaps.csv
	node -e 'const fs = require("fs"); const out = {}; for (const line of fs.readFileSync(process.argv[1], "utf8").split("\n").slice(1)) { const f = line.split(","); const name = /^XK_(\w+)$$/.exec(f[12] || "")?.[1]; if (name && f[4] && !(name in out)) out[name] = f[4] } fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 2) + "\n")' $< $@

# The notices of keysymdef.h, which ask to be kept with every copy: the comment the file opens with.
LICENSE.xorgproto: keysymdef.h
	node -e 'const fs = require("fs"); const text = fs.readFileSync(process.argv[1], "utf8"); fs.writeFileSync(process.argv[2], text.slice(0, text.indexOf("*/") + 2) + "\n")' $< $@

# keycodemapdb offers the GPL or this license, and the tables here are taken under this one.
LICENSE.keycodemapdb:
	curl -sSfo $@ "https://gitlab.com/keycodemap/keycodemapdb/-/raw/54788039c0b3486a8883090d6736c2500177af29/LICENSE.BSD"

# The version Ubuntu 26.04 ships in x11proto-dev.
keysymdef.h:
	curl -sSfo $@ "https://gitlab.freedesktop.org/xorg/proto/xorgproto/-/raw/xorgproto-2025.1/include/X11/keysymdef.h"

# keycodemapdb, the same data noVNC makes its xtscancodes.js from.
keymaps.csv:
	curl -sSfo $@ "https://gitlab.com/keycodemap/keycodemapdb/-/raw/54788039c0b3486a8883090d6736c2500177af29/data/keymaps.csv"

clean:
	/bin/rm -f $(ALL)

# The downloads are only a step on the way, and make removes them once the JSON is there.
.INTERMEDIATE: keysymdef.h keymaps.csv

.PHONY: all clean
