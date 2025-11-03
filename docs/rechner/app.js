async function loadDB() {
  const res = await fetch('data/data.json', { cache: 'no-store' });
  const db = await res.json();
  const stands = db.programs.map(p => p.stand).filter(Boolean).sort().reverse();
  document.querySelector('#stand').textContent =
    `Stand Daten: ${stands[0] || 'n/a'} · Version: ${db.meta?.version || 'v1.0'}`;
  return db;
}

function grantFor(p, preis) {
  let g = 0;
  if (typeof p.betrag_fix === 'number') g += p.betrag_fix;
  if (typeof p.prozentsatz === 'number') g += Math.round(preis * p.prozentsatz / 100);
  if (typeof p.deckel === 'number') g = Math.min(g, p.deckel);
  return g;
}

function toLeasing(netto, monate) {
  if (!monate) return null;
  const rate = Math.ceil((netto * 1.05) / Number(monate)); // simple approx.
  return { rate, monate: Number(monate) };
}

function scoreLabel(netto, brutto) {
  return netto <= 0 ? '✅ 0 € Anzahlung realistisch'
       : netto < Math.max(300, brutto * 0.15) ? '🟨 Fast 0 € – kleiner Eigenanteil'
       : '🟥 Eigenanteil erforderlich';
}

function render(list) {
  const box = document.querySelector('#kombinationen');
  if (!list.length) {
    box.innerHTML = `<p class="small muted">Keine passenden Programme gefunden.</p>`;
    return;
  }
  box.innerHTML = list.slice(0, 8).map(c => `
    <article class="card">
      <h3>${c.gebiet} · ${c.programm}</h3>
      <ul class="small" style="padding-left:18px">
        <li><b>Typ:</b> ${c.typ.toUpperCase()} • <b>Status:</b> ${c.status}</li>
        <li><b>Förderung gesamt:</b> ~${c.foerderSumme.toFixed(0)} €</li>
        <li><b>Netto (Kauf):</b> ~${c.netto.toFixed(0)} €</li>
        ${c.leasing ? `<li><b>Leasing:</b> ~${c.leasing.rate} €/Monat (${c.leasing.monate}M)</li>` : ''}
        <li><a href="${c.richtlinie}" target="_blank" rel="noopener">Richtlinie</a> ·
            <a href="${c.antrag}" target="_blank" rel="noopener">Antrag</a></li>
      </ul>
    </article>
  `).join('');
}

async function main() {
  const db = await loadDB();
  const form = document.querySelector('#form');
  const result = document.querySelector('#result');
  const scoreEl = document.querySelector('#score');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const land = document.querySelector('#land').value;
    const preis = Number(document.querySelector('#preis').value || 0);
    const thg = document.querySelector('#thg').value === 'ja';
    const leasingMon = document.querySelector('#leasing').value;

    const progs = db.programs.filter(p => (p.land || '').toUpperCase() === land.toUpperCase());

    const rows = progs.map(p => {
      let foerder = grantFor(p, preis);
      if (thg) foerder += 80; // placeholder THG
      const netto = Math.max(preis - foerder, 0);
      return {
        ...p,
        foerderSumme: foerder,
        netto,
        leasing: leasingMon ? toLeasing(netto, leasingMon) : null
      };
    }).sort((a, b) => a.netto - b.netto);

    scoreEl.textContent = scoreLabel(rows[0]?.netto ?? preis, preis);
    render(rows);
    result.hidden = false;
  });
}
main();
