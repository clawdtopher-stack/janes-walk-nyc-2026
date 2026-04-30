import { writeFile, mkdir } from 'node:fs/promises';

const BASE = 'https://www.mas.org';
const PAGE_URL = 'https://www.mas.org/janes-walk-nyc-2026/';
const OUT = new URL('./data/', import.meta.url);

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; JaneWalkScraper/1.0; +https://www.mas.org/janes-walk-nyc-2026/)'
    }
  });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  return await res.text();
}

function uniq(arr) {
  return [...new Set(arr)];
}

function extractMapJson(html) {
  const m = html.match(/let\s+sites\s*=\s*'([\s\S]*?)';\s*\n/);
  if (!m) throw new Error('Could not find embedded sites JSON');
  const raw = m[1]
    .replace(/\\\//g, '/')
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t');
  return JSON.parse(raw);
}

function extractEventLinks(html) {
  const links = [];
  const re = /https:\/\/www\.mas\.org\/events\/[^"'\\<\s)]+/g;
  for (const m of html.matchAll(re)) links.push(m[0]);
  return uniq(links.map(x => x.replace(/\\\//g, '/')));
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const html = await fetchText(PAGE_URL);
  await writeFile(new URL('./data/main-page.html', import.meta.url), html);

  const map = extractMapJson(html);
  const links = extractEventLinks(html);

  const mapRecords = Object.entries(map).map(([id, value]) => ({
    id,
    title: value?.event_data?.event_title ?? null,
    dateText: value?.event_data?.date ?? null,
    walkType: value?.event_data?.walk_type ?? null,
    permalink: value?.event_data?.perma_link ?? null,
    address: value?.location?.address ?? null,
    lat: value?.location?.lat ?? null,
    lng: value?.location?.lng ?? null,
    locationName: value?.location?.name ?? null,
    city: value?.location?.city ?? null,
    state: value?.location?.state_short ?? value?.location?.state ?? null,
    postCode: value?.location?.post_code ?? null,
    raw: value
  }));

  await writeFile(new URL('./data/map-records.json', import.meta.url), JSON.stringify(mapRecords, null, 2));
  await writeFile(new URL('./data/page-links.json', import.meta.url), JSON.stringify(links, null, 2));
  await writeFile(
    new URL('./data/discovery-summary.json', import.meta.url),
    JSON.stringify({
      pageUrl: PAGE_URL,
      mapCount: mapRecords.length,
      pageEventLinkCount: links.length,
      uniqueMapPermalinks: uniq(mapRecords.map(r => r.permalink).filter(Boolean)).length
    }, null, 2)
  );

  console.log(JSON.stringify({
    mapCount: mapRecords.length,
    pageEventLinkCount: links.length,
    uniqueMapPermalinks: uniq(mapRecords.map(r => r.permalink).filter(Boolean)).length,
    sample: mapRecords.slice(0, 3).map(r => ({ title: r.title, dateText: r.dateText, permalink: r.permalink }))
  }, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
