# Homepage images

Images are stored locally in `public/event-images/` so the page does not depend on external image requests at runtime.

The current homepage uses the featured catalogue event's photo, with a local illustrative fallback when an event has no uploaded images. `hero-ticket.png` is a legacy concert photograph created with the built-in ImageGen tool from the approved homepage mockup using this prompt:

> Use case: photorealistic-natural. Asset type: concert hero photograph for the Hafletna website. The attached mockup is a style/composition reference only. Generate ONLY the photographic concert scene seen in its large desktop hero ticket, with no user interface, no typography, no tickets, no borders, no design-board panels. Wide landscape 2:1 cinematic live music photograph: a long-haired female concertgoer viewed from behind in the center foreground with one arm raised, a lively crowd, violet spotlights and purple haze, distant softly lit Egyptian pyramid at right, warm amber highlights. Rich navy and purple editorial color grading. Realistic photographic texture. Keep the top-left portion relatively dark for future HTML text overlay. No text, no logos, no watermarks, no lettering.

`hero-concert.png` was created using the built-in ImageGen tool with this prompt:

> Use case: photorealistic-natural. Asset type: website hero photograph for Hafletna event discovery. Create a cinematic wide landscape editorial photograph of a live concert crowd seen from the rear, silhouetted hands in the lower foreground, distant stage at center, violet and lavender spotlights cutting through smoky navy atmosphere, subtle warm amber highlights. Premium authentic live music photography, rich dark navy and purple tones, dynamic yet elegant, realistic photographic texture. Wide 3:2 landscape composition. No text, no lettering, no logo, no watermarks, no graphic overlays, no collage.

Sample event photos were downloaded from these Unsplash image URLs with `auto=format&fit=crop&w=900&h=560&q=85`:

- Concert: https://images.unsplash.com/photo-1516450360452-9312f5e86fc7
- Festival: https://images.unsplash.com/photo-1501386761578-eac5c94b800a
- Art: https://images.unsplash.com/photo-1513364776144-60967b0f800f
- Sports: https://images.unsplash.com/photo-1461896836934-ffe607ba8211
- Workshop: https://images.unsplash.com/photo-1519389950473-47ba0277781c
- Conference: https://images.unsplash.com/photo-1540575467063-178a50c2df87

Additional illustrative venue photos use `auto=format&fit=crop&w=700&h=400&q=85`:

- `venue-garden.jpg`: https://images.unsplash.com/photo-1517248135467-4c7edcad34c4
- `venue-seafront.jpg`: https://images.unsplash.com/photo-1514933651103-005eec06c04b
- `venue-riverside.jpg`: https://images.unsplash.com/photo-1518837695005-2083093ee35b

Homepage fonts are served locally from `public/fonts/`. Anton, DM Serif Display, and Cairo were obtained from the Google Fonts CSS endpoint: https://fonts.googleapis.com/css2?family=Anton&family=DM+Serif+Display&family=Cairo:wght@400;600;700;800&display=swap. Their aliases in `homepage-fonts.css` keep the font choices scoped to the homepage.

Temporary event photos use `auto=format&fit=crop&w=1200&q=80`:

- `jazz.jpg`: https://images.unsplash.com/photo-1511192336575-5a79af67a629
- `piano.jpg`: https://images.unsplash.com/photo-1520523839897-bd0b52f945a0
- `guitar.jpg`: https://images.unsplash.com/photo-1510915361894-db8b60106cb1
- `electronic.jpg`: https://images.unsplash.com/photo-1470225620780-dba8ba36b745
- `orchestra.jpg`: https://images.unsplash.com/photo-1507838153414-b4b713384a76
- `microphone.jpg`: https://images.unsplash.com/photo-1516280440614-37939bbacd81
- `cinema.jpg`: https://images.unsplash.com/photo-1485846234645-a62644f84728
- `photography.jpg`: https://images.unsplash.com/photo-1516035069371-29a1b244cc32
- `poetry.jpg`: https://images.unsplash.com/photo-1455390582262-044cdead277a

`src/lib/eventImages.ts` selects a relevant temporary photo by title or a stable category fallback. Uploaded event photos take priority. These illustrative photos do not depict the named events or performers. Catalogue event data comes from the backend; the separate frontend sample events and their performer names are fictional.

The official SIL Open Font License files for these families are included beside the font files as Anton-OFL.txt, DM-Serif-Display-OFL.txt, and Cairo-OFL.txt.

## Event Board redesign

The selected homepage concept is implemented in the existing app. The following illustrative event assets were generated with the built-in ImageGen tool from crops of that concept; they are not documentary photographs of the named events or performers:

- `oud.jpg` (900×900): anonymous hands playing an authentic fretless Arabic oud; warm amber stage light, dark navy background, no text or watermark. Replaces the guitar fallback for oud events.
- `festival-pyramid.jpg` (960×1040): portrait composition of the existing concert scene, anonymous concertgoer with raised arm, violet stage, golden pyramid visible at upper right. No UI or lettering. Used for the Summer Beats illustrative event photo so the featured panel retains the selected composition.
- `dance-stage.jpg` (960×1040): anonymous contemporary dancers on a theater stage, flowing costumes, warm amber side light and restrained violet lighting. Used for dance/ballet event fallbacks so the live database's featured dance event has relevant imagery. It does not depict its named troupe.
- `esports.jpg` (1200×900): anonymous esports players at gaming PCs on a professional navy/violet-lit stage; no text or logos. Replaces the unrelated athletics fallback for esports events. Generated with built-in ImageGen; original retained at `C:/Users/admin/.codex/generated_images/01a18940-2dc6-7ce1-865b-c7e05975a2ef/exec-453c0bf6-e303-4a8e-882c-670c90b1025f.png`.

The existing `jazz.jpg` supplies the remaining selected-design event photo. Original generated PNGs were retained in the tool's generated-images directory; the application uses the project-local JPEGs.

## Real venue photography — 29 October 2026

The two generated architectural venue images were replaced at the user's request. The current files contain real photographs, preserved without retouching; responsive cards apply their existing CSS crop. Uploaded venue images still take priority. The illustrative-photo label remains because these frontend reference photos are not uploads supplied with the backend venue records, and the Opera photo shows the complex rather than the Small Hall interior.

- `venue-opera.jpg` (1656×1104): Cairo Opera House exterior in daylight, photographed by Daniel Csörföly during January–February 2007. Released into the public domain by the photographer. [Source and release](https://commons.wikimedia.org/wiki/File:Cairo_Opera_byDanielCsorfoly.JPG). [Original JPEG](https://upload.wikimedia.org/wikipedia/commons/4/48/Cairo_Opera_byDanielCsorfoly.JPG).
- `venue-arena.jpg` (1600×1068): Al Manara Arena stage and audience during a concert, from the [TicketsMarche venue listing](https://www.ticketsmarche.com/venue/6da16733-3ffe-431f-a3e8-af0b03b5f8c5). [Original JPEG](https://d3vzzcunewy153.cloudfront.net/img/17f95c00-4ab0-492d-94a6-3a647e5ea2fe/bf7419ddaea3fcb11c9f6604de157b80.jpg). The supplied image bears an AZEMA Photography credit, which is retained in the original file. No open reuse license was stated; this reference is used in the local project preview. Use rights-cleared venue photography for public distribution.

The superseded generated venue originals remain in the tool's generated-images directory; they are no longer displayed by the homepage.
