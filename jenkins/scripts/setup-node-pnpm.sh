#!/usr/bin/env bash
# Ensure Node 22 + pnpm 9 on Jenkins agents (or any host without preinstalled toolchain).
set -euo pipefail

NODE_VERSION="${NODE_VERSION:-22.13.0}"
PNPM_VERSION="${PNPM_VERSION:-9.12.0}"
TOOLS_DIR="${JENKINS_TOOLS_DIR:-${HOME:-/tmp}/.jenkins-tools}"
ENV_FILE="$TOOLS_DIR/env.sh"

mkdir -p "$TOOLS_DIR"

if command -v pnpm >/dev/null 2>&1; then
  printf 'export PATH="%s"\n' "$PATH" > "$ENV_FILE"
  echo "Toolchain ready: node $(node --version) pnpm $(pnpm --version)"
  exit 0
fi

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64) NODE_ARCH=x64 ;;
  aarch64 | arm64) NODE_ARCH=arm64 ;;
  *)
    echo "Unsupported CPU architecture: $ARCH" >&2
    exit 1
    ;;
esac

NODE_DIR="$TOOLS_DIR/node-v${NODE_VERSION}-linux-${NODE_ARCH}"
if [ ! -x "$NODE_DIR/bin/node" ]; then
  TAR="node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.gz"
  URL="https://nodejs.org/dist/v${NODE_VERSION}/${TAR}"
  echo "Installing Node.js ${NODE_VERSION} (${NODE_ARCH}) from nodejs.org"
  curl -fsSL "$URL" -o "$TOOLS_DIR/${TAR}"
  tar -xzf "$TOOLS_DIR/${TAR}" -C "$TOOLS_DIR"
  rm -f "$TOOLS_DIR/${TAR}"
fi

export PATH="$NODE_DIR/bin:$PATH"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js install failed (expected at $NODE_DIR/bin/node)" >&2
  exit 1
fi

corepack enable
corepack prepare "pnpm@${PNPM_VERSION}" --activate

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm activation failed after corepack prepare" >&2
  exit 1
fi

printf 'export PATH="%s"\n' "$PATH" > "$ENV_FILE"
echo "Toolchain ready: node $(node --version) pnpm $(pnpm --version)"
