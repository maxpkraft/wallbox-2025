// scripts/validate_json.mjs
import fs from "node:fs";
import Ajv from "ajv/dist/2020.js";     // ⬅️ au lieu de "ajv"

const ajv = new Ajv({ allErrors: true, strict: false });

const schema = JSON.parse(fs.readFileSync("data/schema.json", "utf8"));
const data   = JSON.parse(fs.readFileSync("docs/rechner/data/data.json", "utf8"));

const validate = ajv.compile(schema);
let errors = 0;

for (const p of data.programs) {
  if (!validate(p)) {
    console.error("❌", validate.errors);
    errors++;
  }
}

if (errors) process.exit(1);
console.log("✅ JSON valide selon le schéma 2020-12");
