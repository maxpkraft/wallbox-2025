// scripts/xlsx_to_json.mjs
import fs from 'node:fs';
import xlsx from 'xlsx';

const SRC = 'data/foerderungen.xlsx';
const OUT = 'docs/rechner/data/data.json';

const needKeys = ['id','gebiet','land','programm','status','typ','stand'];

const norm = s => String(s||'').normalize('NFKD')
  .replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'').toLowerCase();

if (!fs.existsSync(SRC)) { console.error('❌ Excel introuvable à', SRC); process.exit(1); }

const wb = xlsx.readFile(SRC);
console.log('Sheets:', wb.SheetNames);

// Heuristique: score chaque feuille selon le nb de lignes non vides et la présence des colonnes utiles
function scoreSheet(name){
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[name], { defval: '' });
  if (!rows.length) return { name, rows: 0, cols: 0, rowsData: [] };
  const keys = Object.keys(rows[0]).map(norm);
  const cols = needKeys.filter(k => keys.includes(norm(k))).length;
  return { name, rows: rows.length, cols, rowsData: rows };
}

let candidates = wb.SheetNames.map(scoreSheet);
// boost si le nom ressemble à "Foerderungen/ Förd…"
candidates = candidates.sort((a,b)=>{
  const aBoost = /foerder|förder/i.test(a.name) ? 1000 : 0;
  const bBoost = /foerder|förder/i.test(b.name) ? 1000 : 0;
  return (b.cols*100 + b.rows + bBoost) - (a.cols*100 + a.rows + aBoost);
});

const pick = candidates[0];
console.log(`Using sheet: ${pick.name} | Rows: ${pick.rows} | ColsMatch: ${pick.cols}`);

if (pick.rows < 5 || pick.cols < 4) {
  console.error('❌ Trop peu de données ou colonnes manquantes sur la meilleure feuille. Vérifie l’Excel.');
  process.exit(1);
}

// Aliases souples
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
const keySetCache = {};
function val(row, targetKey) {
  const wanted = ALIASES[targetKey] || [targetKey];
  const set = keySetCache[targetKey] ||= new Set(wanted.map(norm));
  for (const k of Object.keys(row)) if (set.has(norm(k))) return row[k];
  return row[targetKey];
}
const num = v => (v===''||v==null) ? null : (Number(String(v).replace(',','.')) || null);
const list = v => String(v||'').split(';').map(s=>s.trim()).filter(Boolean);

const programs = pick.rowsData.map(r => ({
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
})).filter(p => p.id && p.programm && p.land);

if (programs.length < 5) { console.error('❌ Seulement', programs.length, 'lignes valides.'); process.exit(1); }

fs.mkdirSync('docs/rechner/data', { recursive: true });
const payload = { programs, meta:{ version:'v1.0', generated_at:new Date().toISOString() } };
fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));

console.log('✅ Écrit:', OUT, '| Programs:', programs.length);
console.log('🧪 First IDs:', programs.slice(0,5).map(p=>p.id));
