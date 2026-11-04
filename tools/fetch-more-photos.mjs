/**
 * Fetch extra freely licensed photos: destination galleries, hotels,
 * restaurants and signature dishes. Writes img/g|h|r|d/*.jpg, extends
 * img/credits.json + img/CREDITS.md and writes photos-more.js.
 *
 *   node tools/fetch-more-photos.mjs                 # everything missing
 *   node tools/fetch-more-photos.mjs gallery dishes  # only these kinds
 *   node tools/fetch-more-photos.mjs --force hotels  # re-fetch hotels
 *
 * Licences accepted: CC0, CC BY, CC BY-SA (any version), public domain.
 */
import { writeFile, mkdir, readFile, access } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import vm from 'node:vm';

const UA = 'PlanIndiaPhotoBot/1.0 (https://github.com/rohitranjan-codes/plan-india; static travel site)';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const WIKI = 'https://en.wikipedia.org/w/api.php';

/* Load the site data the way the browser does */
globalThis.window = {};
for (const f of ['data.js', 'guide.js', 'destinations2.js', 'facts.js']) vm.runInThisContext(await readFile(f, 'utf8'), { filename: f });
const T = window.TRIP, G = window.GUIDE, F = window.FACTS;

/* Wikipedia articles whose lead image shows the hotel (names must match guide.js) */
const HOTEL_ARTICLES = {
  'The Imperial': 'The Imperial, New Delhi', 'The Oberoi New Delhi': 'The Oberoi, New Delhi', 'Taj Mahal, New Delhi': 'Taj Mahal Hotel, Delhi',
  'ITC Grand Chola': 'ITC Grand Chola', 'The Oberoi Grand': 'The Oberoi Grand', 'Taj Bengal': 'Taj Bengal', 'Taj West End': 'Taj West End',
  'Taj Falaknuma Palace': 'Falaknuma Palace', 'Rambagh Palace': 'Rambagh Palace', 'The Oberoi Rajvilas': 'The Oberoi Rajvilas', 'Samode Haveli': 'Samode Haveli',
  'Umaid Bhawan Palace': 'Umaid Bhawan Palace', 'Taj Lake Palace': 'Lake Palace', 'The Oberoi Udaivilas': 'The Oberoi Udaivilas', 'The Leela Palace Udaipur': 'The Leela Palace Udaipur',
  'The Oberoi Amarvilas': 'The Oberoi Amarvilas', 'ITC Mughal': 'ITC Mughal', 'Wildflower Hall (Oberoi)': 'Wildflower Hall', 'The Oberoi Cecil': 'The Oberoi Cecil',
  'Windamere Hotel': 'Windamere Hotel', 'Glenburn Tea Estate': 'Glenburn Tea Estate', 'Ananda in the Himalayas': 'Ananda in the Himalayas',
  'The Taj Mahal Palace': 'Taj Mahal Palace Hotel', 'The Oberoi Mumbai': 'The Oberoi, Mumbai', 'Savoy (Taj)': 'Savoy Hotel, Ooty', 'Elgin Nor-Khill': 'Nor-Khill',
  'Mayfair Darjeeling': 'Mayfair Darjeeling', 'The Oberoi Vanyavilas': 'The Oberoi Vanyavilas', 'The Lalit Temple View': 'The Lalit Temple View',
  'Taj Malabar Resort & Spa': 'Taj Malabar', 'Brunton Boatyard (CGH Earth)': 'Brunton Boatyard', 'Jagat Niwas Palace': 'Jagat Niwas Palace', 'BrijRama Palace': 'BrijRama Palace',
  'Fort Rajwada': 'Fort Rajwada', 'Suryagarh': 'Suryagarh', 'The Carlton': 'The Carlton, Kodaikanal', 'Taj Swarna': 'Taj Swarna',
};
/* Commons search for restaurants that have their own photos */
const EAT_QUERIES = {
  'Karim\'s': 'Karim\'s Jama Masjid Delhi', 'Indian Coffee House': 'Indian Coffee House', 'Britannia & Co.': 'Britannia and Co restaurant Mumbai', 'Kyani & Co.': 'Kyani and Co Mumbai',
  'Mavalli Tiffin Room (MTR)': 'Mavalli Tiffin Rooms Bangalore', 'Vidyarthi Bhavan': 'Vidyarthi Bhavan Bangalore', 'Paradise Biryani': 'Paradise restaurant Hyderabad',
  'Glenary\'s': 'Glenary\'s Darjeeling', 'Keventer\'s': 'Keventers Darjeeling', 'Blue Lassi Shop': 'Blue Lassi Varanasi', 'Chotiwala': 'Chotiwala Rishikesh',
  'Kesar da Dhaba': 'Kesar da Dhaba Amritsar', 'Bademiya': 'Bademiya Mumbai', 'Laxmi Misthan Bhandar (LMB)': 'Laxmi Misthan Bhandar Jaipur', 'Lassiwala': 'Lassiwala Jaipur',
  'Peter Cat': 'Peter Cat Kolkata', 'Nizam\'s': 'Nizam\'s Kolkata', 'Leopold Cafe': 'Leopold Cafe', 'Murugan Idli Shop': 'Murugan Idli Shop',
};

