# Deploy to a test VM (load and security testing)

For now the site runs on an **Ubuntu VM on this computer** (libvirt/KVM). You test it from the host before moving to a real server. Moving to production later is a short checklist at the end.

```
Your PC (host)                                 VM "my-vm"  (SERVER-IP)          
  browser, load test, security test ──http──►  Nginx :80 ──► app :3000 (Docker: frontend, backend, Postgres)

GitHub ── push to main ──► Actions: tests + Docker build ──► runner on the VM: git pull, rebuild, health check
```

Everywhere below, `SERVER-IP` stands for the VM's address. Find it on the host with `virsh -c qemu:///system domifaddr <vm-name>`, or inside the VM with `ip -4 addr`.

---

## 1. Prepare the VM

Give the VM at least **2 CPUs, 4 GB RAM and 20 GB of disk**, or load tests will only measure the VM. Then, inside the VM:

```bash
# Docker (official repository), git, curl
sudo apt update && sudo apt install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt update && sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Let your user run docker without sudo (the GitHub runner needs this too)
sudo usermod -aG docker $USER
```

**Log out and back in**, then check: `docker run --rm hello-world`

## 2. Get the code

```bash
sudo mkdir -p /srv/ohhmychicken && sudo chown $USER: /srv/ohhmychicken
git clone https://github.com/<your-github-user>/<your-repo>.git /srv/ohhmychicken
cd /srv/ohhmychicken && git checkout main
```

If you make the repository private (recommended in step 6), `git pull` on the VM needs a read-only deploy key. See "Private repository" in the production checklist.

## 3. Settings: `.env`

```bash
cd /srv/ohhmychicken
cp .env.example .env && chmod 600 .env
openssl rand -hex 24          # copy this for POSTGRES_PASSWORD
nano .env
```

Set these lines (leave the rest as they are):

```ini
POSTGRES_PASSWORD=<the openssl value>
ADMIN_PASSCODE=<10+ characters, not easy to guess, only you know it>   # first password of the administrator account
# The administrator account is paperkite.contact@gmail.com (set SUPER_ADMIN_EMAIL to use another).
# After signing in, add the Brevo SMTP login and SMTP key in Team → Email (Brevo → SMTP & API → SMTP).
PUBLIC_URL=http://SERVER-IP
APP_PORT=3000
APP_BIND=127.0.0.1          # only Nginx (step 5) can reach the app
COOKIE_SECURE=false         # plain http on the LAN; otherwise the admin login cookie is dropped
FRONTEND_TRUST_PROXY=1      # Nginx is in front of the frontend
TRUST_PROXY=2               # Nginx + frontend are in front of the backend
ADMIN_PATH=admin            # dashboard at /admin/ (pick something else to hide it)
```

