#!/bin/bash
# Starts wayuse-server from an image's file tree and asks it what needs neither sway nor Chrome.
# Usage: smoke.sh <rootfs> <port>
set -eu

rootfs=$1
port=$2
base=http://127.0.0.1:$port

node "$rootfs/opt/wayuse/node_modules/wayuse-server/bin/wayuse-server.js" \
    --port "$port" --config "$rootfs/etc/wayuse/wayuse.json" --vendor "$rootfs/opt/wayuse/vendor" &
trap 'kill $!' EXIT

# The server answers within a second, and a port that never opens fails the first check below.
for _ in $(seq 20); do
    curl -sf -o /dev/null "$base/ok" && break
    sleep 0.25
done

# One line per check: the path, and the status it must answer with.
check() {
    local status
    status=$(curl -s -o /dev/null -w '%{http_code}' "$base$1")
    echo "$1 $status"
    [ "$status" = "$2" ]
}

check /ok 200
check /console/ 200
check /console/js/monitor.js 200
check /vendor/novnc.js 200
check /vendor/html-ele.mjs 200
check /wayuse/config 401
check /app/chrome/tab/ 401
