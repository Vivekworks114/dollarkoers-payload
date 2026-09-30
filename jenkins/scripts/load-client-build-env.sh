#!/usr/bin/env bash
# Load optional per-tenant build/runtime env for Astro client builds.
#
# Sources (first match wins):
#   1. CLIENT_BUILD_ENV_FILE — path to a dotenv file (Jenkins Secret file binding)
#   2. DOLLARKOERS_CLIENT_ENV_DIR/<tenant>.env — agent file drop
#      (default dir: $JENKINS_HOME/dollarkoers-client-env)
#
# Safe dotenv parse only (KEY=VALUE). Does not `source` the file.
# If SITE_ROOT is set, writes a .env there so Astro/Vite auto-loads it.
#
# Must be sourced from tenant-deploy.sh so exports remain in the build shell:
#   # shellcheck source=load-client-build-env.sh
#   source "$SCRIPT_DIR/load-client-build-env.sh"

set -euo pipefail

TENANT="${TENANT:-${tenant_slug:-}}"
SITE_ROOT="${SITE_ROOT:-}"

_resolve_client_env_file() {
  if [ -n "${CLIENT_BUILD_ENV_FILE:-}" ] && [ -f "$CLIENT_BUILD_ENV_FILE" ]; then
    printf '%s\n' "$CLIENT_BUILD_ENV_FILE"
    return 0
  fi

  if [ -z "$TENANT" ]; then
    return 1
  fi

  local dir="${DOLLARKOERS_CLIENT_ENV_DIR:-}"
  if [ -z "$dir" ] && [ -n "${JENKINS_HOME:-}" ]; then
    dir="${JENKINS_HOME}/dollarkoers-client-env"
  fi
  if [ -z "$dir" ]; then
    return 1
  fi

  if [ -f "${dir}/${TENANT}.env" ]; then
    printf '%s\n' "${dir}/${TENANT}.env"
    return 0
  fi
  return 1
}

CLIENT_ENV_FILE=""
if ! CLIENT_ENV_FILE="$(_resolve_client_env_file)"; then
  echo "Client build env: none (optional). For tenant=${TENANT:-<unset>}, create Jenkins Secret file"
  echo "  credential id dollarkoers-site-env-<slug> or file \$JENKINS_HOME/dollarkoers-client-env/<slug>.env"
  return 0 2>/dev/null || true
fi

CLIENT_ENV_KEYS=()
CLIENT_ENV_TMP="$(mktemp)"
if [[ "${BASH_SOURCE[0]}" != "${0}" ]]; then
  trap 'rm -f "$CLIENT_ENV_TMP"' RETURN
else
  trap 'rm -f "$CLIENT_ENV_TMP"' EXIT
fi

# Parse dotenv safely into exports + a filtered copy for SITE_ROOT/.env
while IFS= read -r line || [ -n "$line" ]; do
  line="${line%$'\r'}"
  case "$line" in
    ''|\#*) continue ;;
  esac
  case "$line" in
    export\ *) line="${line#export }" ;;
  esac
  case "$line" in
    *=*) ;;
    *) continue ;;
  esac

  key="${line%%=*}"
  value="${line#*=}"
  key="$(printf '%s' "$key" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  case "$key" in
    ''|[0-9]*|*[!A-Za-z0-9_]*) continue ;;
  esac

  if [ "${#value}" -ge 2 ]; then
    first="${value:0:1}"
    last="${value: -1}"
    if [ "$first" = '"' ] && [ "$last" = '"' ]; then
      value="${value:1:${#value}-2}"
    elif [ "$first" = "'" ] && [ "$last" = "'" ]; then
      value="${value:1:${#value}-2}"
    fi
  fi

  export "${key}=${value}"
  CLIENT_ENV_KEYS+=("$key")
  # Escape nothing special beyond writing literal value; Astro dotenv is KEY=VAL lines.
  printf '%s=%s\n' "$key" "$value" >> "$CLIENT_ENV_TMP"
done < "$CLIENT_ENV_FILE"

KEY_COUNT="${#CLIENT_ENV_KEYS[@]}"

if [ -n "$SITE_ROOT" ] && [ -d "$SITE_ROOT" ]; then
  umask 077
  cp "$CLIENT_ENV_TMP" "$SITE_ROOT/.env"
  chmod 600 "$SITE_ROOT/.env"
  echo "Client build env: wrote $SITE_ROOT/.env ($KEY_COUNT key(s) from $CLIENT_ENV_FILE)"
else
  echo "Client build env: exported $KEY_COUNT key(s) from $CLIENT_ENV_FILE (no SITE_ROOT/.env write)"
fi

if [ "$KEY_COUNT" -gt 0 ]; then
  echo "Client build env keys: ${CLIENT_ENV_KEYS[*]}"
fi
