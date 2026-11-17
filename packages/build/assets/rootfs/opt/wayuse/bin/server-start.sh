#!/bin/bash
# Starts the HTTP server by its full path, which tells it apart from any other node in `ps`.
set -eu

exec node /opt/wayuse/node_modules/@wayuse/server/bin/wayuse-server.js --port=9580
