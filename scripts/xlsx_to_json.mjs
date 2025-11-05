// -scripts/xlsx_to_json.mjs
import fs from 'node:fs';
import xlsx from 'xlsx';

const SRC = 'data/foerderungen.xlsx';
const OUT = 'docs/rechner/data/data.json';

console.log('CWD:', process.cwd());
console.log('Excel exists?', fs.existsSync(SRC));

if (!fs.existsSync(SRC)) {
  console.error('❌ Excel introuvable à', SRC);
  process.exit(1);
}

const wb = xlsx.readFile(SRC);
console.log('Sheets:', wb.SheetNames);

// Choix de la feuille
const pick =
  (wb.SheetNames.includes('Foerderungen') && 'Foerderungen') ||
  (wb.SheetNames.includes('Förderungen') && 'Förderungen') ||
  wb.SheetNames[0];

const ws = wb.Sheets[pick];
const rows = xlsx.utils.sheet_to_json(ws, { defval: '' });
console.log('Using sheet:', pick, '| Rows:', rows.length);

// -------- MAPPING souple des colonnes --------
const norm = s => String(s||'').normalize('NFKD')
  .replace(/[\u0300-\u036f]/g,'')     // accents
  .replace(/[^a-zA-Z0-9]+/g,'')       // non-alphanum
  .toLowerCase();

const ALIASES = {
  id: ['id','programm_id','programmnummer'],
  gebiet: ['gebiet','ort','kommune','stadt','gemeinde','kreis','region'],
  land: ['land','bundesland','state'],
  programm: ['programm','programmname','titel','name'],
  status: ['status','programmstatus'],
  typ: ['typ','kategorie','art'],
  betrag_fix: ['betrag_fix','fix','pauschale','einmalbetrag','zuschuss','foerderbetrag'],
  prozentsatz: ['prozentsatz','quote','anteil','foerderquote'],
  deckel: ['deckel','max','obergrenze','maximum','max_betrag','maximalbetrag'],
  kumuliert_mit: ['kumuliert_mit','kombinierbar','kumulierung','kombinationen'],
  bedingungen: ['bedingungen','auflagen','voraussetzungen','kriterien'],
  richtlinie: ['richtlinie','quelle','info','link','url'],
  antrag: ['antrag','antragslink','formular','link_antrag'],
  stand: ['stand','datum','letzteaktualisierung','standdatum','updated']
};

function valueFrom(row, targetKey) {
  const keys = Object.keys(row);
  const wanted = ALIASES[targetKey];
  if (!wanted) return row[targetKey];
  const set = new Set(wanted.map(norm));
  for (const k of keys) if (set.has(norm(k))) return row[k];
  return row[targetKey];
}

function toNumber(v){ const n = Number(String(v).replace(',','.')); return isNaN(n) ? null : n; }
function toList(v){ return String(v||'').split(';').map(s=>s.trim()).filter(Boolean); }

const programs = rows.map(r => ({
  id: valueFrom(r,'id'),
  gebiet: valueFrom(r,'gebiet'),
  land: valueFrom(r,'land'),
  programm: valueFrom(r,'programm'),
  status: valueFrom(r,'status'),
  typ: valueFrom(r,'typ'),
  betrag_fix: toNumber(valueFrom(r,'betrag_fix')),
  prozentsatz: toNumber(valueFrom(r,'prozentsatz')),
  deckel: toNumber(valueFrom(r,'deckel')),
  kumuliert_mit: toList(valueFrom(r,'kumuliert_mit')),
  bedingungen: toList(valueFrom(r,'bedingungen')),
  richtlinie: valueFrom(r,'richtlinie') || '',
  antrag: valueFrom(r,'antrag') || '',
  stand: valueFrom(r,'stand')
}));

fs.mkdirSync('docs/rechner/data', { recursive: true });
fs.writeFileSync(
  OUT,
  JSON.stringify({ programs, meta:{ version:'v1.0', generated_at:new Date().toISOString() } }, null, 2)
);

console.log('✅ Écrit:', OUT);
console.log('🧪 IDs (5):', programs.slice(0,5).map(p=>p.id));
