#!/bin/bash
# Keeps every given command running: one that exits is started again, after a delay that grows while they keep failing.
set -u

commands=("$@")
pids=()
delay=1

# Every child gets the signal and the time to finish, which lets Chrome save its profile.
stop() {
    trap - TERM INT
    kill -TERM $(jobs -p) 2>/dev/null
    wait
    exit 0
}
trap stop TERM INT

# A socket left from before `docker restart` would pass for a running sway.
rm -rf "${XDG_RUNTIME_DIR:?}"/*

while true; do
    started=$SECONDS

    for i in "${!commands[@]}"; do
        kill -0 "${pids[i]:-}" 2>/dev/null && continue
        echo "supervise: starting ${commands[i]}" >&2
        "${commands[i]}" &
        pids[i]=$!
    done

    wait -n "${pids[@]}"
    echo "supervise: a process exited with status $?; starting it again in ${delay}s" >&2

    # In the background, so that a signal is handled at once rather than after the delay.
    sleep "$delay" &
    wait $!

    if (( SECONDS - started < 10 )); then
        delay=$(( delay < 8 ? delay * 2 : 8 ))
    else
        delay=1
    fi
done
