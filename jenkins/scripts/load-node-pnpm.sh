#!/usr/bin/env bash
# Load Node/pnpm PATH after setup-node-pnpm.sh (works across bash subshells).
set -euo pipefail

TOOLS_DIR="${JENKINS_TOOLS_DIR:-${HOME:-/tmp}/.jenkins-tools}"
ENV_FILE="$TOOLS_DIR/env.sh"

if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi
