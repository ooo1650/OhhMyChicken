#!/bin/sh
# Run by cPanel's Git Version Control (.cpanel.yml) from the repository's folder.
# Copies the code into the Node.js app folder, installs packages if they changed,
# and restarts the app. The app folder's .env and photos are never touched.
#
# App folder: ~/omc-api by default; set APP_DIR on the line in .cpanel.yml to change it.
set -eu
APP=${APP_DIR:-$HOME/omc-api}
echo "Deploying $(git rev-parse --short HEAD 2>/dev/null) to $APP"

mkdir -p "$APP/tmp"
# Code: replaced whole, so deleted files go too.
rsync -a --delete src/ "$APP/src/"
rsync -a --delete scripts/ "$APP/scripts/"

# Packages: only reinstalled when the package list changed.
if ! cmp -s package-lock.json "$APP/package-lock.json"; then
  cp package.json package-lock.json "$APP/"
  # cPanel keeps each Node.js app's packages in ~/nodevenv/<app>/<version>/.
  VENV=$(ls -d "$HOME/nodevenv/$(basename "$APP")"/*/bin/activate 2>/dev/null | sort -V | tail -1 || true)
  if [ -n "$VENV" ]; then
    . "$VENV"
    (cd "$APP" && npm install --omit=dev --no-audit --no-fund) # not npm ci: it would delete the node_modules link cPanel made
    echo "Packages installed"
  else
    echo "Create the Node.js app first (Setup Node.js App, root: $(basename "$APP")), then deploy again." >&2
    exit 1
  fi
else
  cp package.json "$APP/"
fi

# Passenger restarts the app when this file's date changes.
touch "$APP/tmp/restart.txt"
echo "Done: the app restarts on its next request"
