# Force bash so `set -o pipefail` works in the recipes below.
SHELL := bash
.SHELLFLAGS := -eo pipefail -c

# Sequential by design: the bundles are quick, and -j only interleaves their output.
.NOTPARALLEL:

BUILDER_SRC := $(shell find ../src/builder -name '*.ts' -not -name '*.test.ts')
SERVER_SRC := $(shell find ../src/server -name '*.ts' -not -name '*.test.ts')
CLIENT_SRC := $(shell find ../src/client -name '*.ts' -not -name '*.test.ts')
SHARED_SRC := $(shell find ../src/jwt ../src/api -name '*.ts' -not -name '*.test.ts')
CONSOLE_SRC := $(shell find ../src/console -name '*.ts' -not -name '*.test.ts')
TYPES := $(wildcard ../packages/*/types/*.d.ts)
ROLLUP_SRC := $(wildcard ./*.ts)

BUILDER_DST := ../packages/wayuse-builder/dist/wayuse-builder.js
SERVER_DST := ../packages/wayuse-server/dist/wayuse-server.js
CLIENT_DST := ../packages/wayuse-client/dist/wayuse-client.js
CONSOLE_DST := ../packages/wayuse-server/dist/console/login.js

BUILDER_CONFIG := ./rollup-builder.config.ts
SERVER_CONFIG := ./rollup-server.config.ts
CLIENT_CONFIG := ./rollup-client.config.ts
CONSOLE_CONFIG := ./rollup-console.config.ts

ALL := $(BUILDER_DST) $(SERVER_DST) $(CLIENT_DST) $(CONSOLE_DST)

####

all: $(ALL)

# The package name resolves to this file, for bin/wayuse-build.js and for a wayuse.config.ts alike.
$(BUILDER_DST): $(BUILDER_CONFIG) $(BUILDER_SRC) $(ROLLUP_SRC) ../packages/wayuse-builder/package.json
	@mkdir -p $(dir $@)
	../node_modules/.bin/rollup -c $<
	@ls -l $@
	@echo ""

# Node strips no types under node_modules, so the image runs this file and never the sources.
$(SERVER_DST): $(SERVER_CONFIG) $(SERVER_SRC) $(SHARED_SRC) $(ROLLUP_SRC) ../packages/wayuse-server/package.json
	@mkdir -p $(dir $@)
	../node_modules/.bin/rollup -c $<
	@ls -l $@
	@echo ""

# src/jwt/ is bundled here and into the server, and src/api/ here and, later, into the console.
$(CLIENT_DST): $(CLIENT_CONFIG) $(CLIENT_SRC) $(SHARED_SRC) $(ROLLUP_SRC) ../packages/wayuse-client/package.json
	@mkdir -p $(dir $@)
	../node_modules/.bin/rollup -c $<
	@ls -l $@
	@echo ""

# The scripts of the console's pages, for the browser. One file stands for all of them: rollup writes them together.
$(CONSOLE_DST): $(CONSOLE_CONFIG) $(CONSOLE_SRC) $(SHARED_SRC) $(ROLLUP_SRC)
	@mkdir -p $(dir $@)
	../node_modules/.bin/rollup -c $<
	@ls -l $(dir $@)
	@echo ""

####

test: test-quick
	cd .. && node --test 'src/**/*.test.ts'

test-quick: all
	cd .. && node_modules/.bin/tsc --noEmit
	cd .. && node_modules/.bin/ts-refine format --check
	cd .. && node_modules/.bin/ts-refine imports --check

clean:
	/bin/rm -fr $(ALL) $(dir $(CONSOLE_DST))

.PHONY: all clean test test-quick
