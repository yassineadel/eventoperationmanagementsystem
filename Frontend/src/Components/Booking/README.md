# Buying frontend

The customer purchase journey is implemented with sample data only. No backend files were changed, no inventory or payment endpoints were invented, and no actual seats, payments, QR codes, emails or tickets are created.

## Routes and entry points

- Open an available event and press **Choose tickets**.
- `/events/:eventId/tickets` chooses the venue's configured sample mode automatically.
- Standing example: `/events/cairo-after-dark/tickets`. Three illustrated zones, category prices and fee percentages, remaining sample counts, quantity controls, and a sold-out zone.
- Seated example: `/events/next-perspectives/tickets`. A 240-seat layout, three priced sections, available/held/sold/selected states, a seat inspector before selection, and selected-ticket removal.
- `/cart`: attendee names, per-ticket prices and category fees, removal, and editing the selection.
- `/checkout?preview=1`: final review, policy modal and acknowledgement, countdown, and explicit success/decline/timeout simulation. A guest can try this labelled demo; real checkout must require an authenticated session once connected.
- The header cart icon shows the current sample quantity. It stays visible on mobile when tickets are selected.

## Interaction and persistence

Seat-map controls support drag panning, two-pointer pinch zoom, zoom buttons, and reset. The plan uses 44px seat buttons at 100% zoom. Arrow keys, Home/End and Page Up/Down move a single roving tab stop through the seats; Enter/Space inspects a seat. Its section, row, seat number, category and price are shown before **Add this seat**. Physical seat order remains left to right in Arabic; surrounding controls and copy use RTL.

The first selected ticket starts a ten-minute sample reservation. Amending tickets, navigating, or refreshing does not extend its absolute deadline. Expiration releases the selection and offers a fresh start. Switching to another event requires explicitly replacing the existing cart. The eight-ticket limit includes prior completed sample checkouts for that event in the same browser session.

Selection IDs, the expiry time, sample purchase counts and the last sample reference are stored in `sessionStorage` under `hafletna.sample-booking.v1`. Malformed, unavailable, expired, duplicate and unknown items are discarded on reload. Blocked storage falls back to memory with a visible message. Attendee names are memory-only and must be entered again after a refresh. Contact information, card data, passwords and verification codes are not stored or collected by this module.

Fees derive from the sample category and are itemised separately. Free events have zero fees. The simulator prevents repeated submission while processing. Success consumes this session's sample inventory once; decline and timeout release the selection. A sample result appears within checkout, not as a real issued-ticket confirmation.

## Integration still required

Replace `catalogue.ts` with real venue layouts and ticket categories, mapping real database seat IDs. This checkout contains no venue-layout implementation to connect to yet. Server-side holds and expiry, authoritative availability and prices, the cross-order per-user limit, login enforcement, idempotent payment, reconciliation and ticket issuance must come from the purchase APIs. Local preview state provides none of these server guarantees. Replace the outcome selector with the actual payment interface when available.

The screens share the existing theme, English/Arabic preference, public navigation and responsive layout. Existing authentication flows are unchanged. Run `npm test`, `npm run build`, and `npm run lint` from `Frontend`.
