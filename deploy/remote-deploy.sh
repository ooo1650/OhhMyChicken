#!/usr/bin/env bash
# ==========================================================================
# Runs ON THE SERVER. The GitHub Actions deploy job pipes it over SSH:
#   ssh deploy@server 'bash -s -- <app dir> <branch> <commit sha>' < deploy/remote-deploy.sh
# Pulls exactly the tested commit, rebuilds with Docker Compose, checks the
# site answers, and rolls back to the previous commit if it doesn't.
# ==========================================================================
set -euo pipefail

APP_DIR=${1:?app directory}
BRANCH=${2:?branch}
SHA=${3:?commit sha}

log()  { printf '\n==> %s\n' "$*"; }
fail() { printf '\n::error::%s\n' "$*" >&2; exit 1; }

[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || fail "Not a commit sha: $SHA"
[[ "$BRANCH" =~ ^[A-Za-z0-9._/-]+$ ]] || fail "Unexpected branch name: $BRANCH"
command -v docker >/dev/null || fail "Docker is not installed on the server."
command -v curl >/dev/null || fail "curl is not installed on the server (sudo apt install curl)."

cd "$APP_DIR" || fail "$APP_DIR does not exist. Clone the repository there first (see deploy/README.md)."
[ -f .env ] || fail ".env is missing in $APP_DIR. Create it from .env.example (it never comes from git)."
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  git status --short
  fail "The server copy has local changes. Commit them in git instead of editing on the server, then run: git -C $APP_DIR checkout -- ."
fi

# Read APP_PORT from .env (default 3000) for the health check.
APP_PORT=$(grep -E '^APP_PORT=' .env | tail -n1 | cut -d= -f2- | tr -d '"'"'"' ' || true)
APP_PORT=${APP_PORT:-3000}
URL="http://127.0.0.1:${APP_PORT}"

healthy() {
  # The page server answers, and /api reaches the backend and the database.
  for _ in $(seq 1 60); do
    if curl -fsS -o /dev/null "$URL/healthz" && curl -fsS -o /dev/null "$URL/api/menu"; then return 0; fi
    sleep 3
  done
  return 1
}

up() {
  docker compose up -d --build --remove-orphans
}

PREV=$(git rev-parse HEAD)
log "Deploying $BRANCH @ ${SHA:0:12} (currently ${PREV:0:12})"
git fetch --prune origin "$BRANCH"
git checkout -q "$BRANCH"
git merge --ff-only "$SHA" || fail "Can't fast-forward to ${SHA:0:12}. Was history rewritten on $BRANCH?"

log "Building and starting containers"
if up && healthy; then
  log "Healthy at $URL. Cleaning up old images."
  docker image prune -f >/dev/null || true
  log "Deployed ${SHA:0:12}"
  exit 0
fi

log "Deploy of ${SHA:0:12} is NOT healthy. Recent logs:"
docker compose logs --tail=60 backend frontend || true

if [ "$PREV" != "$SHA" ]; then
  log "Rolling back to ${PREV:0:12}"
  git reset -q --hard "$PREV"
  if up && healthy; then
    fail "Deploy failed; rolled back to ${PREV:0:12}, which is healthy. Fix and push again."
  fi
  fail "Deploy failed AND the rollback to ${PREV:0:12} is unhealthy. Check the server now: cd $APP_DIR && docker compose logs"
fi
fail "Deploy failed and there is no previous version to roll back to."
