#!/bin/bash
# Starts the session D-Bus that sway, Chrome and `docker exec` share: Chrome keeps logging errors without one.
set -eu

exec dbus-daemon --session --nofork --address="$DBUS_SESSION_BUS_ADDRESS"
