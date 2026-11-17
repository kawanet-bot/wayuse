# Force bash so `set -o pipefail` works in the recipes below.
SHELL := bash
.SHELLFLAGS := -eo pipefail -c

# Sequential by design: the bundles are quick, and -j only interleaves their output.
.NOTPARALLEL:

BUILD_SRC := $(shell find ../src/build -name '*.ts' -not -name '*.test.ts')
SERVER_SRC := $(shell find ../src/server -name '*.ts' -not -name '*.test.ts')
CLIENT_SRC := $(shell find ../src/client -name '*.ts' -not -name '*.test.ts')
SHARED_SRC := $(shell find ../src/jwt ../src/api -name '*.ts' -not -name '*.test.ts')
CONSOLE_SRC := $(shell find ../src/console -name '*.ts' -not -name '*.test.ts')
TYPES := $(wildcard ../packages/*/types/*.d.ts)
ROLLUP_SRC := $(wildcard ./*.ts)

BUILD_DST := ../packages/build/dist/wayuse-build.js
SERVER_DST := ../packages/server/dist/wayuse-server.js
CLIENT_DST := ../packages/wayuse/dist/wayuse-client.js
CONSOLE_DST := ../packages/build/dist/console/login.js

BUILD_CONFIG := ./rollup-build.config.ts
SERVER_CONFIG := ./rollup-server.config.ts
CLIENT_CONFIG := ./rollup-client.config.ts
CONSOLE_CONFIG := ./rollup-console.config.ts

# A bundle past its cap has taken in a module that was meant to stay external. Each cap leaves room to grow by half.
# The files of one bundle count together. Rollup decides which of them a module goes into.
BUILD_MAX_BYTES := 30000
SERVER_MAX_BYTES := 200000
CLIENT_MAX_BYTES := 30000
CONSOLE_MAX_BYTES := 60000

ALL := $(BUILD_DST) $(SERVER_DST) $(CLIENT_DST) $(CONSOLE_DST)

# The build and the tests run .ts as it is, which takes Node's own type stripping: 22.18 and up.
BUILDABLE := $(shell node -e 'console.log(process.features.typescript ? "YES" : "NO")')

####

all: is-buildable $(ALL)

# A build starts only where it can finish: with type stripping, and with the devDependencies installed.
is-buildable:
	@ [ "$(BUILDABLE)" = "YES" ] && [ -f ../node_modules/.bin/rollup ]

# The gate of `npm prepare`, turned around: an install that cannot build leaves the build alone.
is-not-buildable:
	@ [ "$(BUILDABLE)" != "YES" ] || [ ! -f ../node_modules/.bin/rollup ]

# The package name resolves to this file, for bin/wayuse-build.js and for a wayuse.config.ts alike.
$(BUILD_DST): $(BUILD_CONFIG) $(BUILD_SRC) $(ROLLUP_SRC) ../packages/build/package.json
	@mkdir -p $(dir $@)
	../node_modules/.bin/rollup -c $<
	@ls -l $@
	@test "$$(wc -c < $@)" -le $(BUILD_MAX_BYTES) || { echo "ERROR: $@ exceeds $(BUILD_MAX_BYTES) byte cap" >&2; exit 1; }
	@echo ""

# Node strips no types under node_modules, so the image runs this file and never the sources.
$(SERVER_DST): $(SERVER_CONFIG) $(SERVER_SRC) $(SHARED_SRC) $(ROLLUP_SRC) ../packages/server/package.json
	@mkdir -p $(dir $@)
	@/bin/rm -fr $(dir $@)server
	../node_modules/.bin/rollup -c $<
	@# What only Chrome needs must stay in Chrome's own file, or an image without Chrome would load it at start.
	@! grep -q "html-slim" $@ $(dir $@)server/server.js || { echo "ERROR: the server loads html-slim at start" >&2; exit 1; }
	@ls -l $@ $(dir $@)server
	@test "$$(cat $@ $(dir $@)server/*.js | wc -c)" -le $(SERVER_MAX_BYTES) || { echo "ERROR: $@ and $(dir $@)server exceed $(SERVER_MAX_BYTES) byte cap" >&2; exit 1; }
	@echo ""

# src/jwt/ is bundled here and into the server, and src/api/ here and, later, into the console.
$(CLIENT_DST): $(CLIENT_CONFIG) $(CLIENT_SRC) $(SHARED_SRC) $(ROLLUP_SRC) ../packages/wayuse/package.json
	@mkdir -p $(dir $@)
	../node_modules/.bin/rollup -c $<
	@ls -l $@
	@test "$$(wc -c < $@)" -le $(CLIENT_MAX_BYTES) || { echo "ERROR: $@ exceeds $(CLIENT_MAX_BYTES) byte cap" >&2; exit 1; }
	@echo ""

# The scripts of the console's pages, for the browser. One file stands for all of them: rollup writes them together.
$(CONSOLE_DST): $(CONSOLE_CONFIG) $(CONSOLE_SRC) $(SHARED_SRC) $(ROLLUP_SRC)
	@# A file an earlier build left there would be packed with the rest.
	@/bin/rm -fr $(dir $@)
	@mkdir -p $(dir $@)
	../node_modules/.bin/rollup -c $<
	@ls -l $(dir $@)
	@test "$$(cat $(dir $@)*.js | wc -c)" -le $(CONSOLE_MAX_BYTES) || { echo "ERROR: $(dir $@) exceeds $(CONSOLE_MAX_BYTES) byte cap" >&2; exit 1; }
	@echo ""

####

# `npm install` runs prepare, which ends here: the build is enough for it, and the tests would only slow it.
test:
	@case "$$npm_command" in \
		install|ci|pack) echo "npm $$npm_command detected: skipping full tests." ;; \
		*) $(MAKE) test-full ;; \
	esac

test-full: test-quick
	cd .. && node --test 'src/**/*.test.ts'

test-quick: all
	cd .. && node_modules/.bin/tsc --noEmit
	cd .. && node_modules/.bin/ts-refine format --check
	cd .. && node_modules/.bin/ts-refine imports --check

clean:
	/bin/rm -fr $(ALL) $(dir $(CONSOLE_DST)) $(dir $(SERVER_DST))server

.PHONY: all clean test test-full test-quick is-buildable is-not-buildable
