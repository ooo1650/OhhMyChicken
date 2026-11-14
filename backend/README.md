# Ohh My Chicken Pizza Hub: backend

The JSON API and staff dashboard server: Node.js 22, Express 5, PostgreSQL.
The website itself (frontend) lives in its own repository and runs on Cloudflare; its
Worker sends `/api/*` and `/media/*` here, so visitors only ever see the main domain.

```
visitor → ohhmychickenpizzahub.com (Cloudflare) ──/api, /media──→ api.ohhmychickenpizzahub.com (this server)
```

## Run it on your computer

```sh
cp .env.example .env      # fill in DATABASE_URL (a local PostgreSQL)
npm ci
npm run dev               # http://localhost:4000, check /healthz
npm test                  # needs DATABASE_URL pointing at a throwaway database
```

Without email set up, sign-in codes are printed in the log.

## Hosting on cPanel ("Setup Node.js App")

**1. Database.** cPanel → *PostgreSQL Databases*: create a database and a user, add the user
to the database with all privileges. Note the name, user and password (cPanel puts your
account name in front of both, e.g. `cpuser_omc`).

**2. Subdomain.** cPanel → *Domains*: add `api.ohhmychickenpizzahub.com`. In Cloudflare DNS,
add an `A` record `api` → the server's IP, **DNS only** (grey cloud). Then cPanel →
*SSL/TLS Status*: run AutoSSL so `https://api.…` has a certificate.

**3. Code.** cPanel → *Git Version Control* → *Create*:
turn on **Clone a Repository**, Clone URL `https://github.com/<you>/<backend repo>.git`,
Repository Path `repositories/omc-api-repo`. A private repository needs a deploy key:
cPanel → *SSH Access* → generate a key, add its public half on GitHub (repo → Settings →
Deploy keys, read-only) and use the `git@github.com:<you>/<backend repo>.git` URL instead.

This folder only holds the code; the app runs from `~/omc-api` (next steps), where
`.cpanel.yml` copies it on every deploy.

**4. Settings.** Create `~/omc-api/.env` (cPanel → *File Manager*, or the Terminal) and lock it (`chmod 600 ~/omc-api/.env`):

```ini
NODE_ENV=production
DATABASE_URL=postgres://cpuser_omc:PASSWORD@localhost:5432/cpuser_omc
SUPER_ADMIN_EMAIL=paperkite.contact@gmail.com
ADMIN_PASSCODE=<first password, 10+ characters; change it after signing in>
ALLOWED_ORIGINS=https://ohhmychickenpizzahub.com,https://www.ohhmychickenpizzahub.com
TRUST_PROXY=2
UPLOAD_DIR=/home/<cpanel user>/omc-uploads
BACKUP_DIR=/home/<cpanel user>/omc-backups
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=2525
MAIL_FROM=noreply@ohhmychickenpizzahub.com
```

The SMTP login and key can go here (`SMTP_USER`, `SMTP_PASS`) or later in the dashboard,
under Team → Email. The app reads this file itself; values set on the cPanel app screen win.

**5. App.** cPanel → *Setup Node.js App* → *Create application*:

| Field | Value |
|---|---|
| Node.js version | 22 (20.12 at least) |
| Application mode | Production |
| Application root | `omc-api` |
| Application URL | `api.ohhmychickenpizzahub.com` |
| Application startup file | `src/index.js` |

Create it. Then back in *Git Version Control* → *Manage* → *Pull or Deploy*, click
**Deploy HEAD Commit**: it copies the code into `omc-api`, installs the packages and
restarts the app (`scripts/deploy-cpanel.sh`). Don't put a `node_modules` folder of your
own in `omc-api`: cPanel keeps the packages in its own place. On first start the app creates the tables and the administrator account.
Check that `https://api.ohhmychickenpizzahub.com/healthz` answers `{"ok":true}`.

**6. Point the website here.** In the frontend repository, set `BACKEND_URL` in
`wrangler.jsonc` to `https://api.ohhmychickenpizzahub.com` and deploy it.

**7. Backups.** cPanel → *Cron Jobs*, every night at 3:00:

```
0 3 * * * /bin/sh $HOME/omc-api/scripts/backup-cron.sh $HOME/omc-api/.env
```

The dashboard's checks show when it last worked. Download the files from `omc-backups` now and then.

**8. Email.** cPanel → *Email Routing*: choose **Remote Mail Exchanger**, because the domain's
email is handled by Cloudflare, not this server.

## Updating

Push to GitHub, then in cPanel → *Git Version Control* → *Manage* → *Pull or Deploy*:
**Update from Remote**, then **Deploy HEAD Commit**. Packages are reinstalled only when
`package-lock.json` changed. The deploy's output is in `~/.cpanel/logs/` if it fails.

## When something is wrong

- **The app won't start:** read `~/omc-api/stderr.log`. Usually `DATABASE_URL` is wrong or
  the database user has no rights on the database.
- **Sign-in code doesn't arrive:** before email works, codes are written to the same log
  ("Sign-in code for …"). Then, signed in as the site admin, go to Team → Troubleshoot → send test email.
- **"Cross-site request blocked":** the site's address is missing from `ALLOWED_ORIGINS`.
- **Photos:** they are kept in the database and in `UPLOAD_DIR`; if that folder is lost,
  they are copied back from the database when first asked for.

## Layout

| Path | What it is |
|---|---|
| `src/index.js` | Server: security headers, limits, `/api`, `/media`, `/healthz` |
| `src/routes.js` | Every API route and who may call it |
| `src/auth.js` | Sign-in (password, then a code by email), sessions, roles |
| `src/accounts.js`, `features.js`, `audit.js` | Site admin tools: accounts, feature switches, change log |
| `src/mail.js`, `emails.js` | Sending email (Brevo by default) and the emails themselves |
| `src/models.js`, `pricing.js`, `validate.js` | Menu, settings, orders; prices; input checks |
| `src/media.js` | Photo uploads, resized to WebP |
| `src/db.js`, `schema.sql` | Database connection, tables, one-time changes; `node src/db.js set-password <email>` |
| `.cpanel.yml`, `scripts/deploy-cpanel.sh` | Deploying on cPanel |
| `scripts/backup-cron.sh` | Nightly database backup |
| `test/` | `npm test` |