const OK_LICENSE = /^(cc0|cc[ -]by([ -]sa)?([ -][0-9.]+)?|pd|public domain)/i;
const BAD_ANY = /\b(map|logo|diagram|plan|chart|stamp|coin|banknote|drawing|sketch|painting|poster|flag|coat of arms|collage|montage|selfie|portrait|wedding|satellite|miniature|replica)\b|\.svg$|\.png$|\.gif$/i;
const BAD_PLACE = /\b(interior|inside|hotel|restaurant|cafe|menu|room|bedroom|crowd|people|butterfly|moth|bird|egret|flower|hibiscus|seed|bulb|leaf|insect|spider|frog|snake|lizard|fungus|mushroom|macro|closeup|close-up|panorama)\b|\b(18|19)\d\d\b/i;
const STOP = new Set(['hotel', 'resort', 'resorts', 'palace', 'spa', 'taj', 'oberoi', 'itc', 'the', 'and', 'lodge', 'retreat', 'retreats', 'camp', 'heritage', 'villa', 'house', 'grand', 'royal', 'inn', 'club', 'regency', 'hyatt', 'marriott', 'radisson', 'lemon', 'tree', 'premier', 'park', 'earth', 'cgh', 'safaris', 'sujan', 'neemrana', 'jungle', 'lodges', 'beach', 'river', 'estate', 'tents', 'tent', 'city', 'lake', 'hills', 'hill', 'garden', 'gardens', 'tea', 'india', 'restaurant', 'cafe', 'café', 'kitchen', 'bhavan', 'hotels', 'wyndham', 'ramada', 'courtyard', 'novotel', 'westin', 'sterling', 'mayfair', 'elgin', 'evolve', 'back', 'wild', 'green', 'blue', 'red', 'plaza', 'tower', 'towers', 'view', 'shop', 'sweet', 'sweets', 'mart', 'street', 'place', 'home', 'dhaba', 'mess']);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(base, params) {
  const url = base + '?' + new URLSearchParams({ format: 'json', origin: '*', ...params });
  for (let i = 0; i < 3; i++) { const r = await fetch(url, { headers: { 'User-Agent': UA } }); if (r.ok) return r.json(); await sleep(1500 * (i + 1)); }
  throw new Error('request failed ' + url.slice(0, 90));
}
function parse(p, ii) {
  const m = ii.extmetadata || {};
  const license = (m.LicenseShortName && m.LicenseShortName.value) || '';
  const year = +(((m.DateTimeOriginal && m.DateTimeOriginal.value) || '').match(/\b(19|20)\d\d\b/) || [0])[0];
  const assessments = ((m.Assessments && m.Assessments.value) || '').toLowerCase();
  return { title: p.title, width: ii.width, height: ii.height, mime: ii.mime, thumb: ii.thumburl, page: ii.descriptionurl, license, year,
    quality: /featured/.test(assessments) ? 3 : /quality/.test(assessments) ? 2 : /valued/.test(assessments) ? 1 : 0,
    restrictions: (m.Restrictions && m.Restrictions.value) || '',
    author: ((m.Artist && m.Artist.value) || '').replace(/<[^>]+>/g, '').trim(),
    desc: ((m.ImageDescription && m.ImageDescription.value) || '').replace(/<[^>]+>/g, ''),
    cats: (p.categories || []).map((c) => c.title.replace(/^Category:/, '')).join(' | ') };
}
function usable(c, { width, minW, minAspect, maxAspect = 2.4, bad = BAD_ANY, minYear = 2005 }) {
  return c && /^image\/jpe?g$/.test(c.mime) && c.width >= minW && c.width / c.height >= minAspect && c.width / c.height <= maxAspect &&
    OK_LICENSE.test(c.license) && !/trademarked|personality/i.test(c.restrictions) && !bad.test(c.title) && !BAD_ANY.test(c.title) && (!c.year || c.year >= minYear);
}
/** Lead image of a Wikipedia article as a Commons file record. */
async function leadImage(article, opts) {
  const j = await getJson(WIKI, { action: 'query', titles: article, prop: 'pageimages', piprop: 'name', redirects: 1 });
  const page = Object.values((j.query && j.query.pages) || {})[0];
  const name = page && page.pageimage; if (!name) return null;
  const c = await getJson(COMMONS, { action: 'query', titles: 'File:' + name, prop: 'imageinfo|categories', clshow: '!hidden', cllimit: 20, iiprop: 'url|size|mime|extmetadata', iiurlwidth: opts.width });
  const p = Object.values((c.query && c.query.pages) || {})[0];
  const ii = p && p.imageinfo && p.imageinfo[0]; if (!ii || p.missing !== undefined) return null;
  const rec = parse(p, ii); rec.article = page.title;
  return usable(rec, opts) ? rec : null;
}
/** Top Wikipedia article for a free-text search, if its title shares a distinctive token with the name. */
async function findArticle(name) {
  const j = await getJson(WIKI, { action: 'query', list: 'search', srsearch: name, srlimit: 3 });
  const hits = ((j.query && j.query.search) || []).map((h) => h.title);
  const toks = tokens(name); if (!toks.length) return null;
  return hits.find((h) => toks.some((w) => h.toLowerCase().includes(w))) || null;
}
async function commonsSearch(q, opts) {
  const j = await getJson(COMMONS, { action: 'query', generator: 'search', gsrsearch: `${q} filetype:bitmap`, gsrnamespace: 6, gsrlimit: 25, prop: 'imageinfo|categories', clshow: '!hidden', cllimit: 20, iiprop: 'url|size|mime|extmetadata', iiurlwidth: opts.width });
  return Object.values((j.query && j.query.pages) || {}).map((p) => p.imageinfo && p.imageinfo[0] ? parse(p, p.imageinfo[0]) : null).filter((c) => usable(c, opts));
}
const tokens = (s) => s.toLowerCase().replace(/\(.*?\)/g, ' ').split(/[^a-z]+/).filter((w) => w.length >= 4 && !STOP.has(w));
const slug = (s) => s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function relevant(c, name, city) {
  const hay = `${c.title} ${c.desc} ${c.cats}`.toLowerCase();
  const toks = tokens(name); if (!toks.length) return false;
  const cityOk = !city || tokens(city).some((w) => hay.includes(w)) || hay.includes('india');
  return toks.some((w) => hay.includes(w)) && cityOk;
}
const best = (list) => list.sort((a, b) => (b.quality - a.quality) || (b.year - a.year) || (b.width - a.width))[0];
async function download(url, file) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error('download ' + r.status);
  await pipeline(Readable.fromWeb(r.body), createWriteStream(file));
}
async function exists(p) { try { await access(p); return true; } catch { return false; } }
const credit = (c, via) => ({ title: c.title.replace(/^File:/, ''), author: ((c.author || 'Unknown').replace(/^this photo was taken by\s*/i, '').split(/[\n.]/)[0].trim().slice(0, 60)) || 'Unknown', license: c.license, page: c.page, via });

