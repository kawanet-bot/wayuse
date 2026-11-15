#!/bin/bash
# Starts sway with one headless output per screen: HEADLESS-1 and up.
set -eu

export WLR_BACKENDS=headless WLR_RENDERER=pixman WLR_LIBINPUT_NO_DEVICES=1
export WLR_HEADLESS_OUTPUTS=${WAYUSE_OUTPUTS:-1}

# sway names its own socket: a name set beforehand would read as a compositor to connect to.
unset WAYLAND_DISPLAY

# sway takes the path in SWAYSOCK only while nothing is there.
rm -f "$SWAYSOCK"

exec sway -c /etc/wayuse/sway/config
