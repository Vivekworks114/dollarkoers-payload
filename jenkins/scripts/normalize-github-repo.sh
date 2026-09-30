#!/usr/bin/env bash
# Normalize github.com URL or owner/repo → owner/repo (matches parseGithubRepo.ts).
set -euo pipefail

input="${1:-}"
input="$(printf '%s' "$input" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"

if [ -z "$input" ]; then
  echo "github repo is required" >&2
  exit 1
fi

path="$input"
path="${path#git@github.com:}"
path="${path#git@github.com/}"
path="${path#https://github.com/}"
path="${path#http://github.com/}"
path="${path#github.com/}"
path="${path%.git}"
path="${path%/}"

if [[ ! "$path" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
  echo "Invalid GitHub repo '$input' — use owner/repo or a github.com URL" >&2
  exit 1
fi

printf '%s' "$path"
