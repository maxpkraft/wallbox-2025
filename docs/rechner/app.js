/* ============================
   Hilfsfunktionen
   ============================ */

// Comparaison Land avec cas spécial Baden-Württemberg
function landMatches(programLand, selectedLand) {
  const a = String(programLand || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // enlève accents
    .toUpperCase()
    .trim();

  const b = String(selectedLand || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();

  // Tous les Länder "normaux" : comportement standard (égalité simple)
  if (b !== "BW") {
    return a === b;
  }

  // --- Cas spécial Baden-Württemberg ---

  // 1) Si dans le JSON c'est déjà "BW"
  if (a === "BW") return true;

  // 2) Si c'est écrit en toutes lettres (avec ou sans tréma/tiret/espace)
  if (
    a.includes("BADEN") &&
    (a.includes("WUERTTEMBERG") ||
      a.includes("WURTTEMBERG") ||
      a.includes("WURTTEMBERG"))
  ) {
    return true;
  }

  return false;
}

/* ============================
   Chargement des données
   ============================ */

async function loadData() {
  const res = await fetch("data/data.json?v=" + Date.now(), { cache: "no-store" });
  const db = await res.json();

  // Stand-Datum (maximaler Stand in den Programmen)
  const stands = db.programs
    .map((p) => p.stand)
    .filter(Boolean)
    .sort()
    .reverse();

  const standText =
    "Stand Daten: " +
    (stands[0] || "n/a") +
    " · Version: " +
    (db.meta?.version || "v1.0");

  const standEl = document.querySelector("#stand");
  if (standEl) standEl.textContent = standText;

  return db;
}

/* ============================
   Logik de calcul
   ============================ */

function calcGrant(p, preis) {
  let g = 0;

  if (typeof p.betrag_fix === "number") {
    g += p.betrag_fix;
  }
  if (typeof p.prozentsatz === "number") {
    g += Math.round((preis * p.prozentsatz) / 100);
  }
  if (typeof p.deckel === "number") {
    g = Math.min(g, p.deckel);
  }

  return g;
}

function toLeasing(netto, monate) {
  if (!monate) return null;
  const m = Number(monate);
  if (!m || m <= 0) return null;

  // simple approx : 5 % Aufschlag + Verteilung auf Monate
  const rate = Math.ceil((netto * 1.05) / m);
  return { rate, monate: m };
}

function scoreLabel(netto, brutto) {
  if (netto <= 0) {
    return "✅ 0 € Anzahlung realistisch";
  }
  if (netto < Math.max(300, brutto * 0.15)) {
    return "🟨 Fast 0 € – kleiner Eigenanteil";
  }
  return "🟥 Eigenanteil erforderlich";
}

/* ============================
   Rendu des résultats
   ============================ */

function render(list) {
  const box = document.querySelector("#kombinationen");
  if (!box) return;

  if (!list.length) {
    box.innerHTML =
      `<p class="small muted">Keine passenden Programme gefunden.<br>` +
      `Tipp: Prüfe Bundesland-Auswahl und Fördervoraussetzungen.</p>`;
    return;
  }

  box.innerHTML = list
    .slice(0, 8)
    .map((c) => {
      const leasingLine = c.leasing
        ? `<li><b>Leasing:</b> ~${c.leasing.rate} €/Monat (${c.leasing.monate}M)</li>`
        : "";

      return `
        <article class="card">
          <h3>${c.gebiet} · ${c.programm}</h3>
          <ul class="small" style="padding-left:18px">
            <li><b>Typ:</b> ${String(c.typ || "").toUpperCase()} • <b>Status:</b> ${c.status}</li>
            <li><b>Förderung gesamt:</b> ~${c.foerderSumme.toFixed(0)} €</li>
            <li><b>Netto (Kauf):</b> ~${c.netto.toFixed(0)} €</li>
            ${leasingLine}
            <li>
              <a href="${c.richtlinie}" target="_blank" rel="noopener">Richtlinie</a> ·
              <a href="${c.antrag}" target="_blank" rel="noopener">Antrag</a>
            </li>
          </ul>
        </article>
      `;
    })
    .join("");
}

/* ============================
   Main
   ============================ */

async function main() {
  const db = await loadData();

  const form = document.querySelector("#form");
  const result = document.querySelector("#result");
  const scoreEl = document.querySelector("#score");

  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const landValue = document.querySelector("#land")?.value || "";
    const preis = Number(document.querySelector("#preis")?.value || 0);
    const thg = (document.querySelector("#thg")?.value || "") === "ja";
    const leasingMon = document.querySelector("#leasing")?.value || "";

    // Filtrage Land avec cas spécial Baden-Württemberg
    const progs = db.programs.filter((p) => landMatches(p.land, landValue));

    const rows = progs
      .map((p) => {
        let foerder = calcGrant(p, preis);
        if (thg) {
          // Valeur THG approximative – tu peux l'ajuster ou la sortir de la base
          foerder += 80;
        }
        const netto = Math.max(preis - foerder, 0);

        return {
          ...p,
          foerderSumme: foerder,
          netto,
          leasing: leasingMon ? toLeasing(netto, leasingMon) : null,
        };
      })
      .sort((a, b) => a.netto - b.netto);

    if (scoreEl) {
      scoreEl.textContent = scoreLabel(rows[0]?.netto ?? preis, preis);
    }
    if (result) result.hidden = false;

    render(rows);
  });
}

main();
