/**
 * Fetch one freely licensed landscape photo per destination from Wikimedia
 * Commons and write img/<id>.jpg, img/CREDITS.md and photos.js.
 *
 * Runs in GitHub Actions (.github/workflows/photos.yml) or locally:
 *   node tools/fetch-photos.mjs            # only missing ids
 *   node tools/fetch-photos.mjs --force    # re-fetch everything
 *   node tools/fetch-photos.mjs goa hampi  # specific ids
 *
 * Licenses accepted: CC0, CC BY, CC BY-SA (any version), public domain.
 */
import { writeFile, mkdir, readFile, access } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const UA = 'PlanIndiaPhotoBot/1.0 (https://github.com/rohitranjan-codes/plan-india; static travel site)';
const API = 'https://commons.wikimedia.org/w/api.php';
const WIDTH = 1600;

/* Curated search queries per destination: iconic, photogenic, landscape-friendly subjects. First match wins. */
const QUERIES = {
  bengaluru: ['Vidhana Soudha', 'Bangalore Palace', 'Lalbagh Bangalore', 'Bengaluru skyline'],
  goa: ['Palolem Beach', 'Goa beach palm', 'Chapora Fort', 'Vagator Beach', 'Goa sunset beach'],
  munnar: ['Munnar tea plantation', 'Munnar tea gardens', 'Munnar hills'],
  kochi: ['Chinese fishing nets Fort Kochi', 'Kerala backwaters houseboat Alappuzha', 'Alleppey backwaters', 'Fort Kochi beach'],
  thekkady: ['Periyar Lake Thekkady', 'Periyar Tiger Reserve boat', 'Thekkady'],
  mysuru: ['Mysore Palace night', 'Mysore Palace', 'Amba Vilas Palace'],
  coorg: ['Coorg', 'Kodagu coffee plantation', 'Madikeri Raja Seat', 'Abbey Falls'],
  hampi: ['Vittala Temple Hampi stone chariot', 'Hampi Virupaksha Temple', 'Hampi boulders'],
  hyderabad: ['Charminar Hyderabad', 'Golconda Fort Hyderabad', 'Chowmahalla Palace'],
  ooty: ['Nilgiri Mountain Railway', 'Ooty', 'Coonoor tea estate', 'Nilgiris tea', 'Udhagamandalam'],
  kabini: ['Kabini River elephant', 'Nagarhole National Park', 'Kabini backwaters'],
  chikmagalur: ['Mullayanagiri', 'Chikmagalur', 'Chikkamagaluru coffee', 'Baba Budan Giri', 'Western Ghats Karnataka'],
  gokarna: ['Om Beach', 'Kudle Beach', 'Gokarna Karnataka', 'Gokarna beach sunset'],
  wayanad: ['Edakkal Caves', 'Banasura Sagar Dam', 'Wayanad tea plantation', 'Chembra Peak'],
  varkala: ['Varkala Beach cliff', 'Varkala', 'Papanasam Beach', 'Kovalam beach'],
  andaman: ['Radhanagar Beach', 'Havelock Island', 'Andaman Islands beach', 'Port Blair sea', 'Andaman and Nicobar beach'],
  madurai: ['Meenakshi Amman Temple', 'Meenakshi Temple gopuram', 'Madurai temple tower', 'Thirumalai Nayakkar Mahal'],
  badami: ['Badami cave temples', 'Badami Agastya lake', 'Pattadakal temples'],
  pondicherry: ['Pondicherry White Town', 'Promenade Beach Pondicherry', 'Auroville Matrimandir'],
  goldentriangle: ['Taj Mahal sunrise', 'Taj Mahal', 'Amber Fort Jaipur', 'Hawa Mahal'],
  rajasthan: ['Lake Palace Udaipur', 'Mehrangarh Fort Jodhpur blue city', 'City Palace Udaipur'],
  varanasi: ['Varanasi ghats', 'Ganges Varanasi boats', 'Dashashwamedh Ghat', 'Varanasi river'],
  rishikesh: ['Lakshman Jhula', 'Ram Jhula Rishikesh', 'Rishikesh Ganga', 'Rishikesh'],
  mumbai: ['Gateway of India Mumbai', 'Marine Drive Mumbai night', 'Chhatrapati Shivaji Terminus'],
  delhi: ['Humayun Tomb Delhi', 'Qutb Minar', 'India Gate', 'Lotus Temple Delhi', 'Red Fort Delhi'],
  chennai: ['Kapaleeshwarar Temple', 'Mahabalipuram Shore Temple', 'Marina Beach Chennai'],
  kolkata: ['Victoria Memorial Kolkata', 'Howrah Bridge', 'Kolkata Victoria Memorial'],
};

const OK_LICENSE = /^(cc0|cc[ -]by([ -]sa)?([ -][0-9.]+)?|pd|public domain)/i;
const BAD_TITLE = /\b(map|logo|diagram|plan|chart|stamp|coin|banknote|drawing|sketch|painting|poster|flag|coat of arms|panorama|collage|montage|interior|inside|hotel|restaurant|cafe|menu|room|bedroom|selfie|portrait|wedding|crowd|people)\b|\b(18|19)\d\d\b|\bca\.|\.svg$|\.png$|\.gif$/i;