/* ---------------------------------------------------------------- */
const args = process.argv.slice(2);
const force = args.includes('--force');
const kinds = args.filter((a) => !a.startsWith('--'));
const want = (k) => !kinds.length || kinds.includes(k);
for (const d of ['img/g', 'img/h', 'img/r', 'img/d']) await mkdir(d, { recursive: true });
let credits = {};
try { credits = JSON.parse(await readFile('img/credits.json', 'utf8')); } catch { /* none yet */ }
const more = credits._more || (credits._more = { gallery: {}, hotel: {}, eat: {}, dish: {} });

/* 1. Galleries: lead images of the other Wikipedia articles listed for the destination (tools/fetch-photos.mjs ARTICLES) */
if (want('gallery')) {
  const src = await readFile('tools/fetch-photos.mjs', 'utf8');
  const ARTICLES = vm.runInNewContext('(' + src.slice(src.indexOf('const ARTICLES = ') + 'const ARTICLES = '.length, src.indexOf('};', src.indexOf('const ARTICLES = ')) + 1) + ')');
  for (const d of T.destinations) {
    const id = d.id, have = more.gallery[id] || [];
    if (!force && have.length) { console.log(`= gallery ${id} (kept ${have.length})`); continue; }
    const coverTitle = (credits[id] || {}).title || '';
    const out = []; const seen = new Set([coverTitle]);
    for (const art of ARTICLES[id] || []) {
      if (out.length >= 4) break;
      let rec = null;
      try { rec = await leadImage(art, { width: 1200, minW: 900, minAspect: 0.9, bad: BAD_PLACE }); } catch (e) { console.warn(`  ! ${id}/${art}: ${e.message}`); }
      if (rec && !seen.has(rec.title.replace(/^File:/, ''))) {
        seen.add(rec.title.replace(/^File:/, ''));
        const file = `img/g/${id}-${out.length + 1}.jpg`;
        try { await download(rec.thumb, file); out.push({ file, caption: rec.article, ...credit(rec, 'wikipedia:' + art) }); } catch (e) { console.warn(`  ! ${id}: ${e.message}`); }
      }
      await sleep(200);
    }
    if (out.length) more.gallery[id] = out;
    console.log(`+ gallery ${id}: ${out.length} photo(s)`);
  }
}

