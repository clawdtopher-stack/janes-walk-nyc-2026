import { readFile, writeFile, mkdir } from 'node:fs/promises';

const DATA_DIR = new URL('./data/', import.meta.url);
const delay = ms => new Promise(r => setTimeout(r, ms));

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; JaneWalkScraper/1.0)'
    }
  });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  return await res.text();
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, '–')
    .replace(/&#038;/g, '&')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function textBetween(html, startRe, endRe) {
  const start = html.search(startRe);
  if (start === -1) return null;
  const sliced = html.slice(start);
  const endMatch = sliced.match(endRe);
  if (!endMatch) return sliced;
  return sliced.slice(0, endMatch.index);
}

function firstMatch(html, regex) {
  const m = html.match(regex);
  return m ? (m[1] ?? m[0]) : null;
}

function extractDescription(html) {
  const og = firstMatch(html, /<meta\s+property="og:description"\s+content="([^"]+)"/i);
  const eventBlurb = firstMatch(html, /<div class="row event-content-and-meta janes-meta">([\s\S]*?)<div class="col offset_1 col_4 event_date_info">/i);
  const article = firstMatch(html, /<div[^>]+class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/article>/i);
  const fromEventBlurb = eventBlurb ? stripTags(eventBlurb)
    .replace(/Accessibility[\s\S]*$/i, '')
    .replace(/Location Information[\s\S]*$/i, '')
    .trim() : null;
  const fromArticle = article ? stripTags(article) : null;
  if (fromEventBlurb && fromEventBlurb.length > 40) return fromEventBlurb;
  if (fromArticle && fromArticle.length > 120) return fromArticle;
  return og || null;
}

function extractLdJson(html) {
  const blocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(m => m[1].trim())
    .filter(Boolean);
  const out = [];
  for (const block of blocks) {
    try {
      out.push(JSON.parse(block));
    } catch {}
  }
  return out;
}

function walkObjects(x) {
  if (!x) return [];
  if (Array.isArray(x)) return x.flatMap(walkObjects);
  if (typeof x === 'object') return [x, ...Object.values(x).flatMap(walkObjects)];
  return [];
}

function extractFromText(text) {
  const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
  const durationLine = lines.find(l => /duration/i.test(l) || /minutes?$/i.test(l));
  const boroughLine = lines.find(l => /borough/i.test(l));
  const neighborhoodLine = lines.find(l => /neighborhood/i.test(l));
  const dateLine = lines.find(l => /(Friday|Saturday|Sunday)[,]?\s+May\s+[1-3]/i.test(l));
  return {
    durationText: durationLine || null,
    boroughText: boroughLine || null,
    neighborhoodText: neighborhoodLine || null,
    dateLine: dateLine || null,
  };
}

function cleanField(v) {
  if (!v) return null;
  return String(v).replace(/\s+/g, ' ').trim();
}

function boroughFromAddress(address='') {
  const a = address.toLowerCase();
  if (a.includes('brooklyn')) return 'Brooklyn';
  if (a.includes('queens')) return 'Queens';
  if (a.includes('bronx')) return 'Bronx';
  if (a.includes('staten island')) return 'Staten Island';
  if (a.includes('new york, ny') || a.includes('manhattan')) return 'Manhattan';
  return null;
}

