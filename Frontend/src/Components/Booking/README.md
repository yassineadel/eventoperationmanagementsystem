# Buying frontend

The customer purchase journey is implemented with sample data only. No backend files were changed, no inventory or payment endpoints were invented, and no actual seats, payments, admission credentials, emails or tickets are created.

## Routes and entry points

- Open an available event and press **Choose tickets**.
- `/events/:eventId/tickets` chooses the venue's configured sample mode automatically.
- Standing example: `/events/cairo-after-dark/tickets`. Three illustrated zones, category prices and fee percentages, remaining sample counts, quantity controls, and a sold-out zone.
- Seated example: `/events/next-perspectives/tickets`. A 240-seat layout, three priced sections, available/held/sold/selected states, a seat inspector before selection, and selected-ticket removal.
- `/cart`: the signed-in account name fills the first ticket when available, while additional tickets need their own attendee names. All names remain editable, including when buying for someone else. Per-ticket prices and category fees, removal, and editing the selection are included.
- `/checkout?preview=1`: final review, policy modal and acknowledgement, countdown, and sample payment method selection. Choose credit/debit card, mobile wallet, or bank transfer to see a themed fictional payment account; there are no editable financial fields. Optional success/decline/timeout controls are collapsed by default. Free bookings skip methods and failure simulations. A guest can try this labelled demo; real checkout must require an authenticated session once connected.
- The header cart icon shows the current sample quantity. It stays visible on mobile when tickets are selected.

## Interaction and persistence

Seat-map controls support drag panning, two-pointer pinch zoom, zoom buttons, and reset. The plan uses 44px seat buttons at 100% zoom. Arrow keys, Home/End and Page Up/Down move a single roving tab stop through the seats; Enter/Space inspects a seat. Its section, row, seat number, category and price are shown before **Add this seat**. Physical seat order remains left to right in Arabic; surrounding controls and copy use RTL.

The first selected ticket starts a ten-minute sample reservation. Amending tickets, navigating, or refreshing does not extend its absolute deadline. Expiration releases the selection and offers a fresh start. Switching to another event requires explicitly replacing the existing cart. The eight-ticket limit includes prior completed sample checkouts for that event in the same browser session.

Selection IDs, the expiry time, sample purchase counts and the last sample reference are stored in `sessionStorage` under `hafletna.sample-booking.v1`. Malformed, unavailable, expired, duplicate and unknown items are discarded on reload. Blocked storage falls back to memory with a visible message. Edited attendee names are memory-only and must be entered again after a refresh. The first ticket's default name is derived from the current authenticated session in both cart and checkout; it is never copied into browser storage. Explicit edits, including clearing a name, take precedence over this default. Additional tickets stay blank until named. Signing out removes the account-derived default. Contact information, card data, passwords and verification codes are not stored or collected by this module.

Fees derive from the sample category and are itemised separately. Free events have zero fees. The simulator prevents repeated submission while processing. Success consumes this session's sample inventory once, captures the order before clearing the cart, and opens `/orders/:orderRef/confirmation`. The sample tickets are then available in My Tickets. Decline and timeout release the selection. See `../Tickets/README.md` for the after-buying screens and integration boundaries.

Payment selection is required for paid bookings and disabled during submission. The selected method appears in the checkout summary and confirmation. Only a validated `card`, `wallet`, `bank-transfer`, or `free` method identifier is saved with the sample wallet order; no card numbers, wallet phones, bank details or credentials are collected or persisted. Reloads preserve the recorded method, older orders without it still load, and replaying an order cannot change its payment method. Bank transfers are simulated as completed when the successful outcome is selected; no real transfer instructions or pending bank settlement are implied.

## Integration still required

Replace `catalogue.ts` with real venue layouts and ticket categories, mapping real database seat IDs. This checkout contains no venue-layout implementation to connect to yet. Server-side holds and expiry, authoritative availability and prices, the cross-order per-user limit, login enforcement, idempotent payment, reconciliation and ticket issuance must come from the purchase APIs. Local preview state provides none of these server guarantees. Replace the sample accounts and outcome controls with provider-hosted payment collection and verified settlement statuses when available. Do not collect financial details directly with these sample components.

The screens share the existing theme, English/Arabic preference, public navigation and responsive layout. Existing authentication flows are unchanged. Run `npm test`, `npm run build`, and `npm run lint` from `Frontend`.