/* 2. Hotels: Wikipedia article (mapped or searched) → lead image; else Commons search */
if (want('hotels')) {
  for (const [id, list] of Object.entries(G.picks)) {
    const city = G.searchCity[id] || (T.destinations.find((d) => d.id === id) || {}).name || '';
    for (const p of list) {
      if (p.tier === 'budget') continue;
      const key = slug(p.n);
      if (!force && more.hotel[key]) { continue; }
      const opts = { width: 900, minW: 700, minAspect: 1.0 };
      let rec = null, via = '';
      try {
        const art = HOTEL_ARTICLES[p.n] || (await findArticle(p.n + ' hotel'));
        if (art) { rec = await leadImage(art, opts); via = 'wikipedia:' + art; }
        if (!rec && tokens(p.n).length) { rec = best((await commonsSearch(`${p.n.replace(/\(.*?\)/g, '')} ${city}`, opts)).filter((c) => relevant(c, p.n, city))); via = 'commons'; }
      } catch (e) { console.warn(`  ! hotel ${p.n}: ${e.message}`); }
      if (!rec) { console.log(`x hotel ${p.n}`); await sleep(150); continue; }
      const file = `img/h/${key}.jpg`;
      try { await download(rec.thumb, file); more.hotel[key] = { file, name: p.n, ...credit(rec, via) }; console.log(`+ hotel ${p.n}: ${rec.title}`); } catch (e) { console.warn(`  ! ${p.n}: ${e.message}`); }
      await sleep(300);
    }
  }
}

