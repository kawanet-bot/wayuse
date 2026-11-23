#!/bin/bash
# Starts the session D-Bus. Chrome keeps logging errors without one.
set -eu

# Where a program looks for the session bus when it is given no address.
export DBUS_SESSION_BUS_ADDRESS="unix:path=$XDG_RUNTIME_DIR/bus"

exec dbus-daemon --session --nofork --address="$DBUS_SESSION_BUS_ADDRESS"
