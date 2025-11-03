import fs from 'node:fs';
import xlsx from 'xlsx';

const src = 'data/foerderungen.xlsx';
const out = 'docs/rechner/data/data.json';

if (!fs.existsSync(src)) {
  console.error('❌ Excel non trouvé :', src);
  process.exit(1);
}

const wb = xlsx.readFile(src);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(ws, { defval: '' });

function splitList(v) { return String(v||'').split(';').map(s=>s.trim()).filter(Boolean); }

const programs = rows.map(r => ({
  id: r.id, gebiet: r.gebiet, land: r.land, programm: r.programm, status: r.status, typ: r.typ,
  betrag_fix: r.betrag_fix === '' ? null : Number(r.betrag_fix),
  prozentsatz: r.prozentsatz === '' ? null : Number(r.prozentsatz),
  deckel: r.deckel === '' ? null : Number(r.deckel),
  kumuliert_mit: splitList(r.kumuliert_mit),
  bedingungen: splitList(r.bedingungen),
  richtlinie: r.richtlinie || '', antrag: r.antrag || '', stand: r.stand
}));

const obj = { programs, meta: { version: 'v1.0', generated_at: new Date().toISOString() } };
fs.mkdirSync('docs/rechner/data', { recursive: true });
fs.writeFileSync(out, JSON.stringify(obj, null, 2));
console.log('✅ data.json généré =>', out);
