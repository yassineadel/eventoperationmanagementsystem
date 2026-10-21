# Discovery frontend

- `/`: existing homepage, event tabs, recommendations and venue cards.
- `/events`: responsive filters, search, sorting, saved events and pagination (six events per page).
- `/events/:eventId`: photo gallery, description, venue/map, timing, capacity, policies, FAQ and ticket categories.

Listing state is kept in URL parameters: `q`, repeated `category`, `city`, `from`, `to`, `price`, `sort`, `page`, and `saved=1`. A single `date` is accepted as a one-day range. Changing filters or sort resets pagination; detail links retain the return URL. Shared preferences control English/Arabic, RTL, and light/dark themes. Mobile filters open with Show filters.

Homepage recommendations still use selected interests/city and the sample popularity score (`views + registrations * 10`). Preview preferences stay in `hafletna.recommendations`; browser bookmarks stay in `hafletna.saved-events` and synchronise between tabs. Blocked storage preserves changes for the current visit.

## Events API integration

The listing requests `GET /api/events` and database detail URLs request `GET /api/events/:id` through `src/lib/api.ts`. Set `VITE_API_URL` to the backend origin (default `http://localhost:3000`); the backend's `FRONTEND_URL` must match the frontend origin for CORS. Restart Vite after changing its environment.

Implemented against Gelo's public API contract, now included in this checkout through the shared `dev` updates. Follow [Local development](../../../../LOCAL-DEVELOPMENT.md) to configure the backend, migrate your development database and start both servers. Run `npm run seed:venues` and `npm run seed:events` in `Backend` if test events are needed. The frontend itself does not modify or seed the database.

## Data and states

- Query names, repeated categories, inclusive date bounds, sorting and pagination follow the API contract. The server supplies the returned page and total; a successful empty result stays empty. Invalid date ranges are explained locally without a request.
- Loading has its own state. Errors/timeouts show a labelled sample listing with a retry button. A detail 404 shows recovery; a failed detail request never manufactures an event or substitutes sample facts.
- `eventsModel.ts` validates responses and maps summaries, Prisma Decimal strings, ticket categories, policies and FAQs. `null` price remains unknown, while numeric zero is free. Images use existing local category fallbacks; API detail maps use actual coordinates. Missing descriptions, policies, FAQs or coordinates show translated explanations.
- Interface text supports Arabic and English. Current backend event content has one language, so `name`/description/venue content is shown in either interface. Optional `nameAr`, `descriptionAr`, `aboutAr`, `performerAr` and venue `nameAr`/`addressAr` are used if provided later; confirm schema names with the backend owner.
- Category counts ignore category selection, page and sort while respecting search, city, dates and price. A future `categoryCounts: { concerts: 3, arts: 2, ... }` listing field is consumed directly. Until it ships, six public filtered listing totals supply the counts. If unavailable, counts show a dash with retry rather than sample counts beside API events.
- Saved events persist as public UUIDs or existing sample IDs only (maximum 200). Saved API events are reloaded through their detail endpoints, four at a time. Hidden/deleted events are explained and never replaced; an outage retains the IDs for retry. Search/filter/sort/page are applied to the complete resolved saved list locally.
- Existing homepage sample links and sample booking screens remain available. Database events display their real categories and remaining capacity, with booking disabled until the separate inventory/checkout integration is done. No API event is routed into fictional seat IDs or sample checkout.

Requests cancel on navigation/filter changes and time out after 12 seconds. Stale completions are ignored. `EventsClientContext` allows an injected transport for integration tests; an explicit null client selects the local preview catalogue for offline render tests.

From `Frontend`, run `npm run dev` to preview, `npm run build` for production, `npm run lint` for lint and `npm test` for logic/API/route-rendering tests (Node 24). Tests use public response fixtures, never a database. For optional browser QA only, run `node tests/fixtures/events-server.mjs` and launch Vite with `VITE_API_URL=http://127.0.0.1:3001`; this fixture server is not the application backend. Existing sample buying screens are documented in [Buying frontend](../Booking/README.md).
