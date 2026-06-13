#!/usr/bin/env bash
#
# One command to play Crypto Valley locally: Postgres + game-server + API + web,
# all with the fast clock, and the dev bootstrap run automatically once the API
# is up. Ctrl-C stops everything.
#
#   pnpm play
#
set -euo pipefail

# ---- config (override via env or .env) --------------------------------------
export DATABASE_URL="${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/crypto_valley}"
export API_PORT="${API_PORT:-3001}"
export GAME_SERVER_PORT="${GAME_SERVER_PORT:-8080}"
# fast clock everywhere: quick day/night cycle + crops that grow in a session
export FAST_CLOCK=1
export NEXT_PUBLIC_FAST_CLOCK=1
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:${API_PORT}}"
export NEXT_PUBLIC_GAME_WS="${NEXT_PUBLIC_GAME_WS:-ws://localhost:${GAME_SERVER_PORT}}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ---- 1) Postgres ------------------------------------------------------------
# Reachable already (any source)? Probe the URL's host:port over TCP, normalising
# localhost to IPv4 (the cluster may only listen on 127.0.0.1).
db_reachable() {
  local hp="${DATABASE_URL##*@}"
  hp="${hp%%/*}"
  local host="${hp%%:*}"
  local port="${hp##*:}"
  host="${host/localhost/127.0.0.1}"
  (exec 3<>"/dev/tcp/${host}/${port}") 2>/dev/null # subshell exit code = connected?
}
if db_reachable; then
  echo "✓ Postgres already running"
elif command -v docker >/dev/null 2>&1; then
  echo "▶ Starting Postgres (docker compose)…"
  docker compose up -d --wait
else
  echo "✗ Postgres isn't reachable and Docker isn't installed." >&2
  echo "  Start Postgres (e.g. 'docker compose up -d') and re-run 'pnpm play'." >&2
  exit 1
fi

# ---- 2) schema --------------------------------------------------------------
echo "▶ Applying migrations…"
pnpm db:migrate

# ---- 3) auto-bootstrap once the API answers ---------------------------------
(
  for _ in $(seq 1 90); do
    if curl -fsS "http://localhost:${API_PORT}/health" >/dev/null 2>&1; then
      curl -fsS -X POST "http://localhost:${API_PORT}/dev/bootstrap" >/dev/null 2>&1 \
        && echo "✓ dev bootstrap ready · open http://localhost:3000/play"
      exit 0
    fi
    sleep 1
  done
) &
BOOTSTRAP_PID=$!
trap 'kill "$BOOTSTRAP_PID" 2>/dev/null || true' EXIT

# ---- 4) all three dev servers (turbo: prefixed output, Ctrl-C stops all) -----
echo "▶ game-server :$GAME_SERVER_PORT · api :$API_PORT · web :3000  (Ctrl-C to stop)"
pnpm dev
