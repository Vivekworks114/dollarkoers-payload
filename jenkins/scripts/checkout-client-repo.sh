#!/usr/bin/env bash
# Checkout external client site repo into ./site (after resolve-client-github-token.sh)
set -euo pipefail

SITE_DIR="${SITE_DIR:-site}"
RAW_REPO="${GITHUB_REPO:-${github_repo:-}}"
GITHUB_BRANCH="${GITHUB_BRANCH:-${github_branch:-main}}"

if [ -z "$RAW_REPO" ]; then
  echo "GITHUB_REPO is required for external deploy" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GITHUB_REPO="$(bash "$SCRIPT_DIR/normalize-github-repo.sh" "$RAW_REPO")"
export GITHUB_REPO

TOKEN="${CLIENT_GITHUB_TOKEN:-}"
if [ -z "$TOKEN" ] && [ -f "${JENKINS_TOOLS_DIR:-${HOME:-/tmp}/.jenkins-tools}/client-github-token.env" ]; then
  # shellcheck disable=SC1090
  source "${JENKINS_TOOLS_DIR:-${HOME:-/tmp}/.jenkins-tools}/client-github-token.env"
  TOKEN="${CLIENT_GITHUB_TOKEN:-}"
fi
if [ -z "$TOKEN" ]; then
  TOKEN="${EXTERNAL_REPO_GITHUB_TOKEN:-}"
fi
if [ -z "$TOKEN" ]; then
  echo "No CLIENT_GITHUB_TOKEN — run resolve-client-github-token.sh first (must source, not bash)" >&2
  exit 1
fi

HTTP_CODE="$(curl -sS -o /dev/null -w '%{http_code}' \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/${GITHUB_REPO}" || echo "000")"

if [ "$HTTP_CODE" != "200" ]; then
  echo "ERROR: GitHub token cannot access ${GITHUB_REPO} (HTTP ${HTTP_CODE})." >&2
  echo "  Token source: ${CLIENT_GITHUB_TOKEN_SOURCE:-unknown}" >&2
  echo "  Tenant slug:  ${TENANT:-${tenant_slug:-<not set>}}" >&2
  if [ "$HTTP_CODE" = "404" ]; then
    echo "  Fix: In Payload admin, open the tenant → GitHub tab → link a PAT with read access to this repo." >&2
    echo "       When testing in Jenkins manually, tenant_slug must match the Payload tenant slug." >&2
  fi
  exit 1
fi

rm -rf "$SITE_DIR"
git clone --depth 1 --branch "$GITHUB_BRANCH" \
  "https://x-access-token:${TOKEN}@github.com/${GITHUB_REPO}.git" \
  "$SITE_DIR"

echo "Client repo checked out at $SITE_DIR ($GITHUB_REPO @ $GITHUB_BRANCH)"
