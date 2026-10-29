# After-buying frontend

Five customer screens share Hafletna's theme, English/Arabic preference, RTL layout and light/dark modes. My Tickets requires a signed-in account and loads its backend tickets; live ticket details use the server QR token. Sample order confirmation and management flows remain separate previews.

## Access

- **My Tickets** in the main navigation and account menu opens `/my-tickets`. Signed-out visitors see a sign-in prompt, never sample tickets or an option to load examples. Sign-in returns to My Tickets. Loading, session failures, API failures with retry, and an account with no tickets have distinct translated states. Upcoming and past tabs group at the event's end time. The wallet remounts per account ID, so signing out or switching accounts discards its loaded data.
- Successful sample checkout opens `/orders/:orderRef/confirmation`. The order captures exactly its selection, names and itemised totals; repeated completion cannot duplicate its tickets.
- Confirmation also shows the selected sample payment method. Its enum alone is stored; older orders without method metadata remain readable. Free orders show that no payment is required.
- Open a wallet card to view `/my-tickets/:ticketId`: logistics, seat/zone, demo QR, transfer/refund eligibility, email preview, and activity. The QR pass appears first on mobile.
- **Transfer ticket** opens `/my-tickets/:ticketId/transfer`: recipient, explicit review/acknowledgement, and confirmation. Use the verified sample accounts shown on the screen.
- **Request refund** opens `/my-tickets/:ticketId/refund`: exact quote, review, acknowledgement, and pending request status. The quote deducts the original service fee from the amount paid once. Submission does not imply approval or a payout.

The seed order `DEMO-A1B2C3D4` is a quick example. Unknown order and ticket URLs offer recovery links. Existing checkout receipts from before this module retain their old result view rather than fabricating missing tickets.

## Sample rules

Transfers require a known verified sample recipient, cannot target the owner, stop when the event starts, and have a three-transfer cap. A transfer removes the sender's usable code while retaining history. Tickets that have transferred are not refund eligible.

Refund requests close seven days before event start; the exact cutoff is accepted. Used, refunded, transferred, free and cancelled tickets are explained separately. Pending refund requests block duplicate requests and transfers but keep the demo QR until the event ends. Cancelled-event full refunds are a separate future integration path. The displayed sample policy expects administrator approval and settlement to the original method within two weeks after approval.

Email preview retains the same QR and allows three attempts per rolling hour. It sends nothing. `qrcode-generator` encodes a real, scannable QR containing `HAFLETNA-DEMO:NO-ENTRY` and a sample ID/version. It contains no attendee identity, contact information or usable admission token.

## State and privacy

`TicketsProvider` is separate from the authentication and booking providers. Synchronous ref-backed model transitions prevent duplicate actions; all actions recheck eligibility using their execution time. Only catalogue references, sample order totals reconstructed from the catalogue, and whitelisted lifecycle metadata persist in this tab's `sessionStorage` under `hafletna.sample-wallet.v1`. Custom attendee names and account/contact fields are never persisted. Reloaded checkout tickets use placeholder names; seeded fictional names remain illustrative. Malformed or blocked storage falls back to examples/in-memory state. Loading example tickets adds missing fixtures without erasing activity or new orders.

## Connecting real services later

Replace this provider with authenticated order/ticket queries and authoritative transfer, resend, refund-quote and refund-request APIs. Use server QR tokens, ownership checks, idempotency and status updates. Map approval/settlement history and cancelled-event handling from the server; never trust these local rules or sample QR codes for admission or money movement. A recipient's actual wallet and notification delivery require those services. The existing frontend sign-in flow is unchanged.

`npm test` covers model transitions and render/recovery paths in both languages and themes. Run `npm run build` and `npm run lint` from `Frontend` as well.
