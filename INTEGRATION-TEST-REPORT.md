# Hafletna integration test report

Tested on 30 October 2026 using the local working copy, including the current uncommitted frontend changes.

## Result

The tested customer backend flows pass. The frontend has working authentication, account editing, discovery, reservation/cart and ticket display connections. Some after-purchase screens still need integration; the whole website is therefore **not fully connected yet**.

| Check | Result |
| --- | --- |
| Real backend integration scenarios | 21 passed after the transfer follow-up |
| Frontend automated tests | 210 passed after the transfer follow-up |
| Backend email Redis unit tests | 3 passed |
| Frontend lint | Passed |
| Frontend production build | Passed |
| Backend TypeScript build | Passed |
| Venue layout validation | Both layouts passed: 240 seated places and 2,000 standing places |
| Working-copy whitespace check | Passed |

## How the tests ran

The integration runner uses the real Express application, Prisma, PostgreSQL schema/migrations, reservation SQL functions, Redis, email queue worker and payment simulator. Each run creates a separate disposable local database, seeds 50 events and two venues, and uses synthetic accounts. Emails go to a dedicated SMTP capture; the latest 21-scenario run captured 13 messages. Payments never take money. Test databases and temporary services are removed afterward.

Browser testing used the same frontend source against an isolated real backend. It verified login, saving personal details and refreshing, account settings controls, event search/detail, a standing reservation, cart restoration after refresh, the account name filling the first ticket, checkout/payment method controls, a purchased ticket in My Tickets, its entry QR, Arabic RTL, the light/dark switch, and the empty signed-out wallet. Final order creation and payment completion were exercised through HTTP in the isolated test environment; the browser checkout policy/payment submission was not used to make a real purchase.

The normal development services remain available at `http://localhost:5173` and `http://localhost:3000`. A final read-only check returned HTTP 200 for the homepage, backend health, events, venues and payment configuration. This development database currently returns **six published events and two venues**, independently of the disposable 50-event fixture. Its payment configuration is **simulator / test mode**.

Your existing account records, bookings and development database were not changed by the tests. The test browser account was signed out at the end; the preview browser may ask you to sign in again.

## Backend scenarios that passed

1. Health, payment configuration, and unauthenticated access protection.
2. Registration, verification code generation, SMTP capture delivery, email verification, login and current-user retrieval.
3. Personal details and communication preferences persist across API reads.
4. Password change, forgot-password, reset-password and subsequent login.
5. Verified email change, deletion request and cancellation of that request.
6. Event search, repeated categories, case-insensitive city, date bounds, free/paid filters, all five sort options, pagination, empty results, event details, unknown-event handling, venue list and layout retrieval. The price-low result was also checked for ascending prices.
7. Standing reservations, itemised server cart totals, hold deadline retrieval, guest protection and release.
8. Checkout, repeated idempotency key, simulator success, ticket issuance, ticket detail and QR token retrieval.
9. Declined payment releases reservations.
10. Ticket email resend reaches the local SMTP capture.
11. Transfer changes the holder, rotates the QR token and removes the sender's usable QR.
12. Refund quote, request submission and duplicate-request rejection.
13. Two accounts cannot reserve the same seat; the cart preserves the hold identity.
14. Invalid quantities and the eight-ticket account limit are rejected without creating reservations.
15. A free event produces a paid-status, zero-total order and ticket through the existing simulator journey.
16. Another user cannot view/cancel an order; the owner can cancel an unpaid order and release inventory.
17. Repeated payment success callbacks issue each ticket once.
18. Payment reconciliation recovers a success whose confirmation was lost.
19. Payment reconciliation cancels an expired pending payment and releases inventory.
20. Logout removes authenticated access.

The reconciliation scenarios advance timestamps only in the disposable database and invoke the actual reconciliation service. They do not wait for a full real-time payment window. Synthetic clients use separate loopback addresses to keep long account test sequences from exhausting the login limiter; limiter strength and abuse resistance were not evaluated.

## Frontend findings and follow-up

The requested resend, confirmation and label fixes were implemented after the initial audit. Browser checks against a new disposable real backend verified confirmation reload by ID and reference, matching saved totals, three successful resends followed by the server's 429 limit, an unchanged QR, translated feedback, Arabic light-mode mobile layout, and a sign-in prompt after logout. Nine frontend regression tests cover the new adapters, failure handling, reload behaviour, completed-checkout retries without a second payment, and bilingual labels. No external email was sent.

| Area | Current behaviour | Work remaining |
| --- | --- | --- |
| Transfer | Real ticket details now show Transfer ticket. The customer enters a recipient email, reviews it and confirms. Ownership, QR and attendee name change through the backend. | Complete; verified with two disposable accounts, including refresh safety, recipient errors, self-transfer and the transfer cap. |
| Request refund | Backend quote/request passes, but the real-ticket action is hidden and the direct route searches only sample tickets. | Use the real refund quote and request endpoints. Include the server's eligibility, deductions and request status. |
| Resend ticket email | Real ticket details now call `POST /api/tickets/:id/resend`, with translated pending, success and failure messages. | Complete; tested against the local SMTP capture and server resend limit. |
| Order confirmation | Real checkout now navigates to a saved order URL. Confirmation reloads authenticated database data by ID or reference; ticket details link back to it. | Complete; refresh by ID and reference verified. A separate order history listing was not added. |
| Real-ticket status wording | Real active tickets display “Active ticket” / “تذكرة نشطة” in the wallet, details and confirmation. Demo wording stays separate. | Complete. |

Relevant implementation points: `Frontend/src/Components/Tickets/TicketDetail.tsx`, `TransferTicket.tsx`, `RefundRequest.tsx`, `Confirmation.tsx`, `TicketParts.tsx`, and `Frontend/src/Components/Booking/Checkout.tsx`.

The administrator event, order, venue and user adapters still use sample data. The chatbot and browser-based saved events/recommendations also have no backend connection to certify. These are separate from the customer flows tested above.

Transfer follow-up: ten additional frontend tests cover the live adapter, recipient validation, eligibility, error distinctions, translated layouts, signed-out access and transferred-record reloads. An additional real backend scenario covers self-transfer, a missing recipient, a pending refund and a fourth transfer attempt. The backend now updates the attendee name to the recipient's registered name in the same transaction as ownership and QR rotation. Refund frontend integration was left unchanged at the user's request.

## Limits of this result

Google's external sign-in/consent flow was not repeated. Local email generation, queuing and SMTP delivery were tested. Separately, while diagnosing the user's missing mail, Gmail SMTP authentication was verified and one existing ticket was resent to the user's own account; Gmail accepted it and the user confirmed the messages were in Spam. Transfer tests use only synthetic accounts and the isolated local inbox. Stripe and actual card, wallet or bank payments were not tested; the selectable payment methods remain illustrative. No real money was taken.

This run does not certify administrator operations, gate scanning, scanner hardware, production deployment, exhaustive accessibility/mobile behaviour, high-concurrency load, or a full security audit. Arabic UI/RTL and theme switching were checked with a real ticket; the seeded database event/venue names fall back to English when Arabic content is absent.

## Repeating the checks

See `Backend/tests/README.md` and `Backend/tests/integration-smoke.cjs`. The latter is a new regression runner added during the audit. The requested frontend follow-up is included in `npm test`, `npm run lint` and `npm run build` under `Frontend`. The report records validation performed before publishing these updates.

## Browser evidence

Browser screenshots were inspected locally during the audit and follow-up tests. They are local QA artifacts and are not included in the repository.
