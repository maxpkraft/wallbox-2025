// scripts/xlsx_to_json.mjs
import fs from "node:fs";
import xlsx from "xlsx";

const DATA_DIR = "data";
const OUT = "docs/rechner/data/data.json";

console.log("CWD:", process.cwd());

// 1) Que voit le runner ?
console.log("Contenu racine:", fs.readdirSync("."));
if (!fs.existsSync(DATA_DIR)) {
  console.error(`❌ Dossier ${DATA_DIR}/ introuvable`);
  process.exit(1);
}
console.log("Contenu de data/:", fs.readdirSync(DATA_DIR));

// 2) Chercher foerderungen.xlsx (insensible à la casse)
const cand = fs.readdirSync(DATA_DIR).find((f) => /^foerderungen\.xlsx$/i.test(f));
if (!cand) {
  console.error("❌ Aucun fichier 'foerderungen.xlsx' trouvé dans data/ (vérifie nom/branche).");
  process.exit(1);
}
const SRC = `${DATA_DIR}/${cand}`;
console.log("Excel utilisé:", SRC);

// 3) Lire le classeur
const wb = xlsx.readFile(SRC);
if (!wb.SheetNames || !wb.SheetNames.length) {
  console.error("❌ Excel sans feuilles.");
  process.exit(1);
}
console.log("Feuilles trouvées:", wb.SheetNames);

// 4) On prend la première feuille (simple et sûr)
const sheetName = wb.SheetNames[0];
const ws = wb.Sheets[sheetName];
const rows = xlsx.utils.sheet_to_json(ws, { defval: "" });
console.log(`Feuille choisie: ${sheetName} | lignes: ${rows.length}`);

if (!rows.length) {
  console.error("❌ 0 lignes lues sur la feuille choisie.");
  process.exit(1);
}

// 5) Mapping direct colonne->clé (suppose que ton Excel a déjà les bons noms de colonnes)
const programs = rows.map((r) => ({
  id: r.id,
  gebiet: r.gebiet,
  land: r.land,
  programm: r.programm,
  status: r.status,
  typ: r.typ,
  betrag_fix: r.betrag_fix === "" ? null : Number(String(r.betrag_fix).replace(",", ".")),
  prozentsatz: r.prozentsatz === "" ? null : Number(String(r.prozentsatz).replace(",", ".")),
  deckel: r.deckel === "" ? null : Number(String(r.deckel).replace(",", ".")),
  kumuliert_mit: String(r.kumuliert_mit || "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean),
  bedingungen: String(r.bedingungen || "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean),
  richtlinie: r.richtlinie || "",
  antrag: r.antrag || "",
  stand: r.stand,
}));

console.log("Programmes convertis:", programs.length);

fs.mkdirSync("docs/rechner/data", { recursive: true });
const payload = {
  programs,
  meta: { version: "v1.0", generated_at: new Date().toISOString() },
};
fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
console.log("✅ data.json écrit:", OUT);
console.log("🧪 IDs (5):", programs.slice(0, 5).map((p) => p.id));
