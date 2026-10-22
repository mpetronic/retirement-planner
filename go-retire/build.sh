#!/usr/bin/env bash
# Convenience delegate script to run the root build-go.sh from inside go-retire/
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/build-go.sh" "$@"