`.env` holds all the secrets. It never goes to GitHub (it's git-ignored) or into Docker images.

## 4. Start the app

```bash
cd /srv/ohhmychicken
docker compose up -d --build          # first build takes a few minutes
docker compose ps                     # db, backend, frontend → "healthy"
curl -fsS http://127.0.0.1:3000/healthz && curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/api/menu   # ok, 200
```

If the backend keeps restarting, run `docker compose logs backend`. The most common cause is a too-short `ADMIN_PASSCODE`. If sign-in codes don't arrive, use **Team → Send me a test email** in the dashboard: it shows the exact error. Until email works, codes are in `docker compose logs backend`.

## 5. Nginx in front

Nginx adds rate limits, upload size limits and slow-client protection before requests reach the app. The config is [deploy/nginx/ohhmychicken.conf](nginx/ohhmychicken.conf).

```bash
sudo apt install -y nginx
sudo cp /srv/ohhmychicken/deploy/nginx/ohhmychicken.conf /etc/nginx/sites-available/ohhmychicken
sudo sed -i 's/example\.com/SERVER-IP/g' /etc/nginx/sites-available/ohhmychicken   # your VM's IP
sudo ln -sf /etc/nginx/sites-available/ohhmychicken /etc/nginx/sites-enabled/ohhmychicken
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

**From the host**, open:

- Site: **http://SERVER-IP**
- Dashboard: **http://SERVER-IP/admin/** (sign in with `paperkite.contact@gmail.com` and `ADMIN_PASSCODE`; until email is set up, the code is in `docker compose logs backend`)

And check that only Nginx is exposed:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://SERVER-IP/          # 200
curl -s -m 3 http://SERVER-IP:3000/ || echo "port 3000 closed: good"
```

## 6. Auto-deploy from GitHub (runner on the VM)

Pushes to `main` run the tests and the Docker build on GitHub. The **deploy** step then runs on a GitHub runner installed on the VM, which pulls the tested commit, rebuilds, checks health and rolls back if unhealthy. The VM only makes outgoing connections, and no GitHub secrets are needed.

**First, protect the VM.** The repository is public, and a pull request from anyone could try to run code on your runner. Do one of these:
- **Make the repo private**: GitHub → Settings → General → Danger Zone → Change visibility. Or:
- Settings → Actions → General → **"Require approval for all outside collaborators"**, and never approve runs on strangers' pull requests.

**Runner:** you've already registered one. Fix two things:

1. **Label.** GitHub → Settings → Actions → Runners → your runner → Labels ⚙ → add **`omc-deploy`**. The workflow only deploys to a runner with this label.
2. **Run it as a service** so it survives closing the terminal and rebooting. In the VM:
   ```bash
   cd ~/actions-runner
   sudo ./svc.sh install $USER && sudo ./svc.sh start
   sudo ./svc.sh status          # active (running)
   ```

**Variables:** GitHub → Settings → Secrets and variables → Actions → **Variables** tab:

| Name | Value |
| --- | --- |
| `DEPLOY_MODE` | `runner` |
| `DEPLOY_PATH` | `/srv/ohhmychicken` |

**Deploy:** push to `main`. Your local branch is `master`, so run `git push origin master:main`. Watch it in the repo's **Actions** tab; the runner on the VM prints `Running job: Deploy to server`.

Never edit files in `/srv/ohhmychicken` by hand: the deploy refuses to run over local changes. Change code in git, and settings in `.env` (then `docker compose up -d`).

## 7. Load testing

Run these from the **host**. The test is [deploy/test/load-test.js](test/load-test.js) (k6, run through Docker, nothing to install). It simulates visitors opening the home page, the menu and a category, with reading pauses, and downloads the scripts and styles once per visitor like a browser.

```bash
cd ~/Documents/chicken

# 1. Smoke run: 3 visitors for 20 s (checks the setup)
docker run --rm -i --network host -e TARGET=http://SERVER-IP -e QUICK=1 grafana/k6 run - < deploy/test/load-test.js

# 2. Real run: ramps up to 50 visitors and holds for 2 minutes
docker run --rm -i --network host -e TARGET=http://SERVER-IP -e PEAK=50 -e HOLD=2m grafana/k6 run - < deploy/test/load-test.js
```

While it runs, watch the VM: `docker stats` (CPU and memory per container) and `htop`.

**Reading the results:**

| Line | Good | Means |
| --- | --- | --- |
| `failed` | under 1 % | real errors (5xx, timeouts) |
| `http_req_duration{type:page}` p(95) | under 800 ms | 95 % of pages load faster than this |
| `limited` | any number | `429` answers from the rate limits; see below |

**All traffic comes from one IP (your host)**, so Nginx's per-visitor limits kick in and some requests get `429` (counted as `limited`). That shows the flood protection works. To find the VM's **raw capacity** instead, switch the limits off temporarily:

```bash
# on the VM: comment out Nginx's rate limits
sudo sed -i -E 's/^(\s*)(limit_req |limit_conn )/\1# \2/' /etc/nginx/sites-available/ohhmychicken
sudo nginx -t && sudo systemctl reload nginx
```

Then raise `PEAK` step by step (50, 100, 200…) until `failed` or p(95) goes over the line. That's the capacity. **Turn the limits back on afterwards:**

```bash
sudo sed -i -E 's/^(\s*)# (limit_req |limit_conn )/\1\2/' /etc/nginx/sites-available/ohhmychicken
sudo nginx -t && sudo systemctl reload nginx
```

## 8. Security testing

Run these from the **host** against the VM.

**a) The project's security check:** [deploy/test/security-check.mjs](test/security-check.mjs) (Node 20+). It covers headers, open redirects, hidden files, size limits, bad input, access control, cross-site requests, photo uploads (fake, oversized, SVG, image bombs), order floods and password guessing.

```bash
cd ~/Documents/chicken
node deploy/test/security-check.mjs http://SERVER-IP                                   # safe checks
ADMIN_EMAIL='you@…' ADMIN_PASSCODE='your password' node deploy/test/security-check.mjs http://SERVER-IP    # + uploads & admin input (asks for the code)
ORDERS=1 node deploy/test/security-check.mjs http://SERVER-IP       # + order flood (adds ~25 test orders)
BRUTE=1 node deploy/test/security-check.mjs http://SERVER-IP                           # + password guessing: LOCKS your IP 15 min, run last
```

Every line should say `PASS` or `SKIP`. The two skips are HTTPS-only checks that pass in production. Afterwards:
- Delete the test orders in Dashboard → Orders → *Clear order log*.
- To lift a `BRUTE=1` lockout early: `docker compose restart backend` on the VM.

