#!/bin/bash
# Starts one redir per line of redir.conf. It listens on the port, and forwards to the address beside it.
set -eu

# When one redir ends the others go with it, so the supervisor brings all of them back together.
trap 'kill $(jobs -p) 2>/dev/null' EXIT
trap 'exit 143' TERM INT

# Each runs in the foreground, as a job of this script. A redir in the background would look ended.
while read -r port target; do
    redir -n ":$port" "$target" &
done < /etc/wayuse/redir.conf

wait -n
