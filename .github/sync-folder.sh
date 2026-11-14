#!/bin/sh
# Copies one folder of this repository, with its history, to its own GitHub repository
# (run by the sync-repos job in workflows/ci-cd.yml):
#   SYNC_KEY=<deploy key> sh .github/sync-folder.sh backend owner/backend-repo
# The folder's commits are rebuilt the same way every time, so each run only adds
# the new ones. The push is never forced: if someone committed straight to the other
# repository, this stops instead of throwing their work away.
# SYNC_REMOTE replaces the GitHub address (for trying it out on a local repository).
set -eu
FOLDER=$1
REPO=$2

if [ -z "$REPO" ] || [ -z "${SYNC_KEY:-}${SYNC_REMOTE:-}" ]; then
  echo "::notice::$FOLDER/ not copied: its repository variable or deploy key isn't set"
  exit 0
fi
echo "$REPO" | grep -Eq '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$' || { echo "::error::$FOLDER: the repository should look like owner/name"; exit 1; }

if [ -n "${SYNC_KEY:-}" ]; then
  (umask 077; printf '%s\n' "$SYNC_KEY" > "$HOME/.ssh/sync_key")
  export GIT_SSH_COMMAND="ssh -i $HOME/.ssh/sync_key -o IdentitiesOnly=yes"
fi

git subtree split -q --prefix="$FOLDER" -b "sync-$FOLDER" >/dev/null
echo "$FOLDER/ is at $(git rev-parse --short "sync-$FOLDER")"
git push "${SYNC_REMOTE:-git@github.com:$REPO.git}" "sync-$FOLDER:main"
git branch -D "sync-$FOLDER" >/dev/null
