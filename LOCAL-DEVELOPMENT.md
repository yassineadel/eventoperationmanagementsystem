# Run Hafletna locally

Use Node.js 24 and npm. Run commands from the repository root unless another folder is specified. Each developer needs their own PostgreSQL development database and Redis server.

## Configure and prepare the backend

1. In `Backend`, run `npm ci`.
2. Copy `Backend/.env.example` to `Backend/.env` if it does not exist. Keep an existing configured `.env`.
3. Set `DATABASE_URL`, `REDIS_URL`, a random `JWT_SECRET` of at least 32 characters, and the email/Google settings. Keep `FRONTEND_URL=http://localhost:5173` and `PORT=3000` for the default frontend configuration.
4. Start PostgreSQL and Redis. Then run these commands in `Backend`:

```powershell
npx prisma generate
npx prisma migrate deploy
```

To add test catalogue data to your development database, run these commands in `Backend`:

```powershell
npm run seed:venues
npm run seed:events
```

Seeding creates test events in PostgreSQL. It is separate from the frontend's sample booking data. Do not run seeds against a production database.

## Email and Google sign-in

The backend requires email and Google configuration when starting. For Gmail, use the sending account's email and an app password in `MAIL_USER` and `MAIL_PASS`. Leave `MAIL_HOST` unset to use the existing Gmail transport, or configure the optional SMTP fields in `.env.example`.

For Google sign-in, configure an OAuth client with `http://localhost:3000/api/auth/google/callback` as an authorised redirect URI and put its credentials in the Google fields of `Backend/.env`.

An optional MailDev inbox can be used during development instead of real delivery. With MailDev running locally on SMTP port 1025, configure `MAIL_HOST=127.0.0.1`, `MAIL_PORT=1025`, `MAIL_SECURE=false` and `MAIL_AUTH=false`. In that mode verification emails stay in MailDev's local inbox.

Never commit `.env`, app passwords, OAuth client secrets, database credentials, or database files. The example files contain placeholders only.

## Prepare and start the frontend

In `Frontend`, run `npm ci`. The frontend uses `http://localhost:3000` by default. If the backend uses another origin, copy `Frontend/.env.example` to `Frontend/.env`, adjust `VITE_API_URL`, and restart Vite.

Start both servers from the repository root:

```powershell
node scripts/start-hafletna.mjs
```

On Windows, `./Start-Hafletna.ps1` starts the same launcher. From the `Frontend` folder, use `../Start-Hafletna.ps1`.

The launcher reuses the existing all-in-one local runtime if this computer has one installed. That runtime is machine-local and is not included in Git. On other computers, the launcher starts the backend and frontend using the database, Redis and `.env` prepared above.

On Windows, stop Hafletna from any PowerShell terminal in the repository root:

```powershell
.\Stop-Hafletna.ps1
```

Wait for the stopped message before closing the terminal or starting another instance. The stop command requests an orderly shutdown from this computer's all-in-one launcher: application servers stop, Redis saves its state, and PostgreSQL stops through `pg_ctl`. It verifies that the launcher's local database processes have exited. It preserves database files and leaves separately managed database services running. Use `..\Stop-Hafletna.ps1` from the `Frontend` folder. `-WhatIf` previews shutdown without stopping anything. You can also press Ctrl+C in the terminal actively running the launcher; simply closing a terminal can leave a server process behind.

The launcher reuses Prisma Client when its schema and installed version match, avoiding unnecessary engine replacement on Windows. Generation runs only for a missing or outdated client. If only one application server is already running, stop that server before using the full launcher. A leftover backend process can keep `query_engine-windows.dll.node` locked even after its terminal closes.

Open `http://localhost:5173/register` to sign up or `http://localhost:5173/events` to view database events. Accounts belong to your configured database; accounts on another developer's database are not copied automatically.

## Current integration scope

Authentication and the events listing/detail pages use the backend. Homepage content, buying, checkout, and ticket-management screens still have their existing sample flows. Profile pages show the signed-in account and save name/phone, password changes, verified email changes and the combined marketing email preference through the account APIs. Account settings also record and cancel deletion requests with the backend's fourteen-day grace period; the frontend does not delete accounts itself. The sample-profile option has been removed.

Run `npm run build` in `Backend`. In `Frontend`, run `npm test`, `npm run build`, and `npm run lint` for validation.

From the repository root, run `node --test scripts/prisma-client.test.mjs` to check the launcher's Prisma regeneration rules.
