// Mission „Reaktor-Countdown“: Die Energie steigt, solange man am Reaktor bleibt. Man kann jederzeit in die
// Rettungskapsel springen. Wer bei der Explosion noch drin ist, bekommt 0. Wer als Letzter vorher springt, bekommt
// einen Bonus. Drei Durchgänge. Den Zeitpunkt der Explosion kennt nur der Spielleiter; es zählt der Zeitstempel
// des Handys (abgeglichene Uhr), nicht die Ankunft beim Spielleiter.
(function () {
  const W = typeof window !== "undefined" ? window : globalThis;
  const M = W.ORBIT_MISSIONEN = W.ORBIT_MISSIONEN || {};
  const DG = 3, HOCHFAHREN = 3000, NACHLAUF = 1000, AUFLOESUNG = 7000, BONUS = 25;
  const KNALL_MIN = 3000, KNALL_MAX = 18000, LAUFZEIT = 1000;   // so weit darf ein Zeitstempel vor der Ankunft liegen

  // Punkte nach ms am Reaktor: erst langsam, dann immer schneller
  const wert = ms => { const s = Math.max(0, ms) / 1000; return Math.floor(5 * s + 0.4 * s * s); };

  function naechster(d, jetzt, ctx) {
    d.dg += 1; d.schritt = "hochfahren"; d.bis = jetzt + HOCHFAHREN; d.start = d.bis; d.sprung = {};
    d.knall = d.start + Math.round(KNALL_MIN + d.zufall[d.dg - 1] * (KNALL_MAX - KNALL_MIN));
    if (ctx) for (const p of ctx.aktiv) d.dabei[p] = true;
  }
  function aufloesen(d) {
    const raus = Object.keys(d.sprung).filter(p => d.sprung[p].ms < d.knall - d.start);
    const spaet = raus.length ? Math.max(...raus.map(p => d.sprung[p].ms)) : null;
    const letzter = raus.length ? raus.filter(p => d.sprung[p].ms === spaet) : [];
    const ergebnis = {};
    for (const p of d.tn) {
      const s = d.sprung[p];
      ergebnis[p] = s ? { ms: s.ms, wert: s.wert, bonus: letzter.includes(p) ? BONUS : 0 } : { ms: null, wert: 0, bonus: 0 };
      d.punkte[p] += ergebnis[p].wert + ergebnis[p].bonus;
    }
    d.verlauf.push({ dg: d.dg, knall: d.knall - d.start, ergebnis, letzter });
  }

  M.reaktor = {
    id: "reaktor", name: "Reaktor-Countdown", art: "geheim", ab: 2, eingabe: "Tippen", besser: "hoch", einheit: "Punkte",
    kurz: "Bleib am Reaktor, solange du dich traust, und spring rechtzeitig in die Kapsel.",
    anleitung: [
      "Der Reaktor läuft heiß, und deine Punkte steigen, <b>immer schneller</b>.",
      "Tippe auf <b>„Raus!“</b>, um in die Rettungskapsel zu springen. Dann behältst du deine Punkte.",
      "Wer bei der <b>Explosion</b> noch drin ist, bekommt 0. Wann es knallt, weiß niemand.",
      `Wer als <b>Letzter</b> rechtzeitig springt, bekommt ${BONUS} Bonuspunkte. Ob die anderen schon raus sind, siehst du nicht.`,
      `${DG} Durchgänge, die Punkte werden addiert.`
    ],
    wert, BONUS,
    neu(tn, rng) {
      return {
        tn, dg: 0, schritt: "warten", bis: 0, start: 0, knall: 0, sprung: {}, dabei: {}, verlauf: [],
        zufall: Array.from({ length: DG }, () => rng()), punkte: Object.fromEntries(tn.map(p => [p, 0])), fertig: false
      };
    },
    start(d, jetzt, ctx) { naechster(d, jetzt, ctx); },
    aktion(d, pid, m, jetzt) {
      if (m.a !== "raus") return "?";
      if (!d.tn.includes(pid)) return "?";
      if (d.schritt !== "laeuft" && d.schritt !== "knall") return "Der Reaktor läuft gerade nicht.";
      if (d.sprung[pid]) return true;
      // Zeitstempel des Handys, aber höchstens LAUFZEIT vor der Ankunft und nicht in der Zukunft
      const z = typeof m.z === "number" && isFinite(m.z) ? m.z : jetzt;
      const t = Math.min(jetzt, Math.max(z, jetzt - LAUFZEIT));
      if (t < d.start) return "Der Reaktor läuft noch nicht.";
      if (t >= d.knall) return "Zu spät!";
      d.sprung[pid] = { ms: t - d.start, wert: wert(t - d.start) };
      d.dabei[pid] = true;
      return true;
    },
    takt(d, jetzt, ctx) {
      if (d.schritt === "hochfahren" && jetzt >= d.bis) { d.schritt = "laeuft"; d.bis = 0; return true; }
      if (d.schritt === "laeuft") {
        const alleRaus = ctx.aktiv.length && ctx.aktiv.every(p => d.sprung[p]);
        if (jetzt >= d.knall || alleRaus) { d.schritt = "knall"; d.bis = (alleRaus ? jetzt : d.knall) + NACHLAUF; return true; }
      }
      if (d.schritt === "knall" && jetzt >= d.bis) { aufloesen(d); d.schritt = "aufloesung"; d.bis = jetzt + AUFLOESUNG; return true; }
      if (d.schritt === "aufloesung" && jetzt >= d.bis) {
        if (d.dg >= DG) d.fertig = true; else naechster(d, jetzt, ctx);
        return true;
      }
      return false;
    },
    wertung(d) { return Object.fromEntries(d.tn.map(p => [p, d.dabei[p] ? d.punkte[p] : null])); },
    // Bis zur Auflösung kennt niemand den Zeitpunkt der Explosion und die Sprünge der anderen
    sicht(d, pid) {
      const v = Object.assign({}, d);
      delete v.zufall;
      if (d.schritt === "aufloesung" || d.fertig) return v;
      v.sprung = d.sprung[pid] ? { [pid]: d.sprung[pid] } : {};
      delete v.knall;
      return v;
    },
    // Bots springen mit steigender Wahrscheinlichkeit
    bot(d, pid, rng, jetzt) {
      if (d.schritt !== "laeuft" || d.sprung[pid]) return null;
      const s = (jetzt - d.start) / 1000;
      return rng() < 0.006 * s ? { t: "b", a: "raus", z: jetzt } : null;
    }
  };

  // ---------- Anzeige auf dem Handy ----------
  if (typeof document === "undefined") return;
  const U = W.ORBIT_UI = W.ORBIT_UI || {};
  let gesprungen = null;   // { dg, ms } sofort anzeigen, bevor der Spielleiter antwortet

  function reaktorBild(zustand) {
    return `<svg class="reaktor ${zustand}" viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r="92" fill="none" stroke="#2A3568" stroke-width="6"/>
      <circle class="reaktor-ring" cx="100" cy="100" r="78" fill="none" stroke="#FF7A2F" stroke-width="5" stroke-dasharray="14 10"/>
      <path d="M100 22v22M100 156v22M22 100h22M156 100h22" stroke="#9AA7D1" stroke-width="6" stroke-linecap="round"/>
      <circle class="reaktor-glut" cx="100" cy="100" r="50" fill="#FFD23F"/>
      <circle class="reaktor-kern" cx="100" cy="100" r="30" fill="#FFF6D0"/>
      <g class="reaktor-knall"><path d="M100 4l14 50 46-24-24 46 50 14-50 14 24 46-46-24-14 50-14-50-46 24 24-46-50-14 50-14-24-46 46 24z" fill="#FF5C9A"/><circle cx="100" cy="100" r="40" fill="#FFD23F"/></g>
    </svg>`;
  }
  const sek = ms => (ms / 1000).toFixed(1).replace(".", ",");

  U.reaktor = {
    html(d, c) {
      const punkte = `<div class="punkteleiste">${d.tn.map(p => `<span class="${p === c.PID ? "ich" : ""}">${c.helm(p)}<b>${d.punkte[p]}</b></span>`).join("")}</div>`;
      const kopf = (dg, uhr) => `<div class="missionskopf"><span class="etikett">Durchgang ${dg} von ${DG}</span>${uhr || ""}</div>`;
      if (gesprungen && gesprungen.dg !== d.dg) gesprungen = null;
      const mein = d.sprung[c.PID] || gesprungen;
      if (d.schritt === "hochfahren") {
        return kopf(d.dg) + reaktorBild("aus") + `<p class="mitte gross"><b>Reaktor fährt hoch …</b> <span class="uhr" data-bis="${d.bis}"></span></p>
          <p class="leise mitte">${c.dabei ? "Gleich steigen deine Punkte. Spring rechtzeitig raus!" : "Du schaust zu."}</p>${punkte}`;
      }
      if (d.schritt === "laeuft" || d.schritt === "knall") {
        const knall = d.schritt === "knall";
        const zeile = mein ? `<p class="mitte gross">In der Kapsel mit <b>${mein.wert}</b> Punkten.</p><p class="leise mitte">Nach ${sek(mein.ms)} s gesprungen.</p>`
          : knall ? (c.dabei ? `<p class="mitte gross"><b>BUMM!</b></p>` : "") : c.dabei ? `<div class="unten"><button class="knopf raus" id="raus">Raus!</button></div>` : `<p class="leise mitte">Du schaust zu.</p>`;
        return kopf(d.dg) + reaktorBild(knall ? "knall" : mein ? "drinnen" : "heiss") +
          `<p class="reaktorwert mitte" id="reaktorwert" data-start="${d.start}" ${mein || knall ? `data-fest="${mein ? mein.wert : ""}"` : ""}>${mein ? mein.wert : 0}</p>
          ${zeile}${punkte}`;
      }
      const v = d.verlauf[d.verlauf.length - 1];
      if (!v) return "";
      const reihen = d.tn.slice().sort((a, b) => (v.ergebnis[b].ms === null ? -1 : v.ergebnis[b].ms) - (v.ergebnis[a].ms === null ? -1 : v.ergebnis[a].ms)).map(p => {
        const e = v.ergebnis[p], weg = e.ms === null;
        return `<li class="${e.bonus ? "sieg" : weg ? "gestoert" : ""}"><span class="fnr">${weg ? "💥" : e.wert}</span><span class="wer">${c.helm(p)}<small>${c.esc(c.name(p))}</small></span><span class="was">${weg ? "explodiert" : `nach ${sek(e.ms)} s${e.bonus ? ` · Letzter +${e.bonus}` : ""}`}</span></li>`;
      }).join("");
      return kopf(v.dg, d.fertig ? "" : c.uhr(d.bis)) + `<p class="mitte gross"><b>Explosion nach ${sek(v.knall)} s</b> bei ${wert(v.knall)} Punkten.</p>
        <ol class="aufloesung reaktorliste">${reihen}</ol>${punkte}`;
    },
    binden(c) {
      const k = document.getElementById("raus");
      if (k) k.onclick = () => {
        const d = c.S.mission && c.S.mission.d;
        if (!d) return;
        const z = c.jetzt(), ms = Math.max(0, z - d.start);
        gesprungen = { dg: d.dg, ms, wert: wert(ms) };
        c.tun({ t: "b", a: "raus", z });
        c.neu();
      };
    },
    // Der Zähler läuft auf jedem Handy selbst mit der abgeglichenen Uhr
    bewegen(d, c) {
      const el = document.getElementById("reaktorwert");
      if (!el || el.dataset.fest !== undefined) return;
      const w = String(wert(c.jetzt() - +el.dataset.start));
      if (el.textContent !== w) el.textContent = w;
    }
  };
})();
