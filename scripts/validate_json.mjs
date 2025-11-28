// scripts/validate_json.mjs
import fs from "node:fs";
import path from "node:path";
import Ajv from "ajv/dist/2020.js"; // <- IMPORTANT : version 2020

const SCHEMA_PATH = "data/schema.json";
const DATA_PATH   = "docs/rechner/data/data.json";

// --- Chargement fichiers ---
if (!fs.existsSync(SCHEMA_PATH)) {
  console.error(`❌ Schéma introuvable : ${SCHEMA_PATH}`);
  process.exit(1);
}
if (!fs.existsSync(DATA_PATH)) {
  console.error(`❌ Données introuvables : ${DATA_PATH}`);
  process.exit(1);
}

const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
const data   = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));

// --- Sanity checks haut-niveau ---
if (!data || typeof data !== "object") {
  console.error("❌ Fichier JSON invalide (pas un objet racine).");
  process.exit(1);
}
if (!Array.isArray(data.programs)) {
  console.error("❌ Propriété 'programs' absente ou non-array.");
  process.exit(1);
}

// --- AJV setup ---
const ajv = new Ajv({
  allErrors: true,
  strict: false
});

// Compile une seule fois le schéma "programme"
let validate;
try {
  validate = ajv.compile(schema);
} catch (e) {
  console.error("❌ Erreur de compilation du schéma :", e.message || e);
  process.exit(1);
}

// --- Validation élément par élément ---
let errors = 0;
data.programs.forEach((p, idx) => {
  const ok = validate(p);
  if (!ok) {
    errors++;
    const id = p?.id ?? `index ${idx}`;
    console.error(`\n❌ Programme invalide: ${id}`);
    for (const err of validate.errors) {
      // exemple: instancePath="/land" message="must be equal to one of the allowed values"
      const loc = err.instancePath || "(racine)";
      const msg = err.message || "invalid";
      const more = err.params ? ` | params: ${JSON.stringify(err.params)}` : "";
      console.error(`   → ${loc}: ${msg}${more}`);
    }
  }
});

// --- Bilan ---
const count = data.programs.length;
console.log(`\n📝 Validation terminée. Programmes lus: ${count}`);
if (errors > 0) {
  console.error(`❌ ${errors} programme(s) non conforme(s) au schéma.`);
  process.exit(1);
}

// Optionnel : rappel sur la version/horodatage affichés
const metaInfo = data.meta ? ` | meta.version=${data.meta.version ?? "n/a"} | generated_at=${data.meta.generated_at ?? "n/a"}` : "";
console.log(`✅ JSON valide selon le schéma 2020-12${metaInfo}`);
