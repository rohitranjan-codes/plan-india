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
  thekkady: ['Periyar Lake', 'Periyar Tiger Reserve', 'Thekkady lake', 'Periyar National Park boat'],
  mysuru: ['Mysore Palace night', 'Mysore Palace', 'Amba Vilas Palace'],
  coorg: ['Coorg', 'Kodagu coffee plantation', 'Madikeri Raja Seat', 'Abbey Falls'],
  hampi: ['Vittala Temple Hampi stone chariot', 'Hampi Virupaksha Temple', 'Hampi boulders'],
  hyderabad: ['Charminar', 'Golconda Fort', 'Chowmahalla Palace', 'Qutb Shahi tombs'],
  ooty: ['Nilgiri Mountain Railway', 'Ooty lake', 'Coonoor tea', 'Doddabetta', 'Ooty Botanical Garden'],
  kabini: ['Kabini elephant', 'Nagarhole elephant', 'Kabini reservoir', 'Nagarhole tiger', 'Nagarhole National Park'],
  chikmagalur: ['Mullayanagiri', 'Chikmagalur', 'Chikkamagaluru coffee', 'Baba Budan Giri', 'Western Ghats Karnataka'],
  gokarna: ['Om Beach', 'Kudle Beach', 'Gokarna Karnataka', 'Gokarna beach sunset'],
  wayanad: ['Edakkal Caves', 'Banasura Sagar Dam', 'Wayanad tea plantation', 'Chembra Peak'],
  varkala: ['Varkala cliff', 'Varkala beach', 'Papanasam beach Varkala', 'Kovalam lighthouse'],
  andaman: ['Radhanagar Beach', 'Havelock Island beach', 'Neil Island', 'Andaman beach', 'Port Blair'],
  madurai: ['Meenakshi Amman Temple gopuram', 'Meenakshi Temple Madurai', 'Thirumalai Nayakkar Mahal', 'Madurai temple'],
  badami: ['Badami cave temples', 'Badami Agastya lake', 'Pattadakal temples'],
  pondicherry: ['Matrimandir Auroville', 'Promenade Beach Pondicherry', 'Puducherry French Quarter', 'Pondicherry rock beach'],
  agra: ['Taj Mahal'], jaipur: ['Amber Fort', 'Hawa Mahal'], jodhpur: ['Mehrangarh Fort'], udaipur: ['Lake Pichola Udaipur'], jaisalmer: ['Jaisalmer Fort'], pushkar: ['Pushkar Lake'], ranthambore: ['Ranthambore tiger'], amritsar: ['Golden Temple Amritsar'], shimla: ['Shimla Ridge'], manali: ['Manali valley'], dharamshala: ['McLeod Ganj'], leh: ['Pangong Lake'], corbett: ['Corbett National Park'], khajuraho: ['Khajuraho temple'], bandhavgarh: ['Bandhavgarh tiger'], kanha: ['Kanha National Park'], aurangabad: ['Kailasa Temple Ellora'], kutch: ['Rann of Kutch'], darjeeling: ['Darjeeling tea garden'], gangtok: ['Gangtok'], kaziranga: ['Kaziranga rhino'], shillong: ['Living root bridge Meghalaya'], puri: ['Konark Sun Temple'], thanjavur: ['Brihadeeswarar Temple'], kodaikanal: ['Kodaikanal Lake'],
  varanasi: ['Varanasi ghats', 'Ganges Varanasi boats', 'Dashashwamedh Ghat', 'Varanasi river'],
  rishikesh: ['Lakshman Jhula', 'Ram Jhula', 'Rishikesh Ganga ghat', 'Triveni Ghat Rishikesh'],
  mumbai: ['Gateway of India', 'Marine Drive Mumbai', 'Chhatrapati Shivaji Terminus', 'Taj Mahal Palace Hotel Mumbai'],
  delhi: ['Humayun Tomb', 'Qutb Minar', 'India Gate Delhi', 'Lotus Temple', 'Red Fort Delhi'],
  chennai: ['Kapaleeshwarar Temple', 'Mahabalipuram Shore Temple', 'Marina Beach Chennai'],
  kolkata: ['Victoria Memorial Kolkata', 'Howrah Bridge', 'Kolkata Victoria Memorial'],
};