/* 3. Restaurants: only those with a curated Commons query (others use a dish photo) */
if (want('eat')) {
  for (const [id, list] of Object.entries(G.eat)) {
    const city = G.searchCity[id] || '';
    for (const p of list) {
      const key = slug(p.n); const q = EAT_QUERIES[p.n]; if (!q) continue;
      if (!force && more.eat[key]) continue;
      let rec = null;
      try { rec = best((await commonsSearch(q, { width: 900, minW: 600, minAspect: 0.9 })).filter((c) => relevant(c, p.n, city))); } catch (e) { console.warn(`  ! eat ${p.n}: ${e.message}`); }
      if (!rec) { console.log(`x eat ${p.n}`); continue; }
      const file = `img/r/${key}.jpg`;
      try { await download(rec.thumb, file); more.eat[key] = { file, name: p.n, ...credit(rec, 'commons') }; console.log(`+ eat ${p.n}: ${rec.title}`); } catch (e) { console.warn(`  ! ${p.n}: ${e.message}`); }
      await sleep(300);
    }
  }
}

/* 4. Dishes: lead image of the dish's Wikipedia article */
if (want('dishes')) {
  for (const [key, d] of Object.entries(F.dish)) {
    if (!force && more.dish[key]) continue;
    let rec = null, via = '';
    for (const art of d.art) {
      try { rec = await leadImage(art, { width: 900, minW: 500, minAspect: 0.8, minYear: 0 }); } catch (e) { console.warn(`  ! dish ${key}/${art}: ${e.message}`); }
      if (rec) { via = 'wikipedia:' + art; break; }
      await sleep(150);
    }
    if (!rec) { console.log(`x dish ${key}`); continue; }
    const file = `img/d/${key}.jpg`;
    try { await download(rec.thumb, file); more.dish[key] = { file, name: d.n, ...credit(rec, via) }; console.log(`+ dish ${key}: ${rec.title}`); } catch (e) { console.warn(`  ! ${key}: ${e.message}`); }
    await sleep(250);
  }
}

/* Write credits + photos-more.js */
await writeFile('img/credits.json', JSON.stringify(credits, null, 2));
const destLines = Object.entries(credits).filter(([k]) => !k.startsWith('_')).map(([id, c]) => `- **${id}** — [${c.title}](${c.page}) by ${c.author} · ${c.license}`);
const moreLines = [];
for (const [id, l] of Object.entries(more.gallery)) l.forEach((c) => moreLines.push(`- **${id}** (gallery) — [${c.title}](${c.page}) by ${c.author} · ${c.license}`));
for (const kind of ['hotel', 'eat', 'dish']) for (const c of Object.values(more[kind])) moreLines.push(`- **${c.name}** (${kind}) — [${c.title}](${c.page}) by ${c.author} · ${c.license}`);
await writeFile('img/CREDITS.md', '# Photo credits\n\nAll photos from Wikimedia Commons under the licence shown. Thank you to the photographers.\n\n## Destinations\n\n' + destLines.join('\n') + '\n\n## Galleries, hotels, restaurants and dishes\n\n' + moreLines.join('\n') + '\n');
const strip = (c) => ({ src: c.file, author: c.author, license: c.license, page: c.page, ...(c.caption ? { caption: c.caption } : {}) });
const out = { gallery: Object.fromEntries(Object.entries(more.gallery).map(([k, l]) => [k, l.map(strip)])), hotel: {}, eat: {}, dish: {} };
for (const kind of ['hotel', 'eat', 'dish']) for (const [k, c] of Object.entries(more[kind])) out[kind][k] = strip(c);
await writeFile('photos-more.js', '/* Generated by tools/fetch-more-photos.mjs — do not edit by hand. Credits in img/CREDITS.md */\nwindow.PHOTOS_MORE = ' + JSON.stringify(out, null, 1) + ';\n');
console.log(`done: galleries ${Object.keys(out.gallery).length}, hotels ${Object.keys(out.hotel).length}, restaurants ${Object.keys(out.eat).length}, dishes ${Object.keys(out.dish).length}`);
