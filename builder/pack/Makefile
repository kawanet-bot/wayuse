# Force bash so `set -o pipefail` works in the recipes below.
SHELL := bash
.SHELLFLAGS := -eo pipefail -c

# Sequential by design: the steps are quick and their output reads best in order.
.NOTPARALLEL:

all: pack

# What an image installs while the package is not on npm. The fixed name keeps the path in a command stable.
pack: clean
	$(MAKE) -C .. all
	cd ../.. && npm pack -w packages/wayuse-server --pack-destination builder/pack
	mv wayuse-server-*.tgz server.tgz

clean:
	/bin/rm -f *.tgz

.PHONY: all pack clean
