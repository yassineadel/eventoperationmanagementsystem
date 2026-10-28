# Homepage data

The homepage uses the public backend catalogue without importing the fictional event or venue lists.

- The hero highlights an event from `GET /api/events?sort=popular` and links to its database ID.
- Upcoming uses `sort=soonest`; Trending uses `sort=popular`. Popularity is the backend's sold plus currently held ticket count, not fabricated views.
- The existing query, category, city and exact-date controls become API filters. A date sets both `from` and `to` so the chosen day is inclusive, matching the listing API.
- For you applies selected interests and city to the API query and sorts matching database events by popularity. These choices remain browser-local; no account preference or AI recommendation endpoint is implied. Conflicting search and preference filters show an empty state without fetching unrelated events.
- Event results initially show three cards. Show more first reveals the rest of the six-event API page, then loads subsequent pages on demand. Show fewer collapses the loaded cards. Filters and view changes reset pagination. Requests time out, abort on unmount/filter changes and ignore stale responses; failed additional pages keep the existing cards and offer retry.
- Venues come from `GET /api/venues`, independently of event loading. Clicking a venue opens `/events` with its database name and city as filters. The current API has no venue photos or Arabic names; illustrative photos are labelled, and untranslated names retain their original content. Future optional `image` and `nameAr` fields are supported. Unsafe images fall back to labelled local artwork.
- Loading, empty and error states are translated and never silently replace missing API data with sample events or venues. Generic event category images are used when the catalogue supplies no event photo.

English/Arabic, RTL, light/dark themes, scroll reveals, the interactive hero and responsive layouts use the existing components and theme variables. `npm test` covers query mapping, venue validation and bilingual render states; browser QA covers the live API, pagination and filter interactions.