/* Wikipedia articles whose lead image represents the place. First usable one wins. */
const ARTICLES = {
  bengaluru: ['Vidhana Soudha', 'Bangalore Palace', 'Lal Bagh', 'Bangalore'],
  goa: ['Palolem Beach', 'Chapora Fort', 'Baga Beach', 'Goa'],
  munnar: ['Munnar', 'Eravikulam National Park', 'Anamudi'],
  kochi: ['Chinese fishing nets', 'Fort Kochi', 'Kerala backwaters', 'Alappuzha'],
  thekkady: ['Periyar National Park', 'Thekkady', 'Periyar Lake'],
  mysuru: ['Mysore Palace', 'Mysore'],
  coorg: ['Kodagu district', 'Abbey Falls', 'Madikeri', "Raja's Seat"],
  hampi: ['Hampi', 'Vittala Temple', 'Virupaksha Temple, Hampi'],
  hyderabad: ['Charminar', 'Golconda Fort', 'Chowmahalla Palace', 'Hyderabad'],
  ooty: ['Nilgiri Mountain Railway', 'Ooty', 'Doddabetta', 'Coonoor'],
  kabini: ['Nagarhole National Park', 'Kabini River', 'Kabini Reservoir'],
  chikmagalur: ['Mullayanagiri', 'Baba Budangiri', 'Hebbe Falls', 'Kemmangundi', 'Kudremukh', 'Kudremukh National Park', 'Bhadra Wildlife Sanctuary'],
  gokarna: ['Om Beach', 'Kudle Beach', 'Gokarna, Karnataka', 'Mahabaleshwar Temple, Gokarna', 'Murudeshwar', 'Mirjan Fort', 'Yana, India'],
  wayanad: ['Edakkal Caves', 'Banasura Sagar Dam', 'Wayanad district', 'Chembra Peak'],
  varkala: ['Varkala Beach', 'Varkala', 'Kovalam'],
  andaman: ['Radhanagar Beach', 'Havelock Island', 'Neil Island', 'Andaman Islands'],
  madurai: ['Meenakshi Temple', 'Madurai', 'Thirumalai Nayakkar Mahal'],
  badami: ['Badami cave temples', 'Badami', 'Pattadakal', 'Aihole'],
  pondicherry: ['Matrimandir', 'Promenade Beach', 'Pondicherry', 'Auroville'],
  agra: ['Taj Mahal', 'Agra Fort', 'Mehtab Bagh'],
  jaipur: ['Amber Fort', 'Hawa Mahal', 'City Palace, Jaipur', 'Jal Mahal'],
  jodhpur: ['Mehrangarh', 'Jodhpur', 'Umaid Bhawan Palace'],
  udaipur: ['Lake Palace', 'City Palace, Udaipur', 'Lake Pichola', 'Udaipur'],
  jaisalmer: ['Jaisalmer Fort', 'Jaisalmer', 'Thar Desert'],
  pushkar: ['Pushkar Lake', 'Pushkar Fair', 'Pushkar'],
  ranthambore: ['Ranthambore National Park', 'Ranthambore Fort'],
  amritsar: ['Golden Temple', 'Harmandir Sahib', 'Amritsar'],
  shimla: ['Kalka–Shimla railway', 'Shimla', 'The Ridge, Shimla', 'Viceregal Lodge'],
  manali: ['Manali', 'Solang Valley', 'Rohtang Pass', 'Hidimba Devi Temple'],
  dharamshala: ['McLeod Ganj', 'Dharamshala', 'Triund', 'Dhauladhar'],
  leh: ['Thikse Monastery', 'Shanti Stupa', 'Leh Palace', 'Hemis Monastery', 'Diskit Monastery', 'Khardung La', 'Pangong Tso', 'Nubra Valley'],
  corbett: ['Jim Corbett National Park', 'Dhikala'],
  khajuraho: ['Khajuraho Group of Monuments', 'Kandariya Mahadeva Temple', 'Khajuraho'],
  bandhavgarh: ['Bandhavgarh National Park', 'Bandhavgarh Fort'],
  kanha: ['Kanha Tiger Reserve', 'Barasingha'],
  aurangabad: ['Kailasa Temple, Ellora', 'Ellora Caves', 'Ajanta Caves'],
  kutch: ['Rann of Kutch', 'Great Rann of Kutch', 'Bhuj'],
  darjeeling: ['Darjeeling', 'Darjeeling Himalayan Railway', 'Tiger Hill, Darjeeling', 'Kangchenjunga'],
  gangtok: ['Gangtok', 'Rumtek Monastery', 'Tsomgo Lake', 'Sikkim'],
  kaziranga: ['Kaziranga National Park', 'Indian rhinoceros'],
  shillong: ['Living root bridge', 'Nohkalikai Falls', 'Shillong', 'Dawki'],
  puri: ['Konark Sun Temple', 'Puri', 'Jagannath Temple, Puri'],
  thanjavur: ['Brihadisvara Temple, Thanjavur', 'Ranganathaswamy Temple, Srirangam', 'Thanjavur'],
  kodaikanal: ['Kodaikanal Lake', 'Kodaikanal', 'Pillar Rocks'],
  varanasi: ['Ghats in Varanasi', 'Varanasi', 'Dashashwamedh Ghat'],
  rishikesh: ['Lakshman Jhula', 'Ram Jhula', 'Rishikesh', 'Triveni Ghat'],
  mumbai: ['Gateway of India', 'Marine Drive, Mumbai', 'Chhatrapati Shivaji Maharaj Terminus', 'Mumbai'],
  delhi: ["Humayun's Tomb", 'Qutb Minar', 'India Gate', 'Lotus Temple', 'Red Fort'],
  chennai: ['Shore Temple', 'Kapaleeshwarar Temple', 'Marina Beach', 'Chennai'],
  kolkata: ['Victoria Memorial, Kolkata', 'Howrah Bridge', 'Kolkata'],
};

