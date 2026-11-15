# Force bash so `set -o pipefail` works in the recipes below.
SHELL := bash
.SHELLFLAGS := -eo pipefail -c

# Sequential by design: the bundles are quick, and -j only interleaves their output.
.NOTPARALLEL:

BUILDER_SRC := $(shell find ../src/builder -name '*.ts' -not -name '*.test.ts')
TYPES := $(wildcard ../packages/*/types/*.d.ts)
ROLLUP_SRC := $(wildcard ./*.ts)

BUILDER_DST := ../packages/wayuse-builder/dist/wayuse-builder.js
BUILDER_CONFIG := ./rollup-builder.config.ts

ALL := $(BUILDER_DST)

####

all: $(ALL)

# The package name resolves to this file, for bin/wayuse-build.js and for a wayuse.config.ts alike.
$(BUILDER_DST): $(BUILDER_CONFIG) $(BUILDER_SRC) $(ROLLUP_SRC) ../packages/wayuse-builder/package.json
	@mkdir -p $(dir $@)
	../node_modules/.bin/rollup -c $<
	@ls -l $@
	@echo ""

####

test: all
	cd .. && node_modules/.bin/tsc --noEmit
	cd .. && node --test 'src/**/*.test.ts'

clean:
	/bin/rm -fr $(ALL)

.PHONY: all clean test
