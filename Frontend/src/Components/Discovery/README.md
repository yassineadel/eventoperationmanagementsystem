# Discovery frontend

- `/`: existing homepage with one combined filter bar, event tabs, and larger venue cards. Personalised recommendations are available through the For you tab.
- `/events`: searchable listing with a responsive filter sidebar, multiple categories, city, inclusive date range, free/paid selection, five sort options, removable filter chips, a Saved toggle, and pagination (six events per page).
- `/events/:eventId`: full details with a photo gallery, description, venue, embedded Google Maps, door opening time, duration, capacity, policies, and FAQ.
- Invalid event IDs and unknown routes display a recovery page.

Listing state is stored in URL parameters: `q`, repeated `category`, `city`, `from`, `to`, `price`, `sort`, `page`, and `saved=1`. A single `date` parameter is also accepted. Changing a filter or sort resets pagination. Detail links retain a return URL for the listing's filters and page.

Language and theme use the existing preferences provider. The screens share the homepage navigation, footer, colors, and local fonts. On smaller screens the filter sidebar is opened with the Show filters button.

All eight events and their logistics are fictional. Available, Sold out, and Cancelled badges are illustrative sample statuses. The Creative Canvas is sold out and Nile Nights is cancelled; the remaining sample events are available. Google Maps embeds use each venue's approximate sample coordinates and follow the selected English or Arabic language. The Open in Google Maps link opens the same coordinates in a new tab. These basic embeds need an internet connection but no API key or backend setup. Galleries reuse the locally stored sample photographs. Available events now link to sample ticket selection, cart and checkout through **Choose tickets**; sold-out and cancelled events remain blocked. See [Buying frontend](../Booking/README.md). No real booking or payment is made.

Bookmark buttons on homepage cards, listing cards, and detail pages share state through SavedEventsProvider. Saved IDs are stored in local storage under `hafletna.saved-events` and synchronised across pages and browser tabs. The listing's Saved toggle combines with the other filters. Saving works without signing in; these bookmarks belong to the current browser. If storage is blocked or full, changes remain available for the current visit. Malformed data, duplicates, and missing event IDs are ignored. Saved sold-out and cancelled events remain accessible so their updated status can be read.

Recommendations filter by the selected interests and preferred city, then sort using `sample views + sample registrations × 10`. Preferences are stored under `hafletna.recommendations` in local storage. The For you tab falls back to popular events and includes the personalisation control. The separate Picked for you strip has been removed.

From `Frontend`, run `npm run dev` to preview, `npm run build` for the production build, `npm run lint` for lint, and `npm test` for the logic and route-rendering tests. Tests use Node's built-in TypeScript support (Node 24 is installed in the current environment).