function extractEventPage(url, html) {
  const ld = extractLdJson(html);
  const allObjs = walkObjects(ld);
  const eventObj = allObjs.find(o => (o['@type'] === 'Event') || (Array.isArray(o['@type']) && o['@type'].includes('Event')));
  const textDesc = extractDescription(html);
  const fullText = stripTags(html);
  const textInfo = extractFromText(fullText || textDesc || '');

  const title = cleanField(
    firstMatch(html, /<meta\s+property="og:title"\s+content="([^"]+)"/i) ||
    firstMatch(html, /<title>([^<]+)<\/title>/i) ||
    eventObj?.name
  );

  const startDate = cleanField(eventObj?.startDate || firstMatch(html, /"startDate":"([^"]+)"/i));
  const endDate = cleanField(eventObj?.endDate || firstMatch(html, /"endDate":"([^"]+)"/i));
  const description = cleanField(textDesc || eventObj?.description);
  const address = cleanField(
    eventObj?.location?.address?.streetAddress ||
    eventObj?.location?.address?.addressLocality ||
    eventObj?.location?.name ||
    firstMatch(html, /"address":"([^"]+)"/i)
  );

  const eventMetaHtml = firstMatch(html, /<div class="col offset_1 col_4 event_date_info">([\s\S]*?)<div class="row">/i) || '';
  const eventMetaText = stripTags(eventMetaHtml);
  const duration = cleanField(
    firstMatch(eventMetaText, /\b(\d+\s+minutes?)\b/i) ||
    firstMatch(eventMetaText, /\b(\d+\s+hours?)\b/i) ||
    firstMatch(eventMetaText, /\b(\d+(?:\.\d+)?\s+hours?)\b/i) ||
    firstMatch(fullText, /Duration\s*:?\s*([^\n]+)/i) ||
    firstMatch(fullText, /Length\s*:?\s*([^\n]+)/i) ||
    textInfo.durationText
  );

  const neighborhood = cleanField(
    firstMatch(fullText, /Neighborhood\s*:?\s*([^\n]+)/i) ||
    textInfo.neighborhoodText
  );

  const boroughRaw = cleanField(
    firstMatch(html, /Borough:\s*<strong>([^<]+)<\/strong>/i) ||
    firstMatch(fullText, /Borough\s*:?\s*([^\n]+)/i) ||
    textInfo.boroughText ||
    boroughFromAddress(address || '')
  );
  const borough = boroughRaw ? boroughRaw.split(/Theme:|Language:/i)[0].trim() : null;

  const signUpUrl = cleanField(firstMatch(html, /<a class="lrg-btn ticket-btn btn" href="([^"]+)"/i));

  return {
    url,
    title,
    startDate,
    endDate,
    description,
    duration,
    neighborhood,
    borough,
    address,
    signUpUrl,
    rawLdEvent: eventObj || null
  };
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true });
  const mapRecords = JSON.parse(await readFile(new URL('./data/map-records.json', import.meta.url), 'utf8'));
  const pageLinks = JSON.parse(await readFile(new URL('./data/page-links.json', import.meta.url), 'utf8'));
  const urls = [...new Set([...pageLinks, ...mapRecords.map(r => r.permalink).filter(Boolean)])];

  const results = [];
  const errors = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      const html = await fetchText(url);
      const event = extractEventPage(url, html);
      results.push(event);
      if ((i + 1) % 25 === 0) {
        console.log(`hydrated ${i + 1}/${urls.length}`);
      }
    } catch (err) {
      errors.push({ url, error: String(err) });
    }
    await delay(120);
  }

  const byUrl = new Map(results.map(r => [r.url, r]));
  const merged = mapRecords.map(r => {
    const hydrated = byUrl.get(r.permalink) || {};
    return {
      id: r.id,
      title: hydrated.title || r.title,
      url: r.permalink,
      bookingUrl: hydrated.signUpUrl || r.permalink,
      dateText: r.dateText,
      walkType: r.walkType,
      description: hydrated.description || null,
      duration: hydrated.duration || null,
      neighborhood: hydrated.neighborhood || null,
      borough: hydrated.borough || null,
      address: hydrated.address || r.address || null,
      lat: r.lat,
      lng: r.lng,
      locationName: r.locationName || null,
      startDate: hydrated.startDate || null,
      endDate: hydrated.endDate || null,
    };
  });

  const qa = {
    totalMapRecords: mapRecords.length,
    totalUniqueUrls: urls.length,
    hydratedCount: results.length,
    errorCount: errors.length,
    withDescription: merged.filter(x => x.description).length,
    withDuration: merged.filter(x => x.duration).length,
    withNeighborhood: merged.filter(x => x.neighborhood).length,
    withBorough: merged.filter(x => x.borough).length,
    withStartDate: merged.filter(x => x.startDate).length,
  };

  await writeFile(new URL('./data/hydrated-events.json', import.meta.url), JSON.stringify(results, null, 2));
  await writeFile(new URL('./data/events-merged.json', import.meta.url), JSON.stringify(merged, null, 2));
  await writeFile(new URL('./data/hydration-errors.json', import.meta.url), JSON.stringify(errors, null, 2));
  await writeFile(new URL('./data/qa-summary.json', import.meta.url), JSON.stringify(qa, null, 2));
  console.log(JSON.stringify(qa, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