**b) OWASP ZAP baseline scan.** This is a standard, passive scan: it looks without attacking.

```bash
docker run --rm -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t http://SERVER-IP
```

Expect a few low "WARN" notes, for example that the CSP allows inline *styles*. Styles set from code need that, and it's not script execution. Anything marked **FAIL** is worth looking at.

**c) Open ports.** Only 22 (SSH) and 80 should answer:

```bash
for p in 22 80 3000 4000 5432 8080; do (timeout 2 bash -c "</dev/tcp/SERVER-IP/$p") 2>/dev/null && echo "$p open" || echo "$p closed"; done
```

## 9. Everyday commands (on the VM)

```bash
cd /srv/ohhmychicken
docker compose ps                                   # status
docker compose logs -f --tail=100 backend           # logs (also: frontend, db)
git pull && docker compose up -d --build            # manual update (the runner normally does this)
docker compose restart backend                      # clears login lockouts and rate-limit counters
docker compose down -v && docker compose up -d      # WIPE the test database and photos, start fresh
docker compose exec backend node src/db.js reset-menu   # replace only the menu with the one in the code (keeps orders, settings, photos)
docker compose exec backend node src/db.js set-password you@example.com   # administrator locked out: set a new password
docker compose logs backend | grep 'Sign-in code'                       # sign-in codes, while email isn't working
docker compose exec -T backend node src/db.js customers > customers.csv   # opt-in customer list (keep the file private)
docker compose exec backend node src/db.js forget-customer 98XXXXXXXX     # remove someone on request
docker compose logs backup && ls -lh backups/          # automatic backups (start-up + nightly 3 AM)
```

Rollback: `git log --oneline -5`, then `git reset --hard <commit> && docker compose up -d --build`. The next push to `main` moves it forward again.

---

## Speed for visitors in Nepal

The server's location decides how long each round trip takes from Kathmandu: roughly 60–100 ms to Singapore or Mumbai, 250–300 ms to Europe or North America. A first visit needs several round trips, so a far server adds about 1–1.5 s.