const OK_LICENSE = /^(cc0|cc[ -]by([ -]sa)?([ -][0-9.]+)?|pd|public domain)/i;
const BAD_TITLE = /\b(map|logo|diagram|plan|chart|stamp|coin|banknote|drawing|sketch|painting|poster|flag|coat of arms|panorama|collage|montage|interior|inside|hotel|restaurant|cafe|menu|room|bedroom|selfie|portrait|wedding|crowd|people|miniature|model|replica|star trail|satellite|view of earth|iss\d|from orbit|landsat|sentinel|butterfly|moth|bird|egret|flower|hibiscus|seed|bulb|leaf|insect|spider|frog|snake|lizard|fungus|mushroom|macro|closeup|close-up)\b|\b(18|19)\d\d\b|\bca\.|\.svg$|\.png$|\.gif$/i;

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


const WIKI = 'https://en.wikipedia.org/w/api.php';
async function getJson(base, params) {
  const url = base + '?' + new URLSearchParams({ format: 'json', origin: '*', ...params });
  for (let i = 0; i < 3; i++) { const r = await fetch(url, { headers: { 'User-Agent': UA } }); if (r.ok) return r.json(); await sleep(1500 * (i + 1)); }
  throw new Error('request failed ' + url.slice(0, 80));
}
/** Lead image of a Wikipedia article, resolved on Commons with licence + size. null if unusable. */
async function leadImage(article) {
  const j = await getJson(WIKI, { action: 'query', titles: article, prop: 'pageimages', piprop: 'name', redirects: 1 });
  const page = Object.values((j.query && j.query.pages) || {})[0];
  const name = page && page.pageimage; if (!name) return null;
  const c = await getJson(API, { action: 'query', titles: 'File:' + name, prop: 'imageinfo|categories', clshow: '!hidden', cllimit: 30, iiprop: 'url|size|mime|extmetadata', iiurlwidth: WIDTH });
  const p = Object.values((c.query && c.query.pages) || {})[0];
  const ii = p && p.imageinfo && p.imageinfo[0]; if (!ii || p.missing !== undefined) return null;
  const m = ii.extmetadata || {};
  const license = (m.LicenseShortName && m.LicenseShortName.value) || '';
  if (!OK_LICENSE.test(license)) return null;
  if (!/^image\/jpe?g$/.test(ii.mime) || ii.width < 1000 || ii.width / ii.height < 1.0 || BAD_TITLE.test(p.title)) return null;
  const year = +(((m.DateTimeOriginal && m.DateTimeOriginal.value) || '').match(/\b(19|20)\d\d\b/) || [0])[0];
  if (year && year < 2000) return null;
  return { title: p.title, width: ii.width, height: ii.height, mime: ii.mime, thumb: ii.thumburl, page: ii.descriptionurl, license, author: ((m.Artist && m.Artist.value) || '').replace(/<[^>]+>/g, '').trim(), article };
}