const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.filter((a) => !a.startsWith('--'));
const ids = only.length ? only : Object.keys(QUERIES);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(params) {
  const url = API + '?' + new URLSearchParams({ format: 'json', origin: '*', ...params });
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (r.ok) return r.json();
    await sleep(1500 * (i + 1));
  }
  throw new Error('API failed for ' + params.gsrsearch);
}

async function candidates(q) {
  const j = await api({ action: 'query', generator: 'search', gsrsearch: `${q} filetype:bitmap`, gsrnamespace: 6, gsrlimit: 30, prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: WIDTH });
  const pages = Object.values((j.query && j.query.pages) || {});
  return pages.map((p) => {
    const ii = p.imageinfo && p.imageinfo[0]; if (!ii) return null;
    const m = ii.extmetadata || {};
    const license = (m.LicenseShortName && m.LicenseShortName.value) || '';
    const restrictions = (m.Restrictions && m.Restrictions.value) || '';
    const assessments = ((m.Assessments && m.Assessments.value) || '').toLowerCase();
    const year = +(((m.DateTimeOriginal && m.DateTimeOriginal.value) || '').match(/\b(19|20)\d\d\b/) || [0])[0];
    const quality = /featured/.test(assessments) ? 3 : /quality/.test(assessments) ? 2 : /valued/.test(assessments) ? 1 : 0;
    return { title: p.title, width: ii.width, height: ii.height, mime: ii.mime, thumb: ii.thumburl, page: ii.descriptionurl, license, author: ((m.Artist && m.Artist.value) || '').replace(/<[^>]+>/g, '').trim(), restrictions, quality, year, credit: ((m.Credit && m.Credit.value) || '').replace(/<[^>]+>/g, '').trim() };
  }).filter(Boolean);
}

function pick(list) {
  return list
    .filter((c) => c.mime === 'image/jpeg' && c.width >= 1600 && c.width / c.height >= 1.3 && c.width / c.height <= 2.1)
    .filter((c) => OK_LICENSE.test(c.license) && !/trademarked|personality/i.test(c.restrictions) && !BAD_TITLE.test(c.title))
    .filter((c) => !c.year || c.year >= 2008)
    .sort((a, b) => (b.quality - a.quality) || (b.year - a.year) || (b.width - a.width))[0];
}

async function download(url, file) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error('download ' + r.status);
  await pipeline(Readable.fromWeb(r.body), createWriteStream(file));
}

async function exists(p) { try { await access(p); return true; } catch { return false; } }

await mkdir('img', { recursive: true });
let credits = {};
try { credits = JSON.parse(await readFile('img/credits.json', 'utf8')); } catch { /* first run */ }

for (const id of ids) {
  const file = `img/${id}.jpg`;
  if (!force && (await exists(file)) && credits[id]) { console.log(`= ${id} (kept)`); continue; }
  let chosen = null, usedQuery = '';
  const tiers = ['incategory:Featured_pictures_on_Wikimedia_Commons', 'incategory:Quality_images', ''];
  outer: for (const tier of tiers) {
    for (const q of QUERIES[id] || []) {
      try { chosen = pick(await candidates(`${q} ${tier}`.trim())); } catch (e) { console.warn(`  ! ${id}: ${e.message}`); }
      if (chosen) { usedQuery = q; break outer; }
      await sleep(250);
    }
  }
  if (!chosen) { console.warn(`x ${id}: no suitable photo found`); continue; }
  try {
    await download(chosen.thumb, file);
    credits[id] = { title: chosen.title.replace(/^File:/, ''), author: chosen.author || 'Unknown', license: chosen.license, page: chosen.page, query: usedQuery };
    console.log(`+ ${id}: ${credits[id].title} · ${credits[id].license} · ${chosen.author}`);
  } catch (e) { console.warn(`x ${id}: ${e.message}`); }
  await sleep(400);
}

await writeFile('img/credits.json', JSON.stringify(credits, null, 2));
await writeFile('img/CREDITS.md', '# Photo credits\n\nAll photos from Wikimedia Commons under the licence shown. Thank you to the photographers.\n\n' +
  Object.entries(credits).map(([id, c]) => `- **${id}** — [${c.title}](${c.page}) by ${c.author} · ${c.license}`).join('\n') + '\n');
await writeFile('photos.js', '/* Generated by tools/fetch-photos.mjs — do not edit by hand. Credits in img/CREDITS.md */\nwindow.PHOTOS = ' + JSON.stringify(Object.fromEntries(Object.entries(credits).map(([id, c]) => [id, { src: `img/${id}.jpg`, author: c.author, license: c.license, page: c.page }])), null, 1) + ';\n');
console.log(`done: ${Object.keys(credits).length} photos`);
