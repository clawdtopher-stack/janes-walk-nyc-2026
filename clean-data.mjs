import { readFile, writeFile } from 'node:fs/promises';

const path = new URL('./data/events-merged.json', import.meta.url);
const events = JSON.parse(await readFile(path, 'utf8'));

function cleanNeighborhood(value) {
  if (!value) return null;
  let cleaned = String(value)
    .replace(/–\s*The Municipal Art Society of New York/gi, '')
    .replace(/The Municipal Art Society of New York/gi, '')
    .replace(/^in\s+/i, '')
    .replace(/^[-–—\s]+/, '')
    .trim();
  if (!cleaned) return null;
  if (/history group/i.test(cleaned)) return null;
  if (cleaned.length > 60) return null;
  return cleaned;
}

function cleanDateText(value, walkType) {
  if (!value) return value;
  const text = String(value).trim();
  if (/Sunday May 31 \| 11:59 PM/i.test(text)) {
    return walkType === 'virtual' ? 'Virtual / on-demand' : null;
  }
  return text;
}

const cleaned = events.map(ev => ({
  ...ev,
  neighborhood: cleanNeighborhood(ev.neighborhood),
  dateText: cleanDateText(ev.dateText, ev.walkType),
}));

await writeFile(path, JSON.stringify(cleaned, null, 2) + '\n');

const summary = {
  total: cleaned.length,
  nullNeighborhoods: cleaned.filter(x => !x.neighborhood).length,
  virtualOnDemandDates: cleaned.filter(x => x.dateText === 'Virtual / on-demand').length,
  remainingBadNeighborhoods: cleaned.filter(x => x.neighborhood && /municipal art society|history group|^[-–—]|^in\s+/i.test(x.neighborhood)).map(x => ({ title: x.title, neighborhood: x.neighborhood })),
  remainingMay31Dates: cleaned.filter(x => /May 31/i.test(x.dateText || '')).map(x => ({ title: x.title, dateText: x.dateText })),
};

console.log(JSON.stringify(summary, null, 2));
