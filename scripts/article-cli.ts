/** `npm run article -- <url>`: an article's full text. Key facts like retractions are often far down the page. */
import { htmlToText } from './article';

const url = process.argv[2];
if (!url) {
  console.error('usage: npm run article -- <url>');
  process.exit(2);
}
const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (research; tiktok-retention-video-generator)' } });
if (!res.ok) {
  console.error(`${new URL(url).host} answered ${res.status}: use another outlet's coverage, and note that you couldn't read this one.`);
  process.exit(1);
}
console.log(htmlToText(await res.text(), Infinity));
