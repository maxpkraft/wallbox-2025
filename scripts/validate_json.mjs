import fs from 'node:fs';
import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true, strict: false });
const schema = JSON.parse(fs.readFileSync('data/schema.json','utf8'));
const data = JSON.parse(fs.readFileSync('docs/rechner/data/data.json','utf8'));

const validate = ajv.compile(schema);
let errors = 0;
for (const p of data.programs) {
  const ok = validate(p);
  if (!ok) { console.error('❌', validate.errors); errors++; }
}
if (errors) process.exit(1);
console.log('✅ JSON valide selon le schéma');
