import fs from 'node:fs';
import xlsx from 'xlsx';

const src = 'data/foerderungen.xlsx';
const out = 'docs/rechner/data/data.json';

console.log('CWD:', process.cwd());
console.log('Excel exists?', fs.existsSync(src));

if (!fs.existsSync(src)) {
  console.error('❌ Excel introuvable à', src);
  process.exit(1);
}

const wb = xlsx.readFile(src);
console.log('Sheets:', wb.SheetNames);

// 👉 essaie "Foerderungen" ou "Förderungen", sinon 1ʳᵉ feuille
const pick = (wb.SheetNames.includes('Foerderungen') && 'Foerderungen')
          || (wb.SheetNames.includes('Förderungen') && 'Förderungen')
          || wb.SheetNames[0];

const ws = wb.Sheets[pick];
const rows = xlsx.utils.sheet_to_json(ws, { defval: '' });
console.log('Using sheet:', pick, '| Rows:', rows.length);

function splitList(v){ return String(v||'').split(';').map(s=>s.trim()).filter(Boolean); }

const programs = rows.map(r => ({
  id: r.id,
  gebiet: r.gebiet,
  land: r.land,
  programm: r.programm,
  status: r.status,
  typ: r.typ,
  betrag_fix: r.betrag_fix === '' ? null : Number(r.betrag_fix),
  prozentsatz: r.prozentsatz === '' ? null : Number(r.prozentsatz),
  deckel: r.deckel === '' ? null : Number(r.deckel),
  kumuliert_mit: splitList(r.kumuliert_mit),
  bedingungen: splitList(r.bedingungen),
  richtlinie: r.richtlinie || '',
  antrag: r.antrag || '',
  stand: r.stand
}));

fs.mkdirSync('docs/rechner/data', { recursive: true });
fs.writeFileSync(out, JSON.stringify({ programs, meta:{ version:'v1.0', generated_at:new Date().toISOString() } }, null, 2));

console.log('✅ Écrit:', out);
console.log('🧪 IDs:', programs.slice(0,5).map(p=>p.id));
