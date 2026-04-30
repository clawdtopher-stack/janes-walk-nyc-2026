import { readFile } from 'node:fs/promises';

const events = JSON.parse(await readFile(new URL('./data/events-merged.json', import.meta.url), 'utf8'));

function toMinutes(time = '') {
  const m = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const mer = m[3].toUpperCase();
  if (mer === 'PM' && h !== 12) h += 12;
  if (mer === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

function parseDateText(dateText = '') {
  const m = dateText.match(/(Friday|Saturday|Sunday)\s+May\s+(\d+)\s*\|\s*(.+)/i);
  if (!m) return { dateLabel: 'Unknown', time: '', day: '' };
  const day = Number(m[2]);
  if (![1, 2, 3].includes(day)) return { dateLabel: 'Unknown', time: '', day: '' };
  return { dateLabel: `May ${day} (${m[1]})`, time: m[3].trim(), day };
}

function timeBucket(time = '') {
  const minutes = toMinutes(time);
  if (minutes == null) return 'Unknown';
  if (minutes < 600) return 'Morning (before 10)';
  if (minutes < 720) return 'Late Morning (10–12)';
  if (minutes < 900) return 'Afternoon (12–3)';
  if (minutes < 1080) return 'Late Afternoon (3–6)';
  return 'Evening (6+)';
}

function filterSample() {
  return events.filter(ev => {
    const p = parseDateText(ev.dateText || '');
    const hay = [ev.title, ev.description, ev.neighborhood, ev.borough, ev.address].filter(Boolean).join(' ').toLowerCase();
    return hay.includes('harlem') && p.dateLabel === 'May 2 (Saturday)' && ev.borough === 'Manhattan';
  }).slice(0, 8).map(x => ({
    title: x.title,
    date: x.dateText,
    borough: x.borough,
    neighborhood: x.neighborhood,
    bucket: timeBucket(parseDateText(x.dateText || '').time),
  }));
}

const parsedDates = events.map(ev => parseDateText(ev.dateText || '').dateLabel);
const neighborhoods = [...new Set(events.map(ev => ev.neighborhood).filter(Boolean))].sort();

console.log(JSON.stringify({
  total: events.length,
  invalidDateOptionsIfUsedDirectly: [...new Set(parsedDates.filter(x => x === 'Unknown'))].length,
  garbageNeighborhoodsStillPresent: neighborhoods.filter(x => /municipal art society|^[-–—]|history group/i.test(x)),
  harlemSaturdayManhattanSample: filterSample(),
}, null, 2));
