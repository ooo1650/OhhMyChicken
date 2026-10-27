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

**Two ways to reach the server.** Set the repository *variable* `DEPLOY_MODE` (Settings → Secrets and variables → Actions → **Variables**):

| `DEPLOY_MODE` | Use when | Needs |
| --- | --- | --- |
| `runner` | The server is a VM on a **private network** (not reachable from the internet) | A self-hosted runner on the server (step 5a). No secrets. |
| `ssh` | The server has a public IP / hostname | The SSH secrets (steps 5b and 6) |
| *(unset)* | Not set up yet | Nothing. Tests run; the deploy is skipped. |

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
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable   # 'Nginx Full' = ports 80 + 443 (after installing nginx in step 4; or: ufw allow 80,443/tcp)
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
| `FRONTEND_TRUST_PROXY` / `TRUST_PROXY` | `1` / `2` when Nginx (step 4) is in front |

**Private VM reached over the LAN, no domain or HTTPS yet:** use `PUBLIC_URL=http://<vm-ip>:3000`, `APP_BIND=0.0.0.0` (so other machines on the LAN can reach it) and `COOKIE_SECURE=false` (otherwise browsers drop the admin login cookie over plain HTTP). Or put Nginx in front even on the LAN (end of step 4), which adds the edge rate limits. Switch to the HTTPS settings before it faces the internet.

First start, by hand, to see that everything works:

```bash
docker compose up -d --build
curl -fsS http://127.0.0.1:3000/healthz && curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/api/menu
```

## 4. Nginx in front (HTTPS, edge rate limits)

The ready-made config is [deploy/nginx/ohhmychicken.conf](nginx/ohhmychicken.conf). It's tested in front of this app, and it:

- Passes the original `Host` (port included), so logins and orders aren't refused as "cross-site".
- **Replaces** `X-Forwarded-For` with the visitor's real IP, so nobody can fake their address past the rate limits.
- Rate-limits at the edge: pages 20/s, API 10/s and staff login 6/min per IP, plus 40 connections per IP. Excess gets `429` before reaching Node.
- Allows 12 MB bodies only on the photo upload endpoint, and 1 MB everywhere else. It buffers uploads, so slow phones don't tie up the app.
- Drops slow-header (slowloris) clients, hides the Nginx version, and redirects `www` to the bare domain (one canonical URL for SEO).

**Install** (on the server):

```bash
sudo apt install -y nginx certbot python3-certbot-nginx

sudo cp /srv/ohhmychicken/deploy/nginx/ohhmychicken.conf /etc/nginx/sites-available/ohhmychicken
sudo sed -i 's/example\.com/your-domain.com/g' /etc/nginx/sites-available/ohhmychicken   # your real domain
sudo ln -s /etc/nginx/sites-available/ohhmychicken /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Point your domain's DNS **A record** (and `www`) at the server, then get a free HTTPS certificate. Certbot adds the 443 listener, the http→https redirect and automatic renewal:

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com --redirect
sudo certbot renew --dry-run      # renewal works
```

**`.env` to match**, then `docker compose up -d`:

| Variable | Value | Why |
| --- | --- | --- |
| `APP_BIND` | `127.0.0.1` | Only Nginx can reach the app. Docker ports bypass `ufw`, so `0.0.0.0` would expose plain HTTP. |
| `PUBLIC_URL` | `https://your-domain.com` | Canonical links, sitemap, HSTS |
| `FRONTEND_TRUST_PROXY` | `1` | One proxy (Nginx) in front of the frontend server |
| `TRUST_PROXY` | `2` | Nginx + the frontend server in front of the backend |
| `COOKIE_SECURE` | *(empty)* | Secure cookies, since the site is HTTPS |

**Check:**

```bash
curl -sI https://your-domain.com | grep -iE '^(HTTP|strict-transport|server)'   # 200, HSTS, "Server: nginx" with no version
curl -s -o /dev/null -w '%{http_code}\n' http://your-domain.com                 # 301 to https
curl -s -o /dev/null -w '%{http_code}\n' http://SERVER-IP:3000                  # must NOT connect (APP_BIND=127.0.0.1)
```

**Private VM on your LAN, no domain yet:** use the same file with `server_name _;`, delete the `www` server block and skip Certbot. In `.env` set `PUBLIC_URL=http://<vm-ip>`, `COOKIE_SECURE=false`, `APP_BIND=127.0.0.1`, `FRONTEND_TRUST_PROXY=1` and `TRUST_PROXY=2`. Browse to `http://<vm-ip>` (port 80).

**Prefer Caddy?** It's simpler (automatic HTTPS, no Certbot) but has no edge rate limits. Use `your-domain.com { reverse_proxy 127.0.0.1:3000 }` in `/etc/caddy/Caddyfile`, with the same `.env` values.

## 5a. Private VM: install a self-hosted runner (`DEPLOY_MODE=runner`)

The runner is GitHub's small agent. It connects **out** to GitHub, waits for the deploy job and runs it on the VM. No open ports, no SSH keys.

> **Your repository is public.** Anyone can open a pull request, and a pull request can change the workflow to run on your runner, which means running their code on your VM. Before installing the runner, either **make the repository private** (Settings → General → Danger Zone → Change visibility), or set **Settings → Actions → General → Fork pull request workflows → "Require approval for all outside collaborators"** and never approve runs on strangers' pull requests.

1. GitHub → repo → **Settings → Actions → Runners → New self-hosted runner → Linux**. GitHub shows download and `config.sh` commands with a one-time token.
2. On the VM, as the `deploy` user (it's in the `docker` group and owns the clone):

   ```bash
   sudo -iu deploy
   mkdir -p ~/actions-runner && cd ~/actions-runner
   # paste GitHub's "Download" commands here (curl … && tar xzf …)
   ./config.sh --url https://github.com/ooo1650/OhhMyChicken --token <TOKEN-FROM-GITHUB> \
     --name omc-vm --labels omc-deploy --unattended
   exit
   sudo /home/deploy/actions-runner/svc.sh install deploy   # run as a service, as the deploy user
   sudo /home/deploy/actions-runner/svc.sh start
   ```

   The `omc-deploy` label is what the workflow looks for.
3. GitHub → Settings → Secrets and variables → Actions → **Variables**:
   - `DEPLOY_MODE` = `runner`
   - `DEPLOY_PATH` = `/srv/ohhmychicken`
4. The runner should show as **Idle** under Settings → Actions → Runners. Push to `main` and the deploy job runs on the VM.

The runner needs outbound HTTPS to github.com, and it pulls through the same clone and deploy key as step 2. Skip 5b and 6 entirely.

## 5b. Public server: a key for GitHub Actions to log in (`DEPLOY_MODE=ssh`)

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

## 6. GitHub secrets (only for `DEPLOY_MODE=ssh`)

GitHub → repo → **Settings → Environments → New environment → `production`**. Optionally add yourself under *Required reviewers* to approve each deploy. Add these **environment secrets**:

| Secret | Value |
| --- | --- |
| `SSH_PRIVATE_KEY` | Full contents of `omc_actions`, the private key file, including the BEGIN/END lines |
| `SSH_KNOWN_HOSTS` | Full contents of `known_hosts_line` |
| `SSH_HOST` | Server IP or hostname |
| `SSH_USER` | `deploy` |
| `SSH_PORT` | Only if SSH isn't on 22 |
| `DEPLOY_PATH` | `/srv/ohhmychicken` (or set it as a *variable* instead) |

Also set the variable `DEPLOY_MODE` = `ssh`.

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
