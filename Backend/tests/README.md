# Backend checks

From `Backend`:

```powershell
npm run build
npm run layouts:check
node -r ts-node/register --test tests/email-redis.test.cjs
node tests/integration-smoke.cjs
```

The integration suite runs the actual Express application, Prisma queries, PostgreSQL reservation functions, payment simulator and email worker. It creates and seeds a new `hafletna_qa_<timestamp>` database on the **local** PostgreSQL instance in `.env`; it never seeds or writes to the configured development database. The configured database account must be allowed to create databases.

It uses a dedicated Redis on `127.0.0.1:6381`, API on `127.0.0.1:3002`, and an SMTP capture on `127.0.0.1:1026`. All three ports must be unused. Emails stay in the capture process; no real inbox or payment gateway is contacted. Normal runs drop the disposable database and stop these services before exiting. Do not forcibly terminate a run during cleanup.

The default Redis executable is the one installed by `Start-Hafletna.ps1` under `Frontend/node_modules/.hafletna-local/redis/Redis-8.10.2-Windows-x64-msys2/`. This test runner currently targets that Windows development setup. PostgreSQL must already be running; starting the normal project provides it.

Results are written to `Backend/node_modules/.hafletna-qa/results.json`. A nonzero exit code means a check or setup step failed.

`node tests/integration-smoke.cjs --serve` optionally leaves the isolated API and synthetic browser account available for manual QA. Use a separate frontend with `VITE_API_URL=http://127.0.0.1:3002` on `http://127.0.0.1:5183`. The synthetic account is `qa-browser@example.test`, password `HafletnaQa2026!A`. Using the IP address keeps its browser cookies separate from the normal `localhost` project. All account records disappear when the disposable database is cleaned up.

Coverage includes account verification and updates, listing filters, venue layouts, standing and seated reservations, ownership, ticket limits, checkout idempotency, zero-cost and paid simulator orders, repeated/lost/declined/timed-out payment outcomes, tickets and QR tokens, email resend, transfers, refund requests, and logout. It does not certify Google OAuth, external SMTP delivery, Stripe, scanner hardware, administrator workflows, or load/security limits.