async function candidates(q) {
  const j = await api({ action: 'query', generator: 'search', gsrsearch: `${q} filetype:bitmap`, gsrnamespace: 6, gsrlimit: 30, prop: 'imageinfo|categories', clshow: '!hidden', cllimit: 30, iiprop: 'url|size|mime|extmetadata', iiurlwidth: WIDTH });
  const pages = Object.values((j.query && j.query.pages) || {});
  return pages.map((p) => {
    const ii = p.imageinfo && p.imageinfo[0]; if (!ii) return null;
    const m = ii.extmetadata || {};
    const license = (m.LicenseShortName && m.LicenseShortName.value) || '';
    const restrictions = (m.Restrictions && m.Restrictions.value) || '';
    const assessments = ((m.Assessments && m.Assessments.value) || '').toLowerCase();
    const year = +(((m.DateTimeOriginal && m.DateTimeOriginal.value) || '').match(/\b(19|20)\d\d\b/) || [0])[0];
    const quality = /featured/.test(assessments) ? 3 : /quality/.test(assessments) ? 2 : /valued/.test(assessments) ? 1 : 0;
    const cats = (p.categories || []).map((c) => c.title.replace(/^Category:/, '')).join(' | ');
    const desc = ((m.ImageDescription && m.ImageDescription.value) || '').replace(/<[^>]+>/g, '');
    return { cats, desc, title: p.title, width: ii.width, height: ii.height, mime: ii.mime, thumb: ii.thumburl, page: ii.descriptionurl, license, author: ((m.Artist && m.Artist.value) || '').replace(/<[^>]+>/g, '').trim(), restrictions, quality, year, credit: ((m.Credit && m.Credit.value) || '').replace(/<[^>]+>/g, '').trim() };
  }).filter(Boolean);
}

const STOP = new Set(['beach', 'temple', 'fort', 'palace', 'lake', 'hills', 'hill', 'tea', 'estate', 'park', 'national', 'island', 'islands', 'river', 'india', 'karnataka', 'kerala', 'tamil', 'nadu', 'city', 'night', 'sunset', 'sunrise', 'view', 'skyline', 'coffee', 'plantation', 'ghats', 'boats', 'sea', 'palm', 'tower', 'gate', 'caves', 'railway', 'mountain', 'western']);
function relevant(c, q) {
  const hay = `${c.title} ${c.desc} ${c.cats}`.toLowerCase();
  const tokens = q.toLowerCase().replace(/incategory:\S+/g, '').split(/[^a-z]+/).filter((w) => w.length >= 4 && !STOP.has(w));
  return tokens.length > 0 && tokens.some((w) => hay.includes(w));
}
function pick(list, q) {
  return list
    .filter((c) => relevant(c, q))
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
  for (const art of ARTICLES[id] || []) {
    try { chosen = await leadImage(art); } catch (e) { console.warn(`  ! ${id}/${art}: ${e.message}`); }
    if (chosen) { usedQuery = 'wikipedia:' + art; break; }
    await sleep(200);
  }
  const tiers = ['incategory:Featured_pictures_on_Wikimedia_Commons', 'incategory:Quality_images', ''];
  if (!chosen) outer: for (const tier of tiers) {
    for (const q of QUERIES[id] || []) {
      try { chosen = pick(await candidates(`${q} ${tier}`.trim()), q); } catch (e) { console.warn(`  ! ${id}: ${e.message}`); }
      if (chosen) { usedQuery = q; break outer; }
      await sleep(250);
    }
  }
  if (!chosen) { console.warn(`x ${id}: no suitable photo found`); continue; }
  try {
    await download(chosen.thumb, file);
    const author = (chosen.author || 'Unknown').replace(/^this photo was taken by\s*/i, '').split(/[\n.]/)[0].trim().slice(0, 60) || 'Unknown';
    credits[id] = { title: chosen.title.replace(/^File:/, ''), author, license: chosen.license, page: chosen.page, query: usedQuery };
    console.log(`+ ${id}: ${credits[id].title} · ${credits[id].license} · ${chosen.author}`);
  } catch (e) { console.warn(`x ${id}: ${e.message}`); }
  await sleep(400);
}

Object.keys(credits).forEach((k) => { if (!QUERIES[k]) delete credits[k]; });
await writeFile('img/credits.json', JSON.stringify(credits, null, 2));
await writeFile('img/CREDITS.md', '# Photo credits\n\nAll photos from Wikimedia Commons under the licence shown. Thank you to the photographers.\n\n' +
  Object.entries(credits).map(([id, c]) => `- **${id}** — [${c.title}](${c.page}) by ${c.author} · ${c.license}`).join('\n') + '\n');
await writeFile('photos.js', '/* Generated by tools/fetch-photos.mjs — do not edit by hand. Credits in img/CREDITS.md */\nwindow.PHOTOS = ' + JSON.stringify(Object.fromEntries(Object.entries(credits).map(([id, c]) => [id, { src: `img/${id}.jpg`, author: c.author, license: c.license, page: c.page }])), null, 1) + ';\n');
console.log(`done: ${Object.keys(credits).length} photos`);
