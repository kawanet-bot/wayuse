#!/bin/bash
# Starts @wayuse/server from an image's file tree and asks it what needs neither sway nor Chrome.
# Usage: smoke.sh <rootfs> <port> <wayuse.js>
set -eu

rootfs=$1
port=$2
wayuse=$3
base=http://127.0.0.1:$port

# A list rather than a function, so that $! is node itself and kill reaches it.
server=(
    node "$rootfs/opt/wayuse/node_modules/@wayuse/server/bin/wayuse-server.js"
    --port "$port" --config "$rootfs/etc/wayuse/wayuse.json" --htdocs "$rootfs/opt/wayuse/htdocs"
)

# The image checks tokens, so its server does not start without the key. One that did start is not waited for.
"${server[@]}" 2> /dev/null &
for _ in $(seq 20); do
    kill -0 $! 2> /dev/null || break
    sleep 0.25
done
if kill $! 2> /dev/null; then
    echo "the server started without a key" >&2
    exit 1
fi

WAYUSE_JWT_PUBLIC_KEY=$(node "$wayuse" jwt keygen | sed -n 's/^WAYUSE_JWT_PUBLIC_KEY=//p')
export WAYUSE_JWT_PUBLIC_KEY
"${server[@]}" &
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
check /console/vendor/novnc.js 200
check /console/vendor/html-ele.js 200
check /custom/styles.css 200
check /custom/script.js 200
check /wayuse/config 401
check /app/chrome/tab/ 401
