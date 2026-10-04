# Venue layout files

Venue layouts are authored by the development team as JSON, not through an admin editor (BRD §4.5).
One file per venue. Adding a venue = adding a file here.

The two launch venues are real Egyptian venues, but their layouts and capacities are **simplified
for the project** — they are not the venues' official seat maps.

| File | Type | Capacity |
|---|---|---|
| `cairo-opera-house-small-hall.json` | SEATED | 240 (Orchestra 160, Balcony 80) |
| `al-manara-arena.json` | STANDING | 2000 (3 zones) |

## Common fields

| Field | Meaning |
|---|---|
| `slug` | Unique id for the file, kebab-case. Must match the filename. |
| `name`, `address`, `city`, `country` | Shown on the event page (FR-EVT-02). |
| `latitude`, `longitude` | Map pin (FR-EVT-02, FR-TKT-07). Approximate. |
| `type` | `SEATED` or `STANDING`. Decides which of `sections` / `zones` is used. |
| `capacity` | Total admissions. Must equal the sum of seats or zone capacities. |
| `categories` | Category **keys** the venue offers. Prices are NOT here — the admin sets price and service fee per category when creating an event (FR-ADM-07). |

## SEATED: `sections`

Each section has `rows`; each row has a `label`, a seat count `seats`, and one `category`.
Seats are numbered `1..seats` left to right. A seat's label is `SECTION-ROW-NUMBER`, e.g. `ORC-A-7`.
Every seat belongs to exactly one category because the category is set per row (FR-TKT-13).

## STANDING: `zones`

Each zone has a `category`, a `capacity`, and a rectangle (`x`, `y`, `width`, `height`) in a
0–100 coordinate space, so the frontend can draw where the zone sits (FR-TKT-20).

## Validation rules (enforced by the loader)

1. `slug` unique and matches the filename.
2. Every `category` used by a row or zone is declared in `categories`.
3. Every declared category is used at least once.
4. No duplicate section keys, row labels within a section, or zone keys.
5. Sum of seats / zone capacities equals `capacity`.
6. `SEATED` files have `sections` and no `zones`; `STANDING` files the reverse.
