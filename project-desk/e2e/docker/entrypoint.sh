#!/usr/bin/env bash
# Runs the suite, then publishes artifacts. The pod exits with the Cypress
# result even when publishing fails.
set -uo pipefail

env_file="${E2E_ENV_FILE:-/e2e/.env}"
if [ -f "$env_file" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ''|\#*) continue ;;
    esac
    key="${line%%=*}"
    value="${line#*=}"
    case "$value" in
      \"*\") value="${value#\"}"; value="${value%\"}" ;;
      \'*\') value="${value#\'}"; value="${value%\'}" ;;
    esac
    if [ -z "${key}" ] || [ -n "${!key+x}" ]; then
      continue
    fi
    export "${key}=${value}"
  done < "$env_file"
fi

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
export E2E_RUN_ID="${E2E_RUN_ID:-${stamp}-${E2E_JOB_NAME:-local}}"
export E2E_ARTIFACTS_DIR="${E2E_ARTIFACTS_ROOT:-/artifacts}/${E2E_RUN_ID}"
if ! mkdir -p "$E2E_ARTIFACTS_DIR"; then
  echo "Cannot create ${E2E_ARTIFACTS_DIR}; the artifacts volume must be writable by uid $(id -u)"
  exit 2
fi

# tini -g sends SIGTERM to the whole process group. tee ignores it so the
# log keeps flowing while the runner writes its summary and artifacts upload.
exec > >(trap '' TERM; exec tee -a "$E2E_ARTIFACTS_DIR/run.log") 2>&1
trap 'echo "SIGTERM received; waiting for the runner to record the result"' TERM

node /e2e/scripts/run.mjs "$@"
status=$?

node /e2e/scripts/publish.mjs || echo "Artifact publishing exited with $?; keeping test exit code ${status}"
echo "Exiting with ${status}"
exit "$status"
