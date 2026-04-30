import { readFile, writeFile } from 'node:fs/promises';

const events = JSON.parse(await readFile(new URL('./data/events-merged.json', import.meta.url), 'utf8'));

function decodeHtml(str='') {
  return str
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#038;/g, '&')
    .replace(/&#8230;/g, '…')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#039;/g, "'");
}

function deriveNeighborhood(ev) {
  if (ev.neighborhood) {
    const cleaned = decodeHtml(ev.neighborhood.replace(/^Neighborhood\s*:?\s*/i, '').trim());
    if (cleaned && cleaned.length < 60 && !/[.!?]/.test(cleaned)) return cleaned;
  }
  const t = ((ev.title || '') + ' ' + (ev.address || '') + ' ' + (ev.description || '')).toLowerCase();
  const checks = [
    ['East Harlem', /east harlem/],
    ['West Harlem', /west harlem/],
    ['Harlem', /\bharlem\b/],
    ['Hudson Heights', /hudson heights/],
    ['Washington Heights', /\bwahi\b|washington heights|in the heights/],
    ['Upper West Side', /upper west side/],
    ['Upper East Side', /upper east side/],
    ['Midtown', /\bmidtown\b/],
    ['Chelsea', /\bchelsea\b/],
    ['Tribeca', /\btribeca\b/],
    ['Chinatown', /\bchinatown\b/],
    ['Lower East Side', /lower east side/],
    ['East Village', /east village/],
    ['West Village', /west village/],
    ['Greenwich Village', /greenwich village|\bvillage\b/],
    ['Financial District', /financial district|wall ?street|fidi/],
    ['Central Park', /central park|north woods/],
    ['Morningside Heights', /morningside heights/],
    ['Hudson Yards', /hudson yards/],
    ['Hell\'s Kitchen', /hell'?s kitchen|clinton\b/],
    ['Brooklyn Heights', /brooklyn heights/],
    ['Clinton Hill', /clinton hill/],
    ['Fort Greene', /fort greene/],
    ['Prospect Heights', /prospect heights/],
    ['Park Slope', /park slope/],
    ['Prospect Park', /prospect park/],
    ['Windsor Terrace', /windsor terrace/],
    ['Bed-Stuy', /bed[- ]stuy|bedford[- ]stuyvesant/],
    ['Williamsburg', /williamsburg/],
    ['Bushwick', /bushwick/],
    ['DUMBO', /\bdumbo\b/],
    ['Downtown Brooklyn', /downtown brooklyn|atlantic yards/],
    ['Coney Island', /coney island/],
    ['Marine Park', /marine park/],
    ['Canarsie', /canarsie/],
    ['Crown Heights', /crown heights/],
    ['Rego Park', /rego park/],
    ['Sunnyside', /sunnyside/],
    ['Jackson Heights', /jackson heights/],
    ['Astoria', /astoria/],
    ['Long Island City', /long island city|\blic\b/],
    ['Flushing', /flushing/],
    ['Forest Hills', /forest hills/],
    ['Fordham', /fordham/],
    ['South Bronx', /south bronx/],
    ['Mott Haven', /mott haven/],
    ['St. George', /st\. george/],
    ['North Shore', /north shore|conference house|freshkills/],
    ['Hudson River Park', /hudson river park|gansevoort/],
    ['East River', /east river/],
    ['Shirley Chisholm State Park', /shirley chisholm/],
  ];
  for (const [name,re] of checks) if (re.test(t)) return name;
  return null;
}

const normalized = events.map(ev => ({
  ...ev,
  title: decodeHtml((ev.title || '').replace(/\s+&#8211;\s+The Municipal Art Society of New York$/,'')),
  description: decodeHtml(ev.description || ''),
  borough: decodeHtml((ev.borough || '').replace(/^Borough\s*:?\s*/i,'').trim()) || null,
  neighborhood: deriveNeighborhood(ev),
  address: decodeHtml(ev.address || ''),
  duration: decodeHtml(ev.duration || ''),
  dateText: decodeHtml(ev.dateText || ''),
  walkType: decodeHtml(ev.walkType || ''),
}));

await writeFile(new URL('./data/events-merged.json', import.meta.url), JSON.stringify(normalized, null, 2));
console.log(JSON.stringify({
  total: normalized.length,
  withNeighborhood: normalized.filter(x => x.neighborhood).length,
  sample: normalized.slice(0,3).map(x => ({ title:x.title, neighborhood:x.neighborhood, borough:x.borough }))
}, null, 2));
