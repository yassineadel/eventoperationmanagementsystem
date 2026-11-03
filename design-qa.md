# Homepage Event Board design QA

Source visual: `local artifact: exec-d7871d24-a3c8-46bb-af0f-676f230354ef.png` (1122 × 1402 pixels).

User adjustment: remove the repeated navigation, language, theme, authentication and cart controls from the footer. Keep the top navigation and the small footer information links. The user explicitly requested direct implementation without another mockup.

Implementation: existing React application at `http://localhost:5173/`, using the configured backend. A separate temporary QA server at `http://127.0.0.1:5181/` supplied reference-matching events for the visual comparison without changing the database. The temporary servers were stopped after testing.

Reference comparison viewport: 1440 × 1000 CSS pixels, devicePixelRatio 1.5. The final reference-matching implementation capture is 1424 × 1842 pixels after scrollbar exclusion. Comparisons normalize each image to 720 pixels wide while preserving its aspect ratio, rather than multiplying screenshots by devicePixelRatio. The generated reference is a full scrolling page, not a fixed-height browser viewport. Arabic mobile was checked at 390 × 812 CSS pixels; its clean screenshot is 375 × 812 after scrollbar exclusion. The final live check reported 1600 × 1111 CSS pixels. Its screenshot container included uniform browser-generated gray margins: the raw 1758 × 2133 image was cropped to (0, 0, 1601, 2097), removing only those external margins. No app content was retouched. Temporary viewport overrides were reset.

Comparison state: signed out, English, light theme, Upcoming events selected, three events, two venues. Additional checks: English dark, Arabic light/dark on mobile, and the live backend while signed in, with three initial rows and six available upcoming events. Database event names, dates and venue order intentionally differ from the reference fixture.

## Comparison history

### Initial capture

- Implementation: `local artifact: event-board-desktop-initial.png`
- Full-view comparison: `local artifact: event-board-qa-initial.jpg`
- [P2] Event metadata, search controls and featured-event details are smaller than the selected design. Increase typography at desktop widths and enlarge event thumbnails proportionally.
- [P2] The landscape concert asset loses the pyramid in the featured portrait crop. Use a portrait-composed version of the same scene, with the person and pyramid within the crop.
- [P2] The View all events link inherits the body color. Restore the purple link treatment and slightly strengthen separators.
- Accepted differences: actual venue images are clearly marked as illustrative; dates use the existing Cairo formatting; live availability states are retained; the footer has the explicitly requested controls removed.

### Revised capture and final checks

- Revised implementation: `local artifact: event-board-desktop-final.png`.
- Full source/implementation comparison, viewed together: `local artifact: event-board-qa-final.jpg`.
- Focused rows, proportionally resized without stretching: `local artifact: event-board-qa-rows.jpg`.
- Mobile Arabic dark: `local artifact: event-board-mobile-ar-dark.png`.
- Live database implementation: `local artifact: event-board-live-verified.jpg` (raw capture retained as `event-board-live-final.jpg`).
- Fixed initial P2 findings with larger metadata/search type, proportional thumbnails, portrait concert imagery, purple action links and clearer separators. Viewed the revised full comparison and focused row comparison.
- A later [P2] footer Contact button overlapped the fixed chatbot launcher. Added desktop inline clearance and mobile footer bottom space. Rechecked rendered bounds: at 984 CSS pixels wide, Contact ends at x871 and the launcher begins at x891; no intersection. The live full-page screenshot also shows clear footer links.
- Increased mobile save buttons to 44 × 44 pixels and restored the transparent venue caption on hover. A topic-specific dance photo replaces the painting fallback for the real backend's featured dance event.
- Final content QA found an unrelated running-track photo for Esports Cup Final. Added a topic-specific gaming-stage photo, inspected the raster asset and verified the loaded image in the live page. The final live evidence includes both corrected subjects.
- The source comparison contains the original footer controls; their removal from the implementation is the explicit user-requested difference, not missing functionality.

