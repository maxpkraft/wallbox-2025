/* -------- Normalisation Länder : NRW/RLP/NDS/BAY + noms complets -------- */
const LAND_MAP = {
  // Baden-Württemberg
  "BW": "BW",
  "BADENWUERTTEMBERG": "BW",
  "BADENWURTTEMBERG": "BW",
  "BADEN-WUERTTEMBERG": "BW",
  "BADEN-WURTTEMBERG": "BW",
  "BADENWURTTEMBERGBW": "BW",

  // Bayern
  "BY": "BY",
  "BAY": "BY",
  "BAYERN": "BY",
  "BAVARIA": "BY",

  // Berlin
  "BE": "BE",
  "BERLIN": "BE",

  // Brandenburg
  "BB": "BB",
  "BRANDENBURG": "BB",

  // Bremen
  "HB": "HB",
  "BREMEN": "HB",

  // Hamburg
  "HH": "HH",
  "HAMBURG": "HH",

  // Hessen
  "HE": "HE",
  "HESSEN": "HE",

  // Mecklenburg-Vorpommern
  "MV": "MV",
  "MECKLENBURGVORPOMMERN": "MV",
  "MECKLENBURG-VORPOMMERN": "MV",

  // Niedersachsen
  "NI": "NI",
  "NDS": "NI",
  "NIEDERSACHSEN": "NI",

  // Nordrhein-Westfalen
  "NW": "NW",
  "NRW": "NW",
  "NORDRHEINWESTFALEN": "NW",
  "NORDRHEIN-WESTFALEN": "NW",

  // Rheinland-Pfalz
  "RP": "RP",
  "RLP": "RP",
  "RHEINLANDPFALZ": "RP",
  "RHEINLAND-PFALZ": "RP",

  // Saarland
  "SL": "SL",
  "SAARLAND": "SL",

  // Sachsen
  "SN": "SN",
  "SACHSEN": "SN",

  // Sachsen-Anhalt
  "ST": "ST",
  "SACHSENANHALT": "ST",
  "SACHSEN-ANHALT": "ST",

  // Schleswig-Holstein
  "SH": "SH",
  "SCHLESWIGHOLSTEIN": "SH",
  "SCHLESWIG-HOLSTEIN": "SH",

  // Thüringen
  "TH": "TH",
  "THUERINGEN": "TH",
  "THURINGEN": "TH",
  "THÜRINGEN": "TH"
};

const normLand = (s) => {
  if (!s) return "";
  // 1) enlever accents, passer en majuscules
  let raw = String(s)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // accents
    .toUpperCase();
  // 2) supprimer tout ce qui n'est pas lettre/chiffre (espaces, tirets, parenthèses, etc.)
  raw = raw.replace(/[^A-Z0-9]/g, "");
  // 3) mapper vers le code canonique si connu
  return LAND_MAP[raw] || raw;
};

/* -------- Data loading -------- */
async function loadData() {
  const res = await fetch("data/data.json?v=" + Date.now(), { cache: "no-store" });
  const db = await res.json();
  const stands = db.programs.map((p) => p.stand).filter(Boolean).sort().reverse();
  document.querySelector("#stand").textContent =
    `Stand Daten: ${stands[0] || "n/a"} · Version: ${db.meta?.version || "v1.0"}`;
  return db;
}

/* -------- Calculs -------- */
function calcGrant(p, preis) {
  let g = 0;
  if (typeof p.betrag_fix === "number") g += p.betrag_fix;
  if (typeof p.prozentsatz === "number") g += Math.round(preis * p.prozentsatz / 100);
  if (typeof p.deckel === "number") g = Math.min(g, p.deckel);
  return g;
}

function toLeasing(netto, monate) {
  if (!monate) return null;
  const rate = Math.ceil((netto * 1.05) / Number(monate)); // approx simple
  return { rate, monate: Number(monate) };
}

function scoreLabel(netto, brutto) {
  return netto <= 0
    ? "✅ 0 € Anzahlung realistisch"
    : netto < Math.max(300, brutto * 0.15)
    ? "🟨 Fast 0 € – kleiner Eigenanteil"
    : "🟥 Eigenanteil erforderlich";
}

/* -------- Rendu -------- */
function render(list) {
  const box = document.querySelector("#kombinationen");
  if (!list.length) {
    box.innerHTML = `<p class="small muted">Keine passenden Programme gefunden. 
    Tipp: NRW/RLP/NDS/BAY oder Landesname ausgeschrieben.</p>`;
    return;
  }
  box.innerHTML = list
    .slice(0, 8)
    .map(
      (c) => `
    <article class="card">
      <h3>${c.gebiet} · ${c.programm}</h3>
      <ul class="small" style="padding-left:18px">
        <li><b>Typ:</b> ${c.typ.toUpperCase()} • <b>Status:</b> ${c.status}</li>
        <li><b>Förderung gesamt:</b> ~${c.foerderSumme.toFixed(0)} €</li>
        <li><b>Netto (Kauf):</b> ~${c.netto.toFixed(0)} €</li>
        ${c.leasing ? `<li><b>Leasing:</b> ~${c.leasing.rate} €/Monat (${c.leasing.monate}M)</li>` : ""}
        <li><a href="${c.richtlinie}" target="_blank" rel="noopener">Richtlinie</a> ·
            <a href="${c.antrag}" target="_blank" rel="noopener">Antrag</a></li>
      </ul>
    </article>
  `
    )
    .join("");
}

/* -------- Main -------- */
async function main() {
  const db = await loadData();
  const form = document.querySelector("#form");
  const result = document.querySelector("#result");
  const scoreEl = document.querySelector("#score");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const landNorm = normLand(document.querySelector("#land").value);
    const preis = Number(document.querySelector("#preis").value || 0);
    const thg = document.querySelector("#thg").value === "ja";
    const leasingMon = document.querySelector("#leasing").value;

    // filtrage avec normalisation des deux côtés
    const progs = db.programs.filter((p) => normLand(p.land) === landNorm);

    const rows = progs
      .map((p) => {
        let foerder = calcGrant(p, preis);
        if (thg) foerder += 80; // placeholder THG
        const netto = Math.max(preis - foerder, 0);
        return {
          ...p,
          foerderSumme: foerder,
          netto,
          leasing: leasingMon ? toLeasing(netto, leasingMon) : null
        };
      })
      .sort((a, b) => a.netto - b.netto);

    scoreEl.textContent = scoreLabel(rows[0]?.netto ?? preis, preis);
    render(rows);
    result.hidden = false;
  });
}

main();
