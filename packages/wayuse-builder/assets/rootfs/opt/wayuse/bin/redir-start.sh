#!/bin/bash
# Starts redir in the foreground, so the supervisor sees it end and starts it again.
set -eu

. /etc/wayuse/redir.env

# The builder lets only plain words through, so splitting them expands nothing.
read -ra args <<< "$REDIR_ARGS"

exec redir -n "${args[@]}"
