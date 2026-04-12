#!/bin/sh
# shellcheck shell=sh

REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

codex() {
	"$REPO_ROOT/.codex/bin/codex-safe" "$@"
}

export CODEX_REPO_ROOT="$REPO_ROOT"
echo "Codex wrapper active for $REPO_ROOT"
echo "Commands now route through .codex/bin/codex-safe"
