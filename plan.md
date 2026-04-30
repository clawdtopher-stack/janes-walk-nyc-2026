# Jane's Walk NYC 2026 app plan

## Goal
Build a local web app and public tunnel URL for Jane's Walk NYC 2026 (May 1-3) with:
- filtering by date, time, borough, neighborhood
- full description and duration
- links to actual booking/tour pages
- data sourced from both page listings and embedded JS map data
- deduped and as complete as possible (~300 walks target)

## Iterative plan

### Phase 1: Discovery + data source verification
- Fetch main page HTML
- Extract embedded `sites` JSON from script tag
- Confirm count of map entries
- Extract candidate event links from page HTML
- Verify whether event detail pages contain description/duration/neighborhood/borough data

### Phase 2: Scraper implementation
- Build Node scraper using built-in fetch/regex only (no extra deps required)
- Parse map JSON into normalized records
- Parse page HTML for event links/listed cards
- Merge unique event URLs/IDs
- Fetch event detail pages in chunks with retry and polite pacing
- Extract:
  - title
  - booking url (= event page)
  - date
  - start time
  - duration
  - description
  - address/location
  - neighborhood
  - borough
  - walk type
- Deduplicate by permalink/url and fuzzy title+date fallback
- Save raw/intermediate JSON snapshots for verification

### Phase 3: Verification
- Produce counts by source:
  - map entries
  - page links
  - merged unique events
  - fully hydrated events
- Produce missing-fields report
- Spot check 10+ samples

### Phase 4: Web app
- Static local web app (HTML/CSS/JS)
- Loads generated JSON
- Filters:
  - date
  - time bucket or exact start time text
  - borough
  - neighborhood
- Search by title text
- Card/list UI with:
  - title
  - date/time
  - neighborhood/borough
  - duration
  - full description
  - booking link

### Phase 5: Local host + tunnel
- Start a local server
- Start public tunnel
- Verify public accessibility
- Share URL + counts + caveats

## Robustness rules
- Keep raw source dumps for debugging
- Keep scraper idempotent
- Write normalized JSON and QA reports
- Build in chunks and verify after each phase
