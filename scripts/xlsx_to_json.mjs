// scripts/xlsx_to_json.mjs
import fs from 'node:fs';
import xlsx from 'xlsx';

const OUT = 'docs/rechner/data/data.json';

function writePlaceholder(reason) {
  fs.mkdirSync('docs/rechner/data', { recursive: true });
  const payload = { programs: [], meta: { version: 'v1.0', generated_at: new Date().toISOString(), note: reason } };
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.warn('⚠️  data.json (placeholder) écrit car:', reason);
}

try {
  // 1) Trouver l'Excel insensible à la casse
  const DIR = 'data';
  if (!fs.existsSync(DIR)) { writePlaceholder('data/ introuvable'); process.exit(0); }
  const cand = fs.readdirSync(DIR).find(f => /^foerderungen\.xlsx$/i.test(f));
  if (!cand) { writePlaceholder('foerderungen.xlsx introuvable'); process.exit(0); }
  const SRC = `${DIR}/${cand}`;
  console.log('Excel:', SRC);

  // 2) Lire le classeur
  const wb = xlsx.readFile(SRC);
  if (!wb.SheetNames?.length) { writePlaceholder('Excel sans feuilles'); process.exit(0); }
  console.log('Sheets:', wb.SheetNames);

  // 3) Choisir la meilleure feuille (nom ~ "Foerderungen" prioritaire, sinon +colonnes / +lignes)
  const needKeys = ['id','gebiet','land','programm','status','typ','stand'];
  const norm = s => String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'').toLowerCase();
  const score = (name) => {
    const rows = xlsx.utils.sheet_to_json(wb.Sheets[name], { defval: '' });
    const keys = rows.length ? Object.keys(rows[0]).map(norm) : [];
    const cols = needKeys.filter(k => keys.includes(norm(k))).length;
    const boost = /foerder|förder/i.test(name) ? 1000 : 0;
    return { name, rowsLen: rows.length, cols, rows, score: cols*100 + rows.length + boost };
  };
  const picked = wb.SheetNames.map(score).sort((a,b)=>b.score-a.score)[0];
  console.log(`Using sheet: ${picked.name} | Rows: ${picked.rowsLen} | ColsMatch: ${picked.cols}`);

  if (!picked.rowsLen) { writePlaceholder('0 lignes lues'); process.exit(0); }

  // 4) Aliases de colonnes + conversion
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
  const val = (row, target) => {
    const wanted = (ALIASES[target] || [target]).map(norm);
    for (const k of Object.keys(row)) if (wanted.includes(norm(k))) return row[k];
    return row[target];
  };
  const num  = v => (v===''||v==null) ? null : (Number(String(v).replace(',','.')) || null);
  const list = v => String(v||'').split(';').map(s=>s.trim()).filter(Boolean);

  const programs = picked.rows.map(r => ({
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

  // 5) Écriture (toujours)
  fs.mkdirSync('docs/rechner/data', { recursive: true });
  const payload = { programs, meta:{ version:'v1.0', generated_at:new Date().toISOString() } };
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log('✅ Écrit:', OUT, '| Programs:', programs.length, '| First IDs:', programs.slice(0,5).map(p=>p.id));
} catch (e) {
  console.error('❌ Exception build JSON:', e?.message || e);
  writePlaceholder('exception build JSON');
}