1. **Best:** rent the VPS in Asia (Singapore or Mumbai) if your provider offers it.
2. **Far server (or as an extra):** put **Cloudflare** (free plan) in front. It has a point of presence in Kathmandu, so visitors connect there and almost everything is served from it:
   - Add the domain to Cloudflare, switch the DNS records `@` and `www` to *Proxied* (orange cloud).
   - SSL/TLS → mode **Full (strict)** (keep certbot's certificate on the server).
   - Caching → Cache Rules → new rule: *Hostname equals your-domain.com* **and** *URI Path does not start with `/api/`* **and** *URI Path does not start with `/your-ADMIN_PATH`* → **Eligible for cache**, Edge TTL **Use cache-control header**. The app already marks what may be kept: scripts, styles and logos for a year, icons for a day, pages for 60 seconds (menu changes show up within about two minutes); the API, orders and the dashboard are never cached.
   - On the server: `sudo sh deploy/nginx/cloudflare-realip.sh`, so rate limits still see each visitor's own IP.
   Orders, the promo check and the dashboard still travel to the server, which is fine: they are small and happen once per visit.
3. Turn on HTTP/2 and TLS session reuse in Nginx (see the comment at the top of `deploy/nginx/ohhmychicken.conf`).

---

## Later: moving to production

Same steps on a real Ubuntu server, with these changes:

1. **Domain and HTTPS.** Point the domain's DNS A records (`@` and `www`) at the server. In step 5 use your domain instead of the IP:
   ```bash
   sudo sed -i 's/example\.com/your-domain.com/g' /etc/nginx/sites-available/ohhmychicken
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com -d www.your-domain.com --redirect
   ```
2. **`.env`:** `PUBLIC_URL=https://your-domain.com`, `COOKIE_SECURE=` (empty, so cookies are Secure). Use **new** secrets (fresh `POSTGRES_PASSWORD` and `ADMIN_PASSCODE`); never reuse the test VM's.
3. **Firewall:** `sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable`
   **Harden the VPS** (open a second SSH session first and keep it open until you've checked you can still log in):
   ```bash
   # SSH: keys only, no root login
   printf 'PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin no\n' | sudo tee /etc/ssh/sshd_config.d/90-omc.conf
   sudo sshd -t && sudo systemctl reload ssh
   sudo apt install -y fail2ban unattended-upgrades         # bans SSH password guessers; installs security updates daily
   sudo dpkg-reconfigure -plow unattended-upgrades
   chmod 600 /srv/ohhmychicken/.env                          # secrets readable by you only
   sudo ss -tlnp    # only :22, :80, :443 on 0.0.0.0; the app's :3000 must show 127.0.0.1
   ```
   If your VPS provider has its own firewall panel, allow only 22, 80 and 443 there too.
4. **Private repository:** the server needs a read-only deploy key to `git pull`:
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/omc_repo -N ""     # add ~/.ssh/omc_repo.pub in GitHub → Settings → Deploy keys (read-only)
   printf 'Host github.com\n  IdentityFile ~/.ssh/omc_repo\n  IdentitiesOnly yes\n' >> ~/.ssh/config
   git -C /srv/ohhmychicken remote set-url origin git@github.com:<your-github-user>/<your-repo>.git
   ```
5. **Deploy mode:** either install the runner on the server as in step 6 (`DEPLOY_MODE=runner`), or have GitHub log in over SSH (`DEPLOY_MODE=ssh`) with these **environment secrets** (Settings → Environments → `production`):

   | Secret | Value |
   | --- | --- |
   | `SSH_HOST` | server IP or hostname |
   | `SSH_USER` | the deploy user |
   | `SSH_PRIVATE_KEY` | private key from `ssh-keygen -t ed25519 -f omc_actions -N ""` (put `omc_actions.pub` in the server's `~/.ssh/authorized_keys`) |
   | `SSH_KNOWN_HOSTS` | output of `ssh-keyscan your-server`; check its fingerprint matches `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` on the server |
   | `DEPLOY_PATH` | `/srv/ohhmychicken` |
   | `SSH_PORT` | only if not 22 |

6. **Approvals:** in Settings → Environments → `production`, add yourself as a required reviewer to approve each deploy.
7. **Backups** are taken automatically into `/srv/ohhmychicken/backups` (nightly, 14 days). A server that dies takes them with it, so also copy them somewhere else every day, e.g. from your own computer or a second server (they hold customers' names and phones: keep the copy private):
   ```bash
   rsync -a deploy@your-server:/srv/ohhmychicken/backups/ ~/omc-backups/
   ```
   Test a restore once (README → Backups) before you rely on it.
8. **Dashboard address:** set `ADMIN_PATH` to something hard to guess (e.g. `staff-7f3k`); the server logs a warning while it is `/admin`.
9. **Uptime alerts:** a free monitor (e.g. UptimeRobot) checking `https://your-domain/healthz` every 5 minutes, alerting the owner's phone.
10. **Optional:** Cloudflare (free plan) in front for large-scale DDoS protection.
11. **Re-run** the load and security tests (steps 7–8) against the production URL. The two HTTPS checks then pass instead of being skipped.

## Hosting without Docker (shared Node.js hosting with PostgreSQL)

For plans with a Node.js app screen (cPanel "Setup Node.js App" or similar) and PostgreSQL, but no Docker. The frontend goes on Cloudflare (see the main README); only the backend runs here.

1. **Database:** create a PostgreSQL database and user in the control panel. Note the name, user and password.
2. **Code:** over SSH, `git clone` the repository (say into `~/omc`), then `cd ~/omc/backend && npm ci --omit=dev`. Node 20.12 or newer; 22 is best.
3. **Settings:** create `~/omc/backend/.env` (`chmod 600` it; it holds secrets):
   ```ini
   NODE_ENV=production
   DATABASE_URL=postgres://USER:PASSWORD@localhost:5432/DBNAME
   ADMIN_PASSCODE=<first password for paperkite.contact@gmail.com, 10+ characters>
   TRUST_PROXY=2                       # the host's web server + Cloudflare
   ALLOWED_ORIGINS=https://<the site on Cloudflare>
   UPLOAD_DIR=/home/<you>/omc-uploads
   BACKUP_DIR=/home/<you>/omc-backups
   ```
   The backend reads this file itself; anything set in the control panel wins.
4. **App:** in the Node.js app screen, application root `omc/backend`, startup file `src/index.js`, mode production, then start it. It creates the tables and the administrator account on first start. Check `https://<backend address>/healthz` answers `{"ok":true}`.
5. **Frontend:** set `BACKEND_URL` in `frontend/wrangler.jsonc` to the backend's address and redeploy on Cloudflare.
6. **Backups:** add a cron job in the control panel (every night at 3:00):
   `0 3 * * * /bin/sh $HOME/omc/deploy/backup-cron.sh $HOME/omc/backend/.env`
   The dashboard's checks show when it last succeeded. Copy the files off the server now and then.
7. **Updates:** `cd ~/omc && git pull && cd backend && npm ci --omit=dev`, then restart the app in the control panel.
8. **Codes before email works:** they are in the app's log (the control panel shows it, or `stderr.log` in the app folder). Then add the Brevo login and key in Team → Email.
