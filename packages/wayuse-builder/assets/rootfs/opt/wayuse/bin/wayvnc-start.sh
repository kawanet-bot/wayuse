#!/bin/bash
# Starts one wayvnc per output: HEADLESS-n listens on 127.0.0.1:590n.
set -eu

# When one wayvnc ends the others go with it, so the supervisor brings all of them back together.
trap 'kill $(jobs -p) 2>/dev/null' EXIT
trap 'exit 143' TERM INT

until [ -S "$XDG_RUNTIME_DIR/$WAYLAND_DISPLAY" ]; do sleep 0.2; done

for n in $(seq "${WAYUSE_OUTPUTS:-1}"); do
    wayvnc --socket="$XDG_RUNTIME_DIR/wayvncctl-$n" --output="HEADLESS-$n" 127.0.0.1 "$((5900 + n))" &
done

wait -n
