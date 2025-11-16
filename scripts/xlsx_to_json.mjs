// scripts/xlsx_to_json.mjs
import fs from "node:fs";
import xlsx from "xlsx";

const DATA_DIR = "data";
const OUT = "docs/rechner/data/data.json";

function die(msg) {
  console.error("❌", msg);
  process.exit(1);
}

console.log("CWD:", process.cwd());

// 1) Vérifier le dossier data/
if (!fs.existsSync(DATA_DIR)) {
  die(`Dossier ${DATA_DIR}/ introuvable. Contenu racine: ${fs.readdirSync(".").join(", ")}`);
}

const files = fs.readdirSync(DATA_DIR);
console.log("Fichiers dans data/:", files);

// 2) Chercher foerderungen.xlsx (insensible à la casse)
const cand = files.find((f) => /^foerderungen\.xlsx$/i.test(f));
if (!cand) {
  die("Aucun fichier 'foerderungen.xlsx' trouvé dans data/ (vérifie nom et extension).");
}

const SRC = `${DATA_DIR}/${cand}`;
console.log("Excel utilisé :", SRC);

// 3) Lire le classeur
const wb = xlsx.readFile(SRC);
if (!wb.SheetNames || !wb.SheetNames.length) {
  die("Excel sans feuilles.");
}
console.log("Feuilles :", wb.SheetNames);

// 4) Choisir une feuille (priorité nom contenant 'Foerder' / 'Förder', sinon 1ʳᵉ)
const needKeys = ["id", "gebiet", "land", "programm", "status", "typ", "stand"];
const norm = (s) =>
  String(s || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase();

const scoreSheet = (name) => {
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[name], { defval: "" });
  const keys = rows.length ? Object.keys(rows[0]).map(norm) : [];
  const cols = needKeys.filter((k) => keys.includes(norm(k))).length;
  const boost = /foerder|förder/i.test(name) ? 1000 : 0;
  return { name, rowsLen: rows.length, cols, rows, score: cols * 100 + rows.length + boost };
};

const pick = wb.SheetNames.map(scoreSheet).sort((a, b) => b.score - a.score)[0];
console.log(`Feuille choisie : ${pick.name} | lignes: ${pick.rowsLen} | colonnes match: ${pick.cols}`);
if (!pick.rowsLen) {
  die("0 lignes lues sur la feuille choisie – vérifie que tes données sont dessus.");
}

// 5) Aliases de colonnes + mapping
const ALIASES = {
  id: ["id", "programm_id", "programmnummer"],
  gebiet: ["gebiet", "ort", "kommune", "stadt", "gemeinde", "kreis", "region"],
  land: ["land", "bundesland", "state"],
  programm: ["programm", "programmname", "titel", "name"],
  status: ["status", "programmstatus"],
  typ: ["typ", "kategorie", "art"],
  betrag_fix: ["betrag_fix", "fix", "pauschale", "einmalbetrag", "zuschuss", "foerderbetrag"],
  prozentsatz: ["prozentsatz", "quote", "anteil", "foerderquote"],
  deckel: ["deckel", "max", "obergrenze", "maximum", "max_betrag", "maximalbetrag"],
  kumuliert_mit: ["kumuliert_mit", "kombinierbar", "kumulierung", "kombinationen"],
  bedingungen: ["bedingungen", "auflagen", "voraussetzungen", "kriterien"],
  richtlinie: ["richtlinie", "quelle", "info", "link", "url"],
  antrag: ["antrag", "antragslink", "formular", "link_antrag"],
  stand: ["stand", "datum", "letzteaktualisierung", "standdatum", "updated"],
};

const val = (row, target) => {
  const wanted = (ALIASES[target] || [target]).map(norm);
  for (const k of Object.keys(row)) if (wanted.includes(norm(k))) return row[k];
  return row[target];
};
const num = (v) => (v === "" || v == null ? null : Number(String(v).replace(",", ".")) || null);
const list = (v) => String(v || "").split(";").map((s) => s.trim()).filter(Boolean);

const programs = pick.rows
  .map((r) => ({
    id: val(r, "id"),
    gebiet: val(r, "gebiet"),
    land: val(r, "land"),
    programm: val(r, "programm"),
    status: val(r, "status"),
    typ: val(r, "typ"),
    betrag_fix: num(val(r, "betrag_fix")),
    prozentsatz: num(val(r, "prozentsatz")),
    deckel: num(val(r, "deckel")),
    kumuliert_mit: list(val(r, "kumuliert_mit")),
    bedingungen: list(val(r, "bedingungen")),
    richtlinie: val(r, "richtlinie") || "",
    antrag: val(r, "antrag") || "",
    stand: val(r, "stand"),
  }))
  .filter((p) => p.id && p.programm && p.land);

console.log("Programmes convertis :", programs.length);

if (programs.length === 0) {
  die("0 programmes valides après mapping (colonnes non reconnues ?).");
}

// 6) Écriture de data.json
fs.mkdirSync("docs/rechner/data", { recursive: true });
const payload = {
  programs,
  meta: { version: "v1.0", generated_at: new Date().toISOString() },
};
fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
console.log("✅ data.json écrit :", OUT);
console.log("🧪 IDs (5):", programs.slice(0, 5).map((p) => p.id));
