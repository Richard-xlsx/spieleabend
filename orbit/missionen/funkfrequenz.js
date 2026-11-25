// Mission „Funkfrequenz“: Jeder wählt geheim eine Frequenz von 1 bis 15. Wer allein auf der höchsten Frequenz sendet,
// wird gehört und bekommt so viele Punkte, wie die Frequenz hoch ist. Drei Durchgänge.
(function () {
  const W = typeof window !== "undefined" ? window : globalThis;
  const M = W.ORBIT_MISSIONEN = W.ORBIT_MISSIONEN || {};
  const DG = 3, WAHL = 15000, AUFLOESUNG = 7000, MAXF = 15;

  function naechster(d, jetzt) { d.dg += 1; d.schritt = "wahl"; d.bis = jetzt + WAHL; d.wahl = {}; }
  function aufloesen(d) {
    const zahl = {};
    for (const p in d.wahl) zahl[d.wahl[p]] = (zahl[d.wahl[p]] || 0) + 1;
    const allein = Object.keys(zahl).filter(f => zahl[f] === 1).map(Number);
    const f = allein.length ? Math.max(...allein) : 0;
    const sieger = f ? Object.keys(d.wahl).find(p => d.wahl[p] === f) : null;
    if (sieger) d.punkte[sieger] += f;
    d.verlauf.push({ dg: d.dg, wahl: Object.assign({}, d.wahl), sieger, f });
  }

  M.funkfrequenz = {
    id: "funkfrequenz", name: "Funkfrequenz", art: "geheim", ab: 3, eingabe: "Tippen", besser: "hoch", einheit: "Punkte",
    kurz: "Wer allein auf der höchsten Frequenz sendet, wird gehört.",
    anleitung: [
      "Jeder wählt geheim eine Frequenz von <b>1 bis 15</b>.",
      "Wer <b>allein</b> auf der höchsten Frequenz sendet, wird gehört und bekommt so viele Punkte, wie die Frequenz hoch ist.",
      "Senden mehrere auf derselben Frequenz, stören sie sich gegenseitig und gehen leer aus.",
      `${DG} Durchgänge mit je ${WAHL / 1000} Sekunden. Die meisten Punkte gewinnen.`
    ],
    neu(tn) { return { tn, dg: 0, schritt: "warten", bis: 0, wahl: {}, dabei: {}, verlauf: [], punkte: Object.fromEntries(tn.map(p => [p, 0])), fertig: false }; },
    start(d, jetzt) { naechster(d, jetzt); },
    aktion(d, pid, m) {
      if (m.a !== "frequenz") return "?";
      if (d.schritt !== "wahl") return "Gerade wird nicht gesendet.";
      const f = m.f | 0;
      if (f < 1 || f > MAXF) return "?";
      d.wahl[pid] = f; d.dabei[pid] = true;
      return true;
    },
    takt(d, jetzt, ctx) {
      if (d.schritt === "wahl" && (jetzt >= d.bis || (ctx.aktiv.length && ctx.aktiv.every(p => d.wahl[p])))) {
        aufloesen(d); d.schritt = "aufloesung"; d.bis = jetzt + AUFLOESUNG; return true;
      }
      if (d.schritt === "aufloesung" && jetzt >= d.bis) {
        if (d.dg >= DG) d.fertig = true; else naechster(d, jetzt);
        return true;
      }
      return false;
    },
    wertung(d) { return Object.fromEntries(d.tn.map(p => [p, d.dabei[p] ? d.punkte[p] : null])); },
    // Während der Wahl sieht jeder nur die eigene Frequenz und wer schon gesendet hat
    sicht(d, pid) {
      if (d.schritt !== "wahl") return d;
      return Object.assign({}, d, { gesendet: Object.keys(d.wahl), wahl: d.wahl[pid] ? { [pid]: d.wahl[pid] } : {} });
    },
    // Bots senden nach ein paar Sekunden, eher hoch, aber nicht immer 15
    bot(d, pid, rng) {
      if (d.schritt !== "wahl" || d.wahl[pid] || rng() > 0.08) return null;
      return { t: "b", a: "frequenz", f: Math.max(1, Math.min(MAXF, Math.ceil(MAXF * Math.pow(rng(), 0.55)))) };
    }
  };

  // ---------- Anzeige auf dem Handy ----------
  if (typeof document === "undefined") return;
  const U = W.ORBIT_UI = W.ORBIT_UI || {};
  let gewaehlt = null, gewaehltDg = 0;   // sofort anzeigen, bevor der Spielleiter antwortet

  U.funkfrequenz = {
    html(d, c) {
      const punkte = `<div class="punkteleiste">${d.tn.map(p => `<span class="${p === c.PID ? "ich" : ""}">${c.helm(p)}<b>${d.punkte[p]}</b></span>`).join("")}</div>`;
      if (d.schritt === "wahl") {
        if (gewaehltDg !== d.dg) { gewaehlt = null; gewaehltDg = d.dg; }
        const mein = d.wahl[c.PID] || gewaehlt;
        const knoepfe = Array.from({ length: MAXF }, (_, i) => i + 1).map(f =>
          `<button class="frequenz ${mein === f ? "an" : ""}" data-frequenz="${f}" ${c.dabei ? "" : "disabled"} aria-pressed="${mein === f}"><span>${f}</span></button>`).join("");
        const gesendet = d.gesendet || [];
        return `<div class="missionskopf"><span class="etikett">Durchgang ${d.dg} von ${DG}</span>${c.uhr(d.bis)}</div>
          <p class="mitte">${c.dabei ? (mein ? `Du sendest auf <b>${mein}</b>. Du kannst noch wechseln.` : "Wähle deine Frequenz.") : "Du hörst zu."}</p>
          <div class="frequenzen" role="group" aria-label="Frequenz wählen">${knoepfe}</div>
          <p class="leise mitte klein">Gesendet: ${gesendet.length} von ${d.tn.length}</p>
          <div class="helmreihe">${d.tn.map(p => `<span class="${gesendet.includes(p) ? "" : "blass"}">${c.helm(p)}</span>`).join("")}</div>
          ${punkte}`;
      }
      if (d.schritt === "aufloesung" || d.fertig) {
        const v = d.verlauf[d.verlauf.length - 1];
        if (!v) return "";
        const nach = {};
        for (const p in v.wahl) (nach[v.wahl[p]] = nach[v.wahl[p]] || []).push(p);
        const reihen = Object.keys(nach).map(Number).sort((a, b) => b - a).map(f => {
          const leute = nach[f], gestoert = leute.length > 1, sieg = f === v.f;
          return `<li class="${sieg ? "sieg" : gestoert ? "gestoert" : ""}"><span class="fnr">${f}</span><span class="wer">${leute.map(p => c.helm(p) + `<small>${c.esc(c.name(p))}</small>`).join("")}</span><span class="was">${sieg ? `+${f}` : gestoert ? "gestört" : "überhört"}</span></li>`;
        }).join("");
        const still = d.tn.filter(p => !v.wahl[p]);
        return `<div class="missionskopf"><span class="etikett">Durchgang ${v.dg} von ${DG}</span>${d.fertig ? "" : c.uhr(d.bis)}</div>
          <p class="mitte gross">${v.sieger ? `${c.helm(v.sieger)} <b>${v.sieger === c.PID ? "Du wirst" : c.esc(c.name(v.sieger)) + " wird"} gehört!</b>` : "<b>Nur Rauschen.</b> Niemand sendet allein."}</p>
          <ol class="aufloesung">${reihen}</ol>
          ${still.length ? `<p class="leise klein mitte">Nicht gesendet: ${still.map(p => c.esc(c.name(p))).join(", ")}</p>` : ""}
          ${punkte}`;
      }
      return "";
    },
    binden(c) {
      document.querySelectorAll("[data-frequenz]").forEach(b => b.onclick = () => {
        gewaehlt = +b.dataset.frequenz;
        document.querySelectorAll("[data-frequenz]").forEach(x => { x.classList.toggle("an", x === b); x.setAttribute("aria-pressed", x === b); });
        c.tun({ t: "b", a: "frequenz", f: gewaehlt });
      });
    }
  };
})();
