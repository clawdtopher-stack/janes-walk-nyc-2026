import { readFile } from 'node:fs/promises';
const arr = JSON.parse(await readFile(new URL('./data/events-merged.json', import.meta.url), 'utf8'));
console.log(JSON.stringify({
  sampleWithDuration: arr.filter(x => x.duration).slice(0,5).map(x => ({ title:x.title, duration:x.duration, borough:x.borough, bookingUrl:x.bookingUrl })),
  sampleWithoutDuration: arr.filter(x => !x.duration).slice(0,5).map(x => ({ title:x.title, dateText:x.dateText, url:x.url }))
}, null, 2));
