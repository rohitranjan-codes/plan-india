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
  bengaluru: ['Bangalore Palace', 'Vidhana Soudha Bangalore', 'Lalbagh Glass House Bangalore'],
  goa: ['Palolem Beach Goa', 'Chapora Fort Goa', 'Basilica of Bom Jesus Goa', 'Goa beach sunset'],
  munnar: ['Munnar tea plantation', 'Munnar tea gardens', 'Munnar hills'],
  kochi: ['Chinese fishing nets Kochi', 'Alleppey houseboat backwaters', 'Fort Kochi'],
  thekkady: ['Periyar Lake Thekkady', 'Periyar Tiger Reserve boat', 'Thekkady'],
  mysuru: ['Mysore Palace illuminated', 'Mysore Palace', 'Chamundi Hills Mysore'],
  coorg: ['Coorg coffee plantation', 'Abbey Falls Coorg', 'Madikeri'],
  hampi: ['Vittala Temple Hampi stone chariot', 'Hampi Virupaksha Temple', 'Hampi boulders'],
  hyderabad: ['Charminar Hyderabad', 'Golconda Fort Hyderabad', 'Chowmahalla Palace'],
  ooty: ['Nilgiri Mountain Railway', 'Ooty tea estate Coonoor', 'Ooty Botanical Garden'],
  kabini: ['Kabini River elephant', 'Nagarhole National Park', 'Kabini backwaters'],
  chikmagalur: ['Mullayanagiri', 'Chikmagalur coffee estate', 'Baba Budangiri'],
  gokarna: ['Om Beach Gokarna', 'Kudle Beach Gokarna', 'Gokarna beach'],
  wayanad: ['Edakkal Caves', 'Banasura Sagar Dam', 'Wayanad tea plantation', 'Chembra Peak'],
  varkala: ['Varkala cliff beach', 'Varkala Beach', 'Kovalam lighthouse beach'],
  andaman: ['Radhanagar Beach Havelock', 'Havelock Island beach', 'Neil Island Andaman'],
  madurai: ['Meenakshi Amman Temple gopuram', 'Meenakshi Temple Madurai', 'Thirumalai Nayak Palace'],
  badami: ['Badami cave temples', 'Badami Agastya lake', 'Pattadakal temples'],
  pondicherry: ['Pondicherry White Town', 'Promenade Beach Pondicherry', 'Auroville Matrimandir'],
  goldentriangle: ['Taj Mahal sunrise', 'Taj Mahal', 'Amber Fort Jaipur', 'Hawa Mahal'],
  rajasthan: ['Lake Palace Udaipur', 'Mehrangarh Fort Jodhpur blue city', 'City Palace Udaipur'],
  varanasi: ['Varanasi ghats sunrise', 'Dashashwamedh Ghat aarti', 'Varanasi ghats boat'],
  rishikesh: ['Laxman Jhula Rishikesh', 'Rishikesh Ganges', 'Rishikesh rafting'],
  mumbai: ['Gateway of India Mumbai', 'Marine Drive Mumbai night', 'Chhatrapati Shivaji Terminus'],
  delhi: ["Humayun's Tomb", 'Qutub Minar', 'India Gate Delhi'],
  chennai: ['Kapaleeshwarar Temple', 'Mahabalipuram Shore Temple', 'Marina Beach Chennai'],
  kolkata: ['Victoria Memorial Kolkata', 'Howrah Bridge', 'Kolkata Victoria Memorial'],
};

const OK_LICENSE = /^(cc0|cc-by(-sa)?(-[0-9.]+)?|pd|public domain)/i;
const BAD_TITLE = /\b(map|logo|diagram|plan|chart|stamp|coin|banknote|drawing|sketch|painting|poster|flag|coat of arms|panorama|collage|montage)\b|\.svg$|\.png$|\.gif$/i;

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
    return { title: p.title, width: ii.width, height: ii.height, mime: ii.mime, thumb: ii.thumburl, page: ii.descriptionurl, license, author: ((m.Artist && m.Artist.value) || '').replace(/<[^>]+>/g, '').trim(), restrictions, quality: /featured|quality|valued/.test(assessments) ? 1 : 0, credit: ((m.Credit && m.Credit.value) || '').replace(/<[^>]+>/g, '').trim() };
  }).filter(Boolean);
}

function pick(list) {
  return list
    .filter((c) => c.mime === 'image/jpeg' && c.width >= 1200 && c.width / c.height >= 1.25 && c.width / c.height <= 2.2)
    .filter((c) => OK_LICENSE.test(c.license) && !/trademarked|personality/i.test(c.restrictions) && !BAD_TITLE.test(c.title))
    .sort((a, b) => b.quality - a.quality)[0];
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
  for (const q of QUERIES[id] || []) {
    try { chosen = pick(await candidates(q)); } catch (e) { console.warn(`  ! ${id}: ${e.message}`); }
    if (chosen) { usedQuery = q; break; }
    await sleep(300);
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
