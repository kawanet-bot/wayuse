# Force bash so `set -o pipefail` works in the recipes below.
SHELL := bash
.SHELLFLAGS := -eo pipefail -c

# Sequential by design: the steps are quick and their output reads best in order.
.NOTPARALLEL:

# Where the three packages under test sit: installed after `unpack`, or the checkout's own for a run in place.
PKG_ROOT ?= node_modules

# The port the server under test listens on, where nothing else on a build host is expected.
PORT ?= 3999

# The workflow drives these steps in order: pack unpack test

all: pack

# The three tarballs under fixed names, so a command and an image name them without their versions.
pack: clean
	$(MAKE) -C .. all
	cd ../.. && npm pack -w packages/wayuse-build -w packages/wayuse-server -w packages/wayuse-client --pack-destination builder/pack
	mv wayuse-build-*.tgz builder.tgz
	mv wayuse-server-*.tgz server.tgz
	mv wayuse-client-*.tgz client.tgz

# The lane has no manifest, so builder/pack/package.json stands in. A checkout keeps its own.
unpack:
	[ -e ../../package.json ] || cp package.json ../../
	cd ../.. && npm install ./builder/pack/builder.tgz ./builder/pack/server.tgz ./builder/pack/client.tgz --no-audit --no-fund --no-save --engine-strict

test: test-bin test-cli test-build test-server

# npm accepts a broken bin mapping silently, so each link is asserted to be there and executable.
test-bin:
	[ -x ../../node_modules/.bin/wayuse ]
	[ -x ../../node_modules/.bin/wayuse-build ]
	[ -x ../../node_modules/.bin/wayuse-server ]

# Each executable starts and names its own package, and the keys come out without a server.
test-cli:
	cd ../.. && ./$(PKG_ROOT)/wayuse-client/bin/wayuse.js -v | grep "^wayuse-client " > /dev/null
	cd ../.. && ./$(PKG_ROOT)/wayuse-build/bin/wayuse-build.js -v | grep "^wayuse-build " > /dev/null
	cd ../.. && ./$(PKG_ROOT)/wayuse-server/bin/wayuse-server.js -v | grep "^wayuse-server " > /dev/null
	cd ../.. && [ "$$(./$(PKG_ROOT)/wayuse-client/bin/wayuse.js jwt keygen | grep -c '^WAYUSE_JWT_')" = 2 ]

# The sample's build directory as a user makes it, noVNC bundled from the builder's own dependency.
test-build:
	/bin/rm -fr tmp
	mkdir -p tmp
	cp ../../$(PKG_ROOT)/wayuse-build/sample/* tmp/
	cd tmp && ../../../$(PKG_ROOT)/wayuse-build/bin/wayuse-build.js --server-tarball ../server.tgz > /dev/null
	[ -s tmp/.wayuse/Dockerfile ]
	[ -x tmp/.wayuse/rootfs/opt/wayuse/bin/supervise.sh ]
	grep -q "Licensed under MPL 2.0" tmp/.wayuse/rootfs/opt/wayuse/vendor/novnc.js
	[ -s tmp/.wayuse/rootfs/opt/wayuse/vendor/html-ele.mjs ]
	grep -q '"html-slim"' tmp/.wayuse/rootfs/opt/wayuse/package.json

# What the image does, without Docker: install the generated package.json, start the server, and ask it.
# Run through bash: an artifact passed between jobs keeps no executable bit.
test-server: test-build
	npm install --prefix tmp/.wayuse/rootfs/opt/wayuse --omit=dev --no-audit --no-fund
	bash smoke.sh tmp/.wayuse/rootfs $(PORT)

# Run in place against the checkout's own packages, with no tarball installed.
test-dist:
	$(MAKE) test-cli test-build test-server PKG_ROOT=packages

clean:
	/bin/rm -f *.tgz

.PHONY: all pack unpack test test-bin test-cli test-build test-server test-dist clean
