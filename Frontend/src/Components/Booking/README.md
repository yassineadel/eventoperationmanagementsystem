# Buying frontend

Real events use the existing event, venue-layout, inventory and order APIs. The sample-event routes below remain available for frontend previews. Payment methods and outcomes use the test simulator; no real money is taken.

## Routes and entry points

- Open an available event and press **Choose tickets**.
- `/events/:eventId/tickets` chooses the venue's configured sample mode automatically.
- Standing example: `/events/cairo-after-dark/tickets`. Three illustrated zones, category prices and fee percentages, remaining sample counts, quantity controls, and a sold-out zone.
- Seated example: `/events/next-perspectives/tickets`. A 240-seat layout, three priced sections, available/held/sold/selected states, a seat inspector before selection, and selected-ticket removal.
- `/cart`: the signed-in account name fills the first ticket when available, while additional tickets need their own attendee names. All names remain editable, including when buying for someone else. Per-ticket prices and category fees, removal, and editing the selection are included.
- `/checkout?preview=1`: final review, policy modal and acknowledgement, countdown, and sample payment method selection. Choose credit/debit card, mobile wallet, or bank transfer to see a themed fictional payment account; there are no editable financial fields. Optional success/decline/timeout controls are collapsed by default. Free bookings skip methods and failure simulations. A guest can try this labelled demo; real checkout must require an authenticated session once connected.
- The header cart icon shows the current quantity. It stays visible on mobile when tickets are selected.

## Interaction and persistence

Seat-map controls support drag panning, two-pointer pinch zoom, zoom buttons, and reset. The plan uses 44px seat buttons at 100% zoom. Arrow keys, Home/End and Page Up/Down move a single roving tab stop through the seats; Enter/Space inspects a seat. Its section, row, seat number, category and price are shown before **Add this seat**. Physical seat order remains left to right in Arabic; surrounding controls and copy use RTL.

The first selected ticket starts a ten-minute sample reservation. Amending tickets, navigating, or refreshing does not extend its absolute deadline. Expiration releases the selection and offers a fresh start. Switching to another event requires explicitly replacing the existing cart. The eight-ticket limit includes prior completed sample checkouts for that event in the same browser session.

Selection IDs, the expiry time, sample purchase counts and the last sample reference are stored in `sessionStorage` under `hafletna.sample-booking.v1`. Malformed, unavailable, expired, duplicate and unknown items are discarded on reload. Blocked storage falls back to memory with a visible message. Edited attendee names are memory-only and must be entered again after a refresh. The first ticket's default name is derived from the current authenticated session in both cart and checkout; it is never copied into browser storage. Explicit edits, including clearing a name, take precedence over this default. Additional tickets stay blank until named. Signing out removes the account-derived default. Contact information, card data, passwords and verification codes are not stored or collected by this module.

For real events, browser storage retains the event identifier while the server's active holds rebuild the tickets. `BookingProvider` performs this recovery once on app load, regardless of the route, so refreshing Home also restores the cart count. Selection, cart and checkout wait for this shared recovery. Network failures offer a retry without clearing the saved event; expired or released holds are not restored. Recovery only reads the API and uses the original server deadline rather than creating or extending a reservation. Selecting tickets alone is a draft; **Continue to cart** reserves them on the server.

Fees derive from the sample category and are itemised separately. Free events have zero fees. The simulator prevents repeated submission while processing. Success consumes this session's sample inventory once, captures the order before clearing the cart, and opens `/orders/:orderRef/confirmation`. The sample tickets are then available in My Tickets. Decline and timeout release the selection. See `../Tickets/README.md` for the after-buying screens and integration boundaries.

Payment selection is required for paid bookings and disabled during submission. The selected method appears in the checkout summary and confirmation. Only a validated `card`, `wallet`, `bank-transfer`, or `free` method identifier is saved with the sample wallet order; no card numbers, wallet phones, bank details or credentials are collected or persisted. Reloads preserve the recorded method, older orders without it still load, and replaying an order cannot change its payment method. Bank transfers are simulated as completed when the successful outcome is selected; no real transfer instructions or pending bank settlement are implied.

## Production payment collection

Real venue layouts, database seat identifiers, availability, prices and holds are loaded by `liveBooking.ts`, `bookingApi.ts` and `liveHolds.ts`. The order API remains authoritative at checkout. Replace the sample payment accounts and outcome controls with provider-hosted payment collection and verified settlement statuses for production. The separate sample routes provide no real inventory guarantees.

Refresh regression checks: `node --test tests/booking.test.mjs tests/seated-booking.test.mjs tests/discovery-render.test.mjs`. For browser QA without database writes, start `tests/fixtures/events-server.mjs` with `FIXTURE_BOOKING=1` and `FIXTURE_SIGNED_IN=1`, and point a separate Vite instance at it. The optional fixture controls can simulate a failed reservation read or expired holds; they are not application endpoints.

The screens share the existing theme, English/Arabic preference, public navigation and responsive layout. Existing authentication flows are unchanged. Run `npm test`, `npm run build`, and `npm run lint` from `Frontend`.
