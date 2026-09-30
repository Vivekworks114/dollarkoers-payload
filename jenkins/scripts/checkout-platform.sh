#!/usr/bin/env bash
# Checkout dollarkoers platform repo into ./platform
set -euo pipefail

PLATFORM_DIR="${PLATFORM_DIR:-platform}"
PLATFORM_GIT_URL="${PLATFORM_GIT_URL:-}"
PLATFORM_GIT_BRANCH="${PLATFORM_GIT_BRANCH:-main}"
PLATFORM_GIT_TOKEN="${PLATFORM_GIT_TOKEN:-${GITHUB_TOKEN:-}}"
WORKSPACE="${WORKSPACE:-$(pwd)}"

cd "$WORKSPACE"

# Jenkins Pipeline from SCM: workspace is already the platform repo — reuse it.
if [ -f "pnpm-workspace.yaml" ] && [ -d "apps/payload" ] && [ -d "jenkins/scripts" ]; then
  if [ "$PLATFORM_DIR" != "." ]; then
    rm -rf "$PLATFORM_DIR"
    ln -sfn "$WORKSPACE" "$PLATFORM_DIR"
  fi
  echo "Reusing Jenkins workspace as platform ($PLATFORM_DIR -> $WORKSPACE)"
  exit 0
fi

if [ -z "$PLATFORM_GIT_URL" ]; then
  OWNER="${GITHUB_OWNER:-}"
  REPO="${GITHUB_REPO:-dollarkoers}"
  if [ -z "$OWNER" ]; then
    echo "Set PLATFORM_GIT_URL or GITHUB_OWNER + GITHUB_REPO (or run from a checked-out dollarkoers workspace)" >&2
    exit 1
  fi
  PLATFORM_GIT_URL="https://github.com/${OWNER}/${REPO}.git"
fi

rm -rf "$PLATFORM_DIR"
mkdir -p "$PLATFORM_DIR"

if [ -n "$PLATFORM_GIT_TOKEN" ]; then
  AUTH_URL="$(echo "$PLATFORM_GIT_URL" | sed -E "s#https://#https://x-access-token:${PLATFORM_GIT_TOKEN}@#")"
  git clone --depth 1 --branch "$PLATFORM_GIT_BRANCH" "$AUTH_URL" "$PLATFORM_DIR"
else
  git clone --depth 1 --branch "$PLATFORM_GIT_BRANCH" "$PLATFORM_GIT_URL" "$PLATFORM_DIR"
fi

echo "Platform checked out at $PLATFORM_DIR (branch $PLATFORM_GIT_BRANCH)"
