#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PREFIX="$ROOT/.nginx"
TEMPLATE="$ROOT/nginx/nginx.conf.template"
CONF="$PREFIX/nginx.conf"
PORT=47291

if ! command -v nginx >/dev/null 2>&1; then
  echo "nginx is not installed." >&2
  echo "Install nginx, or use Docker: docker build -t vail . && docker run --rm -p ${PORT}:80 vail" >&2
  exit 1
fi

if [[ ! -f "$ROOT/dist/index.html" ]]; then
  echo "No production build found at dist/index.html. Run npm run build first." >&2
  exit 1
fi

mkdir -p \
  "$PREFIX/logs" \
  "$PREFIX/tmp/client_body" \
  "$PREFIX/tmp/proxy" \
  "$PREFIX/tmp/fastcgi" \
  "$PREFIX/tmp/uwsgi" \
  "$PREFIX/tmp/scgi"

if [[ -f "$PREFIX/logs/nginx.pid" ]]; then
  oldpid="$(cat "$PREFIX/logs/nginx.pid" || true)"
  if [[ -n "${oldpid}" ]] && kill -0 "${oldpid}" 2>/dev/null; then
    kill "${oldpid}" || true
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      if ! kill -0 "${oldpid}" 2>/dev/null; then
        break
      fi
      sleep 0.1
    done
  fi
  rm -f "$PREFIX/logs/nginx.pid"
fi

sed "s#__ROOT__#${ROOT}#g" "$TEMPLATE" > "$CONF"
echo "Vail is being served at http://127.0.0.1:${PORT}"
exec nginx -c "$CONF" -p "$PREFIX/"
