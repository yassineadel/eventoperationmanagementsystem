# Homepage images

Images are stored locally in `public/event-images/` so the page does not depend on external image requests at runtime.

`hero-ticket.png` is the concert photograph used by the current homepage. It was created with the built-in ImageGen tool from the approved homepage mockup using this prompt:

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

All event names, venues, dates, and prices are fictional sample content; these images do not depict the named events.

The official SIL Open Font License files for these families are included beside the font files as Anton-OFL.txt, DM-Serif-Display-OFL.txt, and Cairo-OFL.txt.
