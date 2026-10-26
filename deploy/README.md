# Deploying to an Ubuntu server

Every push and pull request runs the tests in GitHub Actions ([.github/workflows/ci-cd.yml](../.github/workflows/ci-cd.yml)). A push to **`main`** that passes them is deployed:

```
push ─► Tests ─┐            (unit + API tests on Postgres, build, end-to-end, audit)
       Docker ─┴─► Deploy   (SSH to the server → remote-deploy.sh)
                     │
                     ├─ git pull (fast-forward to the exact tested commit)
                     ├─ docker compose up -d --build
                     ├─ health check: /healthz and /api/menu
                     └─ unhealthy? roll back to the previous commit
```

The server pulls the code itself, and secrets stay on the server: `.env` never goes through GitHub.

## 1. Prepare the server (once)

Ubuntu 22.04 or 24.04, as a user with `sudo`.

```bash
# Docker Engine + Compose plugin (official repository), git, curl
sudo apt update && sudo apt install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt update && sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# A dedicated user for deployments
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker deploy      # note: docker access is root-equivalent; use this user only for deploys
sudo mkdir -p /srv/ohhmychicken && sudo chown deploy:deploy /srv/ohhmychicken

# Firewall: SSH and HTTPS only (the app port stays on localhost, see APP_BIND)
sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw enable
```

## 2. Let the server pull the repository

The repository is `github.com/ooo1650/OhhMyChicken`.

**Public repository:** clone over HTTPS, nothing else needed.

**Private repository:** give the server a read-only *deploy key*:

```bash
sudo -iu deploy
ssh-keygen -t ed25519 -f ~/.ssh/omc_repo -N "" -C "ohhmychicken server (read-only)"
cat ~/.ssh/omc_repo.pub     # GitHub → repo → Settings → Deploy keys → Add (leave "write access" OFF)
cat >> ~/.ssh/config <<'CFG'
Host github.com
  IdentityFile ~/.ssh/omc_repo
  IdentitiesOnly yes
CFG
ssh -T git@github.com       # answer "yes" once; it should greet you
```

Then clone (as `deploy`):

```bash
git clone https://github.com/ooo1650/OhhMyChicken.git /srv/ohhmychicken       # public
git clone git@github.com:ooo1650/OhhMyChicken.git /srv/ohhmychicken           # private
cd /srv/ohhmychicken && git checkout main
```

## 3. Secrets on the server: `.env`

```bash
cd /srv/ohhmychicken
cp .env.example .env && chmod 600 .env
nano .env
```

Set at least:

| Variable | Value |
| --- | --- |
| `POSTGRES_PASSWORD` | `openssl rand -hex 24` (letters and digits only) |
| `ADMIN_PASSCODE` | A long passcode only you know. The backend won't start without it. |
| `PUBLIC_URL` | `https://your-domain.com` |
| `APP_BIND` | `127.0.0.1` (only the HTTPS proxy may reach the app) |
| `ADMIN_PATH` | Something unguessable, e.g. `staff-7f3k` |
| `FRONTEND_TRUST_PROXY` / `TRUST_PROXY` | `1` / `2` when Caddy or Nginx is in front |

First start, by hand, to see that everything works:

```bash
docker compose up -d --build
curl -fsS http://127.0.0.1:3000/healthz && curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/api/menu
```

## 4. HTTPS in front

[Caddy](https://caddyserver.com/docs/install#debian-ubuntu-raspbian) gets and renews certificates by itself. `/etc/caddy/Caddyfile`:

```
your-domain.com {
  reverse_proxy 127.0.0.1:3000
}
```

`sudo systemctl reload caddy`, and point your domain's DNS A record at the server.

## 5. A key for GitHub Actions to log in

On **your computer** (not the server), make a key used only for deployments:

```bash
ssh-keygen -t ed25519 -f omc_actions -N "" -C "github-actions deploy"
```

Put the **public** half on the server:

```bash
# on the server
sudo -iu deploy
mkdir -p ~/.ssh && chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys      # paste the line from omc_actions.pub
chmod 600 ~/.ssh/authorized_keys
```

Pin the server's identity, so a fake server can't receive the deploy. On your computer:

```bash
ssh-keyscan -p 22 your-server-ip > known_hosts_line
ssh-keygen -lf known_hosts_line                      # fingerprint seen from outside
# on the server, it must match:  ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

## 6. GitHub secrets

GitHub → repo → **Settings → Environments → New environment → `production`**. Optionally add yourself under *Required reviewers* to approve each deploy. Add these **environment secrets**:

| Secret | Value |
| --- | --- |
| `SSH_PRIVATE_KEY` | Full contents of `omc_actions`, the private key file, including the BEGIN/END lines |
| `SSH_KNOWN_HOSTS` | Full contents of `known_hosts_line` |
| `SSH_HOST` | Server IP or hostname |
| `SSH_USER` | `deploy` |
| `SSH_PORT` | Only if SSH isn't on 22 |
| `DEPLOY_PATH` | `/srv/ohhmychicken` |

Then delete `omc_actions` and `known_hosts_line` from your computer, or keep them in a password manager. Never commit them.

## 7. Deploy

Push to `main`. Your local branch is `master`, so either rename it (`git branch -m master main && git branch -u origin/main`) or push with `git push origin master:main`.

Watch it under the repo's **Actions** tab. The deploy job prints each step. On failure it prints the container logs and rolls back.

## Good to know

- **Never edit files on the server.** The deploy refuses to run over local changes. Change code in git; change settings in `.env`, then run `docker compose up -d`.
- **Data is safe across deploys.** The database (`omc-data`) and photos (`omc-media`) are Docker volumes. Deploys rebuild containers, never volumes. Don't run `docker compose down -v` on the server.
- **Backups:** see "Backups" in the main README. Run them from cron, and copy them off the server.
- **Manual rollback:** `cd /srv/ohhmychicken && git log --oneline -5`, then `git reset --hard <commit> && docker compose up -d --build`. The next push to `main` moves it forward again.
- **Run the tests locally:** `cd backend && DATABASE_URL=postgres://… npm test`, and `cd frontend && npm run build && BACKEND_URL=http://localhost:4000 npm test`. Without those variables, the database and server tests are skipped.