## Required fidelity surfaces — final assessment

- Fonts/typography: existing DM Serif Display headings and Plus Jakarta Sans UI match the selected direction. Metadata, search type and row hierarchy were corrected. Arabic uses Cairo, with RTL alignment and wrapping. Long live venue names wrap without clipping.
- Spacing/layout: one unified search bar, dated horizontal rows, right featured panel, two wide venue images and compact footer. Tablet stacks the feature; mobile uses compact rows and horizontally scrollable venues. No page-level horizontal overflow in the checked desktop/mobile states.
- Colors/tokens: warm ivory/light, navy/dark, purple actions, readable separators and visible focus/selected states. Header and footer remain navy in both themes.
- Images/assets: portrait concert crop preserves the pyramid and person. Oud, dance and venue assets have relevant subjects and sharp crops. Uploaded backend images retain priority. Venue fallbacks have visible illustrative-photo labels. Existing project icon and brand components are reused. Asset provenance is recorded in `Frontend/src/Components/Homepage/data/ASSETS.md`.
- Copy/content: direct headings and performer names retained in English and Arabic. Database names fall back to English when Arabic content is unavailable. Footer duplicate navigation/account/language/theme/cart controls are removed; information links remain.

## Functional and code verification

- Search, city/category filtering, date filtering, explained empty state and Clear tested through the UI.
- Upcoming/Trending/For you tabs, preference dialog, saving/unsaving and Show more/Show fewer tested. Recommendations retain the existing local preference logic over API events.
- Venue links open the filtered listing; Venues navigation scrolls to the correct anchor beneath the header.
- Terms dialog opens/closes; Help opens the existing assistant. Existing auth, cart and account links remain in the top navigation.
- Actual backend events and venues loaded successfully. All event images loaded; no console errors on the final live page. No database records or account details were changed during QA.
- Full frontend suite: 190 passed, 0 failed. Focused discovery/API suites: 62 passed, 0 failed. After the last esports fallback change, the event API suite passed all 16 tests and the production build passed again.
- Production build, ESLint and `git diff --check` passed.

## Follow-up polish

- [P3, accepted] Existing Cairo date formatting uses 24-hour times rather than the reference's weekday/12-hour examples.
- [P3, accepted] Generated illustrations preserve the selected art direction but differ in photographic details. Replace them with organiser-supplied photography when available.
- [P3, accepted] The live catalogue includes longer venue titles and more events than the design fixture, so row wrapping and total page height vary naturally.

## Implementation checklist

- [x] Fix initial typography, imagery, link and separator findings.
- [x] Compare desktop full view and focused event rows.
- [x] Verify mobile, Arabic/RTL, both themes and footer launcher clearance.
- [x] Test discovery controls, venue navigation, bookmarks and footer actions.
- [x] Check live backend, console, build, lint and relevant tests.
- [x] Replace the real Esports event's unrelated athletics fallback with a relevant gaming-stage photo and verify it in the live page.

## Requested venue-photo revision — 29 October 2026

- Replaced the generated Opera and Manara architectural images with real, unretouched photographs. This is an explicit user-requested departure from the selected mockup's imagery.
- Opera: Daniel Csörföly's public-domain daylight exterior photo. Manara: the actual concert-stage/audience photograph used in TicketsMarche's Al Manara Arena listing. Sources and status are recorded in `Frontend/src/Components/Homepage/data/ASSETS.md`.
- Only the two local JPEG assets and their documentation changed for this revision; layout, localization, themes and event functionality are unchanged.
- Verified in the running homepage: both replacement images decode and load successfully (Opera 1656 × 1104; Arena 1600 × 1068), with suitable crops and readable captions at the current 984 CSS-pixel viewport.
- Rendered evidence: `local artifact: real-venue-photos.jpg`.
- `git diff --check` passed. No additional code tests were required for the asset-only revision.

final result: passed
