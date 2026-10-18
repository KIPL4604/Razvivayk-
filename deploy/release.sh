#!/usr/bin/env bash
set -euo pipefail
revision="${1:?Expected full Git commit SHA}"
[[ "$revision" =~ ^[0-9a-f]{40}$ ]]
cd "$(dirname "$0")/.."
test -z "$(git status --porcelain)" || { echo 'Working tree contains changes; deployment stopped' >&2; exit 1; }
git fetch origin main
git merge-base --is-ancestor "$revision" origin/main
git switch --detach "$revision"
compose=(docker compose --env-file .env -f deploy/compose.production.yml)
"${compose[@]}" up -d --wait db redis
mkdir -p runtime/backups
umask 077
stamp=$(date -u +%Y%m%dT%H%M%SZ)
"${compose[@]}" exec -T db pg_dump -U teramont -d teramont -Fc > "runtime/backups/before-release-${stamp}.dump"
"${compose[@]}" up -d --build --wait
"${compose[@]}" exec -T api curl --fail http://127.0.0.1:8001/readyz
echo "Running revision: $revision"
