// scripts/xlsx_to_json.mjs
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

// Feuille prioritaire : "Foerderungen" / "Förderungen" sinon 1ʳᵉ
const pick =
  (wb.SheetNames.includes('Foerderungen') && 'Foerderungen') ||
  (wb.SheetNames.includes('Förderungen') && 'Förderungen') ||
  wb.SheetNames[0];

const ws = wb.Sheets[pick];
const rows = xlsx.utils.sheet_to_json(ws, { defval: '' });
console.log('Using sheet:', pick, '| Rows:', rows.length);

// -------- ALIAS de colonnes --------
const norm = s => String(s||'').normalize('NFKD')
  .replace(/[\u0300-\u036f]/g,'')
  .replace(/[^a-zA-Z0-9]+/g,'')
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

function val(row, targetKey) {
  const wanted = ALIASES[targetKey] || [targetKey];
  const set = new Set(wanted.map(norm));
  for (const k of Object.keys(row)) if (set.has(norm(k))) return row[k];
  return row[targetKey];
}

const num = v => {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(',','.'));
  return Number.isFinite(n) ? n : null;
};
const list = v => String(v||'').split(';').map(s=>s.trim()).filter(Boolean);

const programs = rows.map(r => ({
  id: val(r,'id'),
  gebiet: val(r,'gebiet'),
  land: val(r,'land'),
  programm: val(r,'programm'),
  status: val(r,'status'),
  typ: val(r,'typ'),
  betrag_fix: num(val(r,'betrag_fix')),
  prozentsatz: num(val(r,'prozentsatz')),
  deckel: num(val(r,'deckel')),
  kumuliert_mit: list(val(r,'kumuliert_mit')),
  bedingungen: list(val(r,'bedingungen')),
  richtlinie: val(r,'richtlinie') || '',
  antrag: val(r,'antrag') || '',
  stand: val(r,'stand')
}));

if (programs.length < 5) {
  console.error('❌ Trop peu de lignes converties (', programs.length, '). Vérifie la feuille/colonnes.');
  process.exit(1);
}

fs.mkdirSync('docs/rechner/data', { recursive: true });
const payload = { programs, meta:{ version:'v1.0', generated_at:new Date().toISOString() } };
fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));

const size = fs.statSync(OUT).size;
console.log('✅ Écrit:', OUT, '| bytes:', size);
console.log('🧪 IDs (5):', programs.slice(0,5).map(p=>p.id));
