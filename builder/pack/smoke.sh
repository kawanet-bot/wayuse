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
    --port "$port" --config "$rootfs/opt/wayuse/wayuse.config.json" --htdocs "$rootfs/opt/wayuse/htdocs"
)

# The server answers within a second, and a port that never opens fails the first check after this.
ready() {
    for _ in $(seq 20); do
        curl -s -o /dev/null "$base/ok" && break
        sleep 0.25
    done
}

# One line per check: the path, and the status it must answer with.
check() {
    local status
    status=$(curl -s -o /dev/null -w '%{http_code}' "$base$1")
    echo "$1 $status"
    [ "$status" = "$2" ]
}

# The image checks tokens, so without the key its server is out of service wherever it is asked.
# A key the caller's shell has is left out, as it would put the server in service.
env -u WAYUSE_JWT_PUBLIC_KEY "${server[@]}" 2> /dev/null &
trap 'kill $! 2> /dev/null' EXIT
ready
check /ok 503
check /console/ 503
check /wayuse/config 503

# The port is free for the next server only once this one is gone.
kill $!
wait $! 2> /dev/null || true

WAYUSE_JWT_PUBLIC_KEY=$(node "$wayuse" jwt keygen | sed -n 's/^WAYUSE_JWT_PUBLIC_KEY=//p')
export WAYUSE_JWT_PUBLIC_KEY
"${server[@]}" &
ready
check /ok 200
check /console/ 200
check /console/js/monitor.js 200
check /console/vendor/novnc.js 200
check /console/vendor/html-ele.js 200
check /custom/styles.css 200
check /custom/script.js 200
check /wayuse/config 401
check /app/chrome/tab/ 401
