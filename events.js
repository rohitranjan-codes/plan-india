/* ------------------------------------------------------------------
   Festival & events calendar for the ticker and plan warnings.
   kind: celebrate | caution | closed
   regions: which TRIP.regions it touches ('all' for national)
   places: destination ids it specifically concerns (optional)
   Dates for 2026–2027; lunar festivals marked approx where the
   official date is announced late. Verify before booking around them.
   ------------------------------------------------------------------ */
window.EVENTS = [
  /* ---- 2026 ---- */
  { start: '2026-10-17', end: '2026-10-21', kind: 'celebrate', regions: ['east'], places: ['kolkata'], name: 'Durga Puja', text: 'Kolkata\'s biggest week: pandals, lights, processions. Book hotels months ahead; streets are jammed.' },
  { start: '2026-10-20', end: '2026-10-20', kind: 'celebrate', regions: ['all'], name: 'Dussehra', text: 'Effigies of Ravana burn at dusk across the north; Mysuru\'s royal procession is the south\'s great spectacle.' },
  { start: '2026-10-11', end: '2026-10-20', kind: 'celebrate', regions: ['south'], places: ['mysuru'], name: 'Mysuru Dasara', text: 'Ten days of illuminated palace, concerts and the elephant procession on the last day. Book early.' },
  { start: '2026-10-25', end: '2026-10-31', kind: 'caution', regions: ['north'], places: ['delhi', 'agra'], name: 'Post-harvest stubble smoke', text: 'Air quality in Delhi and Agra deteriorates sharply from late October. N95 masks, short stays.' },
  { start: '2026-11-01', end: '2026-11-01', kind: 'celebrate', regions: ['south'], places: ['bengaluru', 'mysuru', 'hampi', 'coorg'], name: 'Karnataka Rajyotsava', text: 'State day: flags, cultural shows; some shops close in Karnataka.' },
  { start: '2026-11-03', end: '2026-11-05', kind: 'celebrate', regions: ['south'], places: ['hampi'], name: 'Hampi Utsav', text: 'Dance, music and light shows among the ruins (dates confirmed late — verify).', approx: true },
  { start: '2026-11-08', end: '2026-11-08', kind: 'celebrate', regions: ['all'], name: 'Diwali', text: 'Festival of lights: lamps, sweets, fireworks. Some closures on the day; smoke worsens northern air for a few days.' },
  { start: '2026-11-08', end: '2026-11-15', kind: 'caution', regions: ['north'], places: ['delhi', 'agra', 'jaipur', 'amritsar'], name: 'Post-Diwali smog', text: 'The worst air week of the year in the Indo-Gangetic plain. Keep Delhi nights minimal; hills and the south are clear.' },
  { start: '2026-11-13', end: '2026-11-24', kind: 'celebrate', regions: ['north'], places: ['pushkar'], name: 'Pushkar Camel Fair', text: 'Camel trading, folk music, balloons; peaks at Kartik Purnima. Prices triple; book a year ahead.', approx: true },
  { start: '2026-11-20', end: '2026-11-28', kind: 'celebrate', regions: ['west'], places: ['goa'], name: 'IFFI — International Film Festival of India', text: 'Screenings and open-air events in Panaji for eight days.', approx: true },
  { start: '2026-11-24', end: '2026-11-24', kind: 'celebrate', regions: ['north'], places: ['varanasi'], name: 'Dev Deepawali', text: 'A million lamps on the Varanasi ghats at Kartik Purnima. Extraordinary; hotels sell out.' },
  { start: '2026-11-24', end: '2026-11-24', kind: 'celebrate', regions: ['north'], places: ['amritsar', 'delhi'], name: 'Guru Nanak Jayanti', text: 'Gurdwaras hold langar feasts and processions; the Golden Temple is spectacular and packed.' },
  { start: '2026-11-01', end: '2027-02-28', kind: 'celebrate', regions: ['west'], places: ['kutch'], name: 'Rann Utsav', text: 'Tent-city season at the White Rann; the full-moon nights (Nov 24, Dec 23, Jan 22, Feb 20) are the ones to book.' },
  { start: '2026-12-01', end: '2027-03-31', kind: 'celebrate', regions: ['south'], places: ['kochi'], name: 'Kochi-Muziris Biennale', text: 'India\'s biggest contemporary-art event in Fort Kochi\'s warehouses (biennial — check it is a running year).', approx: true },
  { start: '2026-12-01', end: '2026-12-10', kind: 'celebrate', regions: ['east'], name: 'Hornbill Festival, Nagaland', text: 'Naga tribes gather at Kisama near Kohima; combine with Kaziranga. Permits arranged by tour operators.' },
  { start: '2026-12-15', end: '2027-01-15', kind: 'celebrate', regions: ['south'], places: ['chennai'], name: 'Chennai Music Season', text: 'Hundreds of Carnatic concerts across the city\'s sabhas.' },
  { start: '2026-12-24', end: '2027-01-01', kind: 'caution', regions: ['west', 'south'], places: ['goa', 'gokarna', 'varkala', 'andaman'], name: 'Christmas–New Year peak', text: 'Goa and the beaches hit peak prices and crowds; hotels need booking months ahead.' },
  { start: '2026-12-15', end: '2027-01-31', kind: 'caution', regions: ['north'], places: ['delhi', 'agra', 'amritsar', 'varanasi', 'jaipur'], name: 'Winter fog', text: 'Dense morning fog delays flights and trains across the north; keep buffer time on connections.' },
  /* ---- 2027 ---- */
  { start: '2027-01-14', end: '2027-01-14', kind: 'celebrate', regions: ['all'], name: 'Makar Sankranti / Pongal', text: 'Kite-flying in Gujarat and Rajasthan; four-day Pongal harvest festival in Tamil Nadu.' },
  { start: '2027-01-26', end: '2027-01-26', kind: 'celebrate', regions: ['north'], places: ['delhi'], name: 'Republic Day', text: 'Grand parade on Kartavya Path in Delhi; security tight, central roads closed. Dry day (no alcohol sales).' },
  { start: '2027-01-26', end: '2027-01-26', kind: 'caution', regions: ['all'], name: 'Dry day', text: 'No alcohol sales nationwide on Republic Day.' },
  { start: '2027-02-05', end: '2027-02-14', kind: 'celebrate', regions: ['north'], places: ['jaisalmer'], name: 'Jaisalmer Desert Festival', text: 'Turban-tying, camel polo, folk music on the dunes.', approx: true },
  { start: '2027-02-20', end: '2027-02-26', kind: 'celebrate', regions: ['central'], places: ['khajuraho'], name: 'Khajuraho Dance Festival', text: 'Classical dance in front of the floodlit temples.', approx: true },
  { start: '2027-03-22', end: '2027-03-23', kind: 'celebrate', regions: ['all'], name: 'Holi', text: 'Festival of colours: joyful and chaotic. Wear old clothes, protect cameras; women may prefer hotel-hosted celebrations. Mathura/Vrindavan and Jaipur are the classic places.', approx: true },
  { start: '2027-03-22', end: '2027-03-23', kind: 'caution', regions: ['north'], name: 'Holi disruption', text: 'Shops, transport and monuments run on reduced hours; drunken crowds in some cities on the day. Plan a quiet day.', approx: true },
  { start: '2027-04-01', end: '2027-06-15', kind: 'caution', regions: ['north', 'central', 'west'], places: ['delhi', 'agra', 'jaipur', 'jodhpur', 'jaisalmer', 'khajuraho', 'varanasi', 'kutch'], name: 'Pre-monsoon heat', text: '40 °C+ across the plains and Rajasthan. Hills, Ladakh and the south-west coast are the places to be.' },
  { start: '2027-06-01', end: '2027-09-30', kind: 'caution', regions: ['west', 'south'], places: ['goa', 'gokarna', 'kochi', 'munnar', 'wayanad', 'mumbai'], name: 'South-west monsoon', text: 'Heavy rain on the west coast and the Western Ghats; beaches close, Mumbai floods, hill roads slide.' },
  { start: '2027-07-01', end: '2027-09-30', kind: 'closed', regions: ['north', 'central'], places: ['ranthambore', 'bandhavgarh', 'kanha', 'corbett', 'kabini'], name: 'Tiger reserves closed for monsoon', text: 'Core zones of most tiger reserves close July–September (Corbett\'s Dhikala until mid-November).' },
  { start: '2027-05-01', end: '2027-04-30', kind: 'closed', regions: ['north'], places: ['kaziranga'], name: 'Kaziranga closed May–October', text: 'Floods close the park; open November–April only.' },
  { start: '2027-11-01', end: '2027-04-30', kind: 'closed', regions: ['north'], places: ['leh'], name: 'Ladakh passes closed', text: 'Rohtang, Khardung La and the Manali road close in snow roughly November–May; Leh is reachable by air but bitterly cold.' },
  { start: '2027-07-01', end: '2027-07-31', kind: 'celebrate', regions: ['east'], places: ['puri'], name: 'Rath Yatra, Puri', text: 'A million pilgrims pull the chariots; astonishing but not for the crowd-averse.', approx: true },
  { start: '2027-08-15', end: '2027-08-15', kind: 'caution', regions: ['all'], name: 'Independence Day — dry day', text: 'National holiday; monuments busy, no alcohol sales.' },
  { start: '2027-09-14', end: '2027-09-24', kind: 'celebrate', regions: ['west'], places: ['mumbai'], name: 'Ganesh Chaturthi, Mumbai', text: 'Ten days of processions; the immersion day brings the city to a standstill.', approx: true },
  { start: '2027-08-25', end: '2027-09-05', kind: 'celebrate', regions: ['south'], places: ['kochi', 'munnar', 'thekkady', 'varkala', 'wayanad'], name: 'Onam, Kerala', text: 'Kerala\'s harvest festival: flower carpets, sadya feasts, snake-boat races at Alappuzha.', approx: true },
  { start: '2027-10-02', end: '2027-10-02', kind: 'caution', regions: ['all'], name: 'Gandhi Jayanti — dry day', text: 'National holiday; no alcohol sales.' },
  { start: '2027-10-08', end: '2027-10-17', kind: 'celebrate', regions: ['east'], places: ['kolkata'], name: 'Durga Puja', text: 'Kolkata\'s biggest week; book months ahead.', approx: true },
  { start: '2027-10-28', end: '2027-10-28', kind: 'celebrate', regions: ['all'], name: 'Diwali', text: 'Festival of lights.', approx: true },
  { start: '2027-10-28', end: '2027-11-05', kind: 'caution', regions: ['north'], places: ['delhi', 'agra', 'jaipur', 'amritsar'], name: 'Post-Diwali smog', text: 'Worst air week of the year across the northern plains.', approx: true },
  { start: '2027-11-02', end: '2027-11-13', kind: 'celebrate', regions: ['north'], places: ['pushkar'], name: 'Pushkar Camel Fair', text: 'Peaks at Kartik Purnima.', approx: true },
  { start: '2027-11-13', end: '2027-11-13', kind: 'celebrate', regions: ['north'], places: ['varanasi'], name: 'Dev Deepawali', text: 'A million lamps on the ghats.', approx: true },
  /* ---- recurring closures (any year) ---- */
  { weekly: 5, kind: 'closed', regions: ['north'], places: ['agra'], name: 'Taj Mahal closed on Fridays', text: 'Plan Agra for any other day; Mehtab Bagh stays open.' },
  { weekly: 1, kind: 'closed', regions: ['west'], places: ['aurangabad'], name: 'Ajanta closed on Mondays', text: 'Ellora closes Tuesdays instead.' },
  { weekly: 1, kind: 'closed', regions: ['west'], places: ['mumbai'], name: 'Elephanta Caves closed on Mondays', text: 'Most museums in India also close Mondays.' },
];
