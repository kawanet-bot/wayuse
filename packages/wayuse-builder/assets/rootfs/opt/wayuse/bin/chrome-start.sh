#!/bin/bash
# Starts Chrome on the sway session, with no window until a client opens one.
set -eu

PROFILE=$HOME/.config/chrome

until [ -S "$XDG_RUNTIME_DIR/$WAYLAND_DISPLAY" ]; do sleep 0.2; done

# A lock left by a killed Chrome would refuse this start.
rm -f "$PROFILE"/Singleton*

# The variables of apps.chrome.env reach this process alone.
set -a
. /etc/wayuse/chrome.env
set +a

args=(
    --ozone-platform=wayland
    --disable-gpu
    --password-store=basic
    --no-first-run
    --no-default-browser-check
    --remote-debugging-port=9222
    --user-data-dir="$PROFILE"
    --profile-directory=Default
    # Closing the last window must not end Chrome.
    --no-startup-window
    # Docker gives a container neither the namespaces of the sandbox nor a large /dev/shm.
    --no-sandbox
    --disable-dev-shm-usage
)

if [ -n "${WAYUSE_USER_AGENT:-}" ]; then
    args+=("--user-agent=$WAYUSE_USER_AGENT")
fi

exec google-chrome "${args[@]}"
