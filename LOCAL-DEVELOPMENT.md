# Run Hafletna locally

Use Node.js 24 and npm. Run commands from the repository root unless another folder is specified. Each developer needs their own PostgreSQL development database and Redis server.

## Configure and prepare the backend

1. In `Backend`, run `npm ci`.
2. Copy `Backend/.env.example` to `Backend/.env` if it does not exist. Keep an existing configured `.env`.
3. Set `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`, a random `JWT_SECRET` of at least 32 characters, and the email/Google settings (see [Database connection](#database-connection) below). Keep `FRONTEND_URL=http://localhost:5173` and `PORT=3000` for the default frontend configuration.
4. Start PostgreSQL and Redis. Then run these commands in `Backend`:

```powershell
npx prisma generate
npx prisma migrate deploy
```

To add test catalogue data to your development database, run these commands in `Backend`:

```powershell
npm run seed:venues
npm run seed:events
npm run seed:demo
```

Seeding creates test events in PostgreSQL. It is separate from the frontend's sample booking data. Do not run seeds against a production database.

`seed:venues` loads the 9 venue layouts (and their photos) into the database. Re-run it after pulling a change to `Backend/src/modules/venues/layouts/`; it is safe to run again. `seed:demo` adds sample customers (password `Demo-1234`, `@demo.hafletna.test` addresses that never receive email), orders, transfers and refunds through the real purchase flow, using the payment simulator.

After pulling, always run `npx prisma migrate deploy` in `Backend`: the migration `20261102120000_venue_admin_fields` adds the venue layout, photo and map link columns used by the admin console.

## Database connection

The backend reads two connection strings from `Backend/.env`. Both are required.

- `DATABASE_URL` is used by the running app.
- `DIRECT_URL` is used by the Prisma CLI (`npx prisma migrate deploy`, `migrate dev`, `studio`). Migrations need a connection of their own that is not shared with other clients.

**Plain or local database** (Docker, local PostgreSQL, or Neon's direct connection string): put the same URL in both.

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/DBNAME"
DIRECT_URL="postgresql://USER:PASSWORD@localhost:5432/DBNAME"
```

**Supabase**: copy both strings from the dashboard (**Connect** button) and add the options shown.

```env
# Transaction pooler, port 6543
DATABASE_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=15&sslmode=require"
# Session pooler, port 5432 (or the direct connection, if your network supports IPv6)
DIRECT_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres?sslmode=require"
```

Why: on the free plan the Session pooler (port 5432) accepts only a few clients at once. When many buyers arrive together, Prisma opens more connections than that, and some requests fail with `EMAXCONNSESSION` instead of getting a normal "sold out" answer. The Transaction pooler (port 6543) lends a real database connection to a client only for the length of one transaction, so many more clients can share the same connections; extra requests wait their turn. `pgbouncer=true` makes Prisma stop using prepared statements, which the Transaction pooler does not support. `connection_limit` sets how many connections Prisma opens; 15 matches the free plan's pool size (see **Database → Settings → Connection pooling**).

The app is safe on the Transaction pooler because everything it does that depends on the connection lasts only for one transaction: the hold functions use `pg_advisory_xact_lock`, `guardTx` sets its timeouts with `set_config(..., true)` (this transaction only), and there are no session-level `SET`, `LISTEN/NOTIFY`, session advisory locks or temporary tables. If you add one of those, it will not work through port 6543.

## Payments (Stripe test mode)

With `PAYMENT_PROVIDER=simulator` (the default) checkout uses the payment simulator. To take test card payments with Stripe, set in `Backend/.env`:

```
PAYMENT_PROVIDER=stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Use test keys only. The website shows Stripe's card form inside checkout (test card `4242 4242 4242 4242`), and approving a refund in the admin console refunds the card on Stripe automatically. A Stripe account that has submitted business details but is under review cannot refund; an unactivated test-mode account can.

## Email and Google sign-in

The backend requires email and Google configuration when starting. For Gmail, use the sending account's email and an app password in `MAIL_USER` and `MAIL_PASS`. Leave `MAIL_HOST` unset to use the existing Gmail transport, or configure the optional SMTP fields in `.env.example`.

For Google sign-in, configure an OAuth client with `http://localhost:3000/api/auth/google/callback` as an authorised redirect URI and put its credentials in the Google fields of `Backend/.env`.

An optional MailDev inbox can be used during development instead of real delivery. With MailDev running locally on SMTP port 1025, configure `MAIL_HOST=127.0.0.1`, `MAIL_PORT=1025`, `MAIL_SECURE=false` and `MAIL_AUTH=false`. In that mode verification emails stay in MailDev's local inbox.

Never commit `.env`, app passwords, OAuth client secrets, database credentials, or database files. The example files contain placeholders only.

## Chatbot (Google Gemini)

The assistant uses Google Gemini's free tier and pgvector. If you don't work on it, leave `GEMINI_API_KEY` empty: the backend still starts and the assistant reports itself unavailable.

To work on it, create a free key at https://aistudio.google.com/apikey and put it in `GEMINI_API_KEY` in `Backend/.env`. Run `npx prisma migrate deploy`, then `npm run ai:check` in `Backend`. The check confirms that Gemini answers, embeddings have the size the database expects, pgvector is enabled and a similarity search works.

The migration `20261104120000_knowledge_chunks` enables pgvector. Supabase and the `pgvector/pgvector` Docker image include it; a plain local PostgreSQL needs pgvector installed first.

Google may use free-tier requests to improve its products, so send it test data only.

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

Authentication, the homepage catalogue and venues, and the events listing/detail pages use the backend. Homepage recommendations filter database events using interests and a city saved in this browser. Venue photos are labelled as illustrative when the API has no image. Database events support live reservations, cart restoration, orders and simulator checkout; signed-in My Tickets and ticket details load backend tickets and QR tokens. Saved order confirmations, ticket email resend and ticket transfer also use the backend. Transfers update ownership, the attendee name and entry QR in one transaction. Checkout takes Stripe test card payments when Stripe is configured. Customers request refunds from a real ticket and see the administrator's decision and message there. The admin console at `/admin` (administrators only; the website shows an Admin dashboard button) reads and writes the database: dashboard, events and ticket types, orders, tickets, refunds, customers, venues (added or edited with a Google Maps link), gate staff and the activity log. The first sample-data admin design remains at `/admin-preview`. The chatbot still uses its sample implementation. Bookmarks remain browser-local. Profile pages save name/phone, password changes, verified email changes and marketing preferences through the account APIs. Account settings also record and cancel deletion requests; the backend now handles anonymisation after the fourteen-day grace period. The sample-profile option has been removed.

Run `npm run build` in `Backend`. In `Frontend`, run `npm test`, `npm run build`, and `npm run lint` for validation.

From the repository root, run `node --test scripts/prisma-client.test.mjs` to check the launcher's Prisma regeneration rules.
