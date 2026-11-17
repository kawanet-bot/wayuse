# Force bash so `set -o pipefail` works in the recipes below.
SHELL := bash
.SHELLFLAGS := -eo pipefail -c

# Sequential by design: the steps are quick and their output reads best in order.
.NOTPARALLEL:

# Where the three packages under test sit: installed after `unpack`, or the checkout's own for a run in place.
BUILD_PKG ?= node_modules/wayuse-build
SERVER_PKG ?= node_modules/wayuse-server
CLIENT_PKG ?= node_modules/wayuse

# The port the server under test listens on, where nothing else on a build host is expected.
PORT ?= 3999

# The workflow drives these steps in order: pack unpack test

all: pack

# The three tarballs under fixed names, so a command and an image name them without their versions.
pack: clean
	$(MAKE) -C .. all
	cd ../.. && npm pack -w packages/build -w packages/server -w packages/wayuse --pack-destination builder/pack
	mv wayuse-build-*.tgz build.tgz
	mv wayuse-server-*.tgz server.tgz
	@# Last, when its pattern matches no other package.
	mv wayuse-*.tgz wayuse.tgz

# The lane has no manifest, so builder/pack/package.json stands in. A checkout keeps its own.
unpack:
	[ -e ../../package.json ] || cp package.json ../../
	cd ../.. && npm install ./builder/pack/build.tgz ./builder/pack/server.tgz ./builder/pack/wayuse.tgz --no-audit --no-fund --no-save --engine-strict

test: test-bin test-cli test-build test-server

# npm accepts a broken bin mapping silently, so each link is asserted to be there and executable.
test-bin:
	[ -x ../../node_modules/.bin/wayuse ]
	[ -x ../../node_modules/.bin/wayuse-build ]
	[ -x ../../node_modules/.bin/wayuse-server ]

# Each executable starts and names its own package, and the keys come out without a server.
test-cli:
	cd ../.. && ./$(CLIENT_PKG)/bin/wayuse.js -v | grep "^wayuse " > /dev/null
	cd ../.. && ./$(BUILD_PKG)/bin/wayuse-build.js -v | grep "^wayuse-build " > /dev/null
	cd ../.. && ./$(SERVER_PKG)/bin/wayuse-server.js -v | grep "^wayuse-server " > /dev/null
	cd ../.. && [ "$$(./$(CLIENT_PKG)/bin/wayuse.js jwt keygen | grep -c '^WAYUSE_JWT_')" = 2 ]

# The sample's build directory as a user makes it, noVNC bundled from the dependency of wayuse-build.
test-build:
	/bin/rm -fr tmp
	mkdir -p tmp
	cp ../../$(BUILD_PKG)/sample/* tmp/
	cd tmp && ../../../$(BUILD_PKG)/bin/wayuse-build.js --server-tarball ../server.tgz > /dev/null
	[ -s tmp/.wayuse/Dockerfile ]
	[ -x tmp/.wayuse/rootfs/opt/wayuse/bin/supervise.sh ]
	grep -q "Licensed under MPL 2.0" tmp/.wayuse/rootfs/opt/wayuse/htdocs/console/vendor/novnc.js
	[ -s tmp/.wayuse/rootfs/opt/wayuse/htdocs/console/vendor/html-ele.mjs ]
	grep -q '"html-slim"' tmp/.wayuse/rootfs/opt/wayuse/package.json

# What the image does, without Docker: install the generated package.json, start the server, and ask it.
# Run through bash: an artifact passed between jobs keeps no executable bit.
test-server: test-build
	npm install --prefix tmp/.wayuse/rootfs/opt/wayuse --omit=dev --no-audit --no-fund
	bash smoke.sh tmp/.wayuse/rootfs $(PORT)

# Run in place against the checkout's own packages, with no tarball installed.
test-dist:
	$(MAKE) test-cli test-build test-server BUILD_PKG=packages/build SERVER_PKG=packages/server CLIENT_PKG=packages/wayuse

clean:
	/bin/rm -f *.tgz

.PHONY: all pack unpack test test-bin test-cli test-build test-server test-dist clean
