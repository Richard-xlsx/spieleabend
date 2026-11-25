// Mission „Schrotthändler“: Fünf seltene Ersatzteile werden nacheinander versteigert. Jeder bietet geheim aus
// einem festen Budget. Das höchste Gebot bekommt das Teil und zahlt sein Gebot. Bei Gleichstand bekommt keiner das Teil.
(function () {
  const W = typeof window !== "undefined" ? window : globalThis;
  const M = W.ORBIT_MISSIONEN = W.ORBIT_MISSIONEN || {};
  const BUDGET = 30, GEBOT = 15000, AUFLOESUNG = 6000;
  const WERTE = [3, 4, 6, 8, 12];
  const TEILE = [
    { name: "Antriebsdüse", icon: "duese" }, { name: "Solarsegel", icon: "segel" }, { name: "Quantenchip", icon: "chip" },
    { name: "Andockklammer", icon: "klammer" }, { name: "Plasmaspule", icon: "spule" }
  ];

  function naechstes(d, jetzt, ctx) {
    d.nr += 1; d.schritt = "gebot"; d.bis = jetzt + GEBOT; d.gebote = {};
    if (ctx) for (const p of ctx.aktiv) d.dabei[p] = true;
  }
  function aufloesen(d) {
    const t = d.teile[d.nr - 1], gebote = {};
    for (const p of d.tn) gebote[p] = Math.max(0, Math.min(d.gebote[p] || 0, d.guthaben[p]));
    const hoch = Math.max(0, ...Object.values(gebote));
    const oben = hoch > 0 ? d.tn.filter(p => gebote[p] === hoch) : [];
    const sieger = oben.length === 1 ? oben[0] : null;
    if (sieger) { d.guthaben[sieger] -= hoch; d.punkte[sieger] += t.wert; d.besitz[sieger].push(d.nr - 1); }
    d.verlauf.push({ nr: d.nr, gebote, sieger, hoch, gleich: oben.length > 1 ? oben : [] });
  }

  M.schrotthaendler = {
    id: "schrotthaendler", name: "Schrotthändler", art: "geheim", ab: 2, eingabe: "Tippen", besser: "hoch", einheit: "Punkte",
    kurz: "Biete geheim auf seltene Ersatzteile. Bei Gleichstand bekommt keiner das Teil.",
    anleitung: [
      `Der Schrotthändler versteigert <b>${TEILE.length} seltene Ersatzteile</b> nacheinander. Jedes ist eine bestimmte Zahl Punkte wert.`,
      `Jeder hat <b>${BUDGET} Credits</b> für alle Teile zusammen und bietet geheim.`,
      "Das höchste Gebot bekommt das Teil und zahlt sein Gebot. Bei <b>Gleichstand</b> bekommt keiner das Teil, und keiner zahlt.",
      "Übrige Credits sind am Ende nichts wert. Die meisten Punkte gewinnen."
    ],
    neu(tn, rng) {
      const werte = WERTE.slice();
      for (let i = werte.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [werte[i], werte[j]] = [werte[j], werte[i]]; }
      return {
        tn, nr: 0, schritt: "warten", bis: 0, gebote: {}, dabei: {}, verlauf: [],
        teile: TEILE.map((t, i) => Object.assign({ wert: werte[i] }, t)),
        guthaben: Object.fromEntries(tn.map(p => [p, BUDGET])), punkte: Object.fromEntries(tn.map(p => [p, 0])),
        besitz: Object.fromEntries(tn.map(p => [p, []])), fertig: false
      };
    },
    start(d, jetzt, ctx) { naechstes(d, jetzt, ctx); },
    aktion(d, pid, m) {
      if (m.a !== "gebot") return "?";
      if (d.schritt !== "gebot") return "Gerade wird nicht geboten.";
      if (!d.tn.includes(pid)) return "?";
      const g = m.g | 0;
      if (g < 0 || g > d.guthaben[pid]) return `Du hast nur ${d.guthaben[pid]} Credits.`;
      d.gebote[pid] = g; d.dabei[pid] = true;
      return true;
    },
    takt(d, jetzt, ctx) {
      if (d.schritt === "gebot" && (jetzt >= d.bis || (ctx.aktiv.length && ctx.aktiv.every(p => d.gebote[p] !== undefined)))) {
        aufloesen(d); d.schritt = "aufloesung"; d.bis = jetzt + AUFLOESUNG; return true;
      }
      if (d.schritt === "aufloesung" && jetzt >= d.bis) {
        if (d.nr >= d.teile.length) d.fertig = true; else naechstes(d, jetzt, ctx);
        return true;
      }
      return false;
    },
    wertung(d) { return Object.fromEntries(d.tn.map(p => [p, d.dabei[p] ? d.punkte[p] : null])); },
    // Beim Bieten sieht jeder nur das eigene Gebot und wer schon geboten hat
    sicht(d, pid) {
      if (d.schritt !== "gebot") return d;
      return Object.assign({}, d, { geboten: Object.keys(d.gebote), gebote: d.gebote[pid] !== undefined ? { [pid]: d.gebote[pid] } : {} });
    },
    // Bots bieten ungefähr nach dem Anteil des Teils am restlichen Wert, mit etwas Zufall
    bot(d, pid, rng) {
      if (d.schritt !== "gebot" || d.gebote[pid] !== undefined || rng() > 0.1) return null;
      const rest = d.teile.slice(d.nr - 1).reduce((s, t) => s + t.wert, 0), t = d.teile[d.nr - 1];
      const g = d.nr === d.teile.length ? d.guthaben[pid] : Math.round(d.guthaben[pid] * t.wert / rest * (0.6 + rng() * 0.9));
      return { t: "b", a: "gebot", g: Math.max(0, Math.min(d.guthaben[pid], g)) };
    }
  };

  // ---------- Anzeige auf dem Handy ----------
  if (typeof document === "undefined") return;
  const U = W.ORBIT_UI = W.ORBIT_UI || {};
  let entwurf = 0, entwurfNr = 0, gesendet = null;

  const ICONS = {
    duese: `<path d="M22 18h20l6 10v8l-6 10H22z" fill="#9AA7D1"/><path d="M22 18h8v28h-8z" fill="#C9D1E0"/><path d="M48 28l10-4v16l-10-4z" fill="#FF7A2F"/><path d="M58 26l6-2v16l-6-2z" fill="#FFD23F"/>`,
    segel: `<rect x="8" y="16" width="20" height="32" rx="2" fill="#4DA3FF"/><rect x="36" y="16" width="20" height="32" rx="2" fill="#4DA3FF"/><path d="M8 26h20M8 36h20M36 26h20M36 36h20M18 16v32M46 16v32" stroke="#0A1030" stroke-width="1.6"/><path d="M28 32h8" stroke="#C9D1E0" stroke-width="4"/><circle cx="32" cy="32" r="4" fill="#C9D1E0"/>`,
    chip: `<rect x="18" y="18" width="28" height="28" rx="4" fill="#A57BFF"/><rect x="25" y="25" width="14" height="14" rx="2" fill="#0A1030"/><circle cx="32" cy="32" r="3.5" fill="#2EC4B6"/><path d="M24 18v-6M32 18v-6M40 18v-6M24 46v6M32 46v6M40 46v6M18 24h-6M18 32h-6M18 40h-6M46 24h6M46 32h6M46 40h6" stroke="#C9D1E0" stroke-width="2.6" stroke-linecap="round"/>`,
    klammer: `<path d="M14 14h14v10h-6v16h6v10H14z" fill="#FFD23F"/><path d="M50 14H36v10h6v16h-6v10h14z" fill="#FFD23F"/><rect x="26" y="28" width="12" height="8" rx="2" fill="#9AA7D1"/>`,
    spule: `<rect x="14" y="14" width="36" height="6" rx="2" fill="#9AA7D1"/><rect x="14" y="44" width="36" height="6" rx="2" fill="#9AA7D1"/><rect x="24" y="20" width="16" height="24" fill="#26305E"/><path d="M22 23h20M22 28h20M22 33h20M22 38h20" stroke="#FF5C9A" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="32" r="22" fill="none" stroke="#FF5C9A" stroke-opacity=".35" stroke-width="2" stroke-dasharray="3 5"/>`
  };
  const icon = (t, k) => `<svg class="teil ${k || ""}" viewBox="0 0 64 64" aria-hidden="true">${ICONS[t.icon] || ""}</svg>`;

  function leiste(d, c) {
    return `<div class="punkteleiste">${d.tn.map(p => `<span class="${p === c.PID ? "ich" : ""}" title="${c.esc(c.name(p))}">${c.helm(p)}<b>${d.punkte[p]}</b><small class="credits">${d.guthaben[p]} Cr</small></span>`).join("")}</div>`;
  }
  function vorschau(d) {
    return `<ol class="teilereihe">${d.teile.map((t, i) => {
      const v = d.verlauf[i], k = i === d.nr - 1 ? "jetzt" : i < d.nr - 1 ? "vorbei" : "";
      return `<li class="${k}" title="${t.name}">${icon(t)}<b>${t.wert}</b>${v ? `<small>${v.sieger ? "verkauft" : "keiner"}</small>` : ""}</li>`;
    }).join("")}</ol>`;
  }

  U.schrotthaendler = {
    html(d, c) {
      const t = d.teile[d.nr - 1];
      if (!t) return "";
      if (d.schritt === "gebot") {
        if (entwurfNr !== d.nr) { entwurfNr = d.nr; entwurf = 0; gesendet = null; }
        const hab = d.guthaben[c.PID] || 0, mein = d.gebote[c.PID] !== undefined ? d.gebote[c.PID] : gesendet;
        entwurf = Math.min(entwurf, hab);
        const geboten = d.geboten || [];
        const steuer = c.dabei ? `<div class="gebotsfeld">
            <div class="stepper"><button class="rund" data-plus="-5" aria-label="5 weniger">−5</button><button class="rund" data-plus="-1" aria-label="1 weniger">−1</button>
              <output id="entwurf" aria-live="polite">${entwurf}</output>
              <button class="rund" data-plus="1" aria-label="1 mehr">+1</button><button class="rund" data-plus="5" aria-label="5 mehr">+5</button></div>
            <div class="schnell"><button class="chipknopf" data-setz="0">0</button><button class="chipknopf" data-setz="halb">Hälfte</button><button class="chipknopf" data-setz="alles">Alles (${hab})</button></div>
            <button class="knopf" id="bieten">${mein !== null && mein !== undefined ? "Gebot ändern" : "Bieten"}</button>
            <p class="leise klein mitte">${mein !== null && mein !== undefined ? `Dein Gebot: <b>${mein} Credits</b>. Du kannst noch ändern.` : `Du hast ${hab} Credits.`}</p></div>`
          : `<p class="leise mitte">Du schaust zu.</p>`;
        return `<div class="missionskopf"><span class="etikett">Teil ${d.nr} von ${d.teile.length}</span>${c.uhr(d.bis)}</div>
          <div class="auktion">${icon(t, "gross")}<div><h3>${t.name}</h3><p class="wert">${t.wert} Punkte</p></div></div>
          ${steuer}
          <div class="helmreihe">${d.tn.map(p => `<span class="${geboten.includes(p) ? "" : "blass"}">${c.helm(p)}</span>`).join("")}</div>
          ${vorschau(d)}${leiste(d, c)}`;
      }
      const v = d.verlauf[d.verlauf.length - 1];
      if (!v) return "";
      const tv = d.teile[v.nr - 1];
      const reihen = d.tn.slice().sort((a, b) => v.gebote[b] - v.gebote[a]).map(p => {
        const sieg = p === v.sieger, gleich = v.gleich.includes(p);
        return `<li class="${sieg ? "sieg" : gleich ? "gestoert" : ""}"><span class="fnr">${v.gebote[p]}</span><span class="wer">${c.helm(p)}<small>${c.esc(c.name(p))}</small></span><span class="was">${sieg ? `+${tv.wert} P` : gleich ? "Gleichstand" : ""}</span></li>`;
      }).join("");
      return `<div class="missionskopf"><span class="etikett">Teil ${v.nr} von ${d.teile.length}</span>${d.fertig ? "" : c.uhr(d.bis)}</div>
        <div class="auktion">${icon(tv, "gross")}<div><h3>${tv.name}</h3><p class="wert">${tv.wert} Punkte</p></div></div>
        <p class="mitte gross">${v.sieger ? `${c.helm(v.sieger)} <b>${v.sieger === c.PID ? "Du bekommst" : c.esc(c.name(v.sieger)) + " bekommt"} es für ${v.hoch} Credits.</b>`
          : v.gleich.length ? "<b>Gleichstand!</b> Keiner bekommt das Teil." : "<b>Kein Gebot.</b> Der Händler behält das Teil."}</p>
        <ol class="aufloesung gebote">${reihen}</ol>
        ${vorschau(d)}${leiste(d, c)}`;
    },
    binden(c) {
      const S = c.S, d = S.mission && S.mission.d;
      if (!d || d.schritt !== "gebot") return;
      const hab = d.guthaben[c.PID] || 0, out = document.getElementById("entwurf");
      const setz = n => { entwurf = Math.max(0, Math.min(hab, n)); if (out) out.textContent = entwurf; };
      document.querySelectorAll("[data-plus]").forEach(b => b.onclick = () => setz(entwurf + +b.dataset.plus));
      document.querySelectorAll("[data-setz]").forEach(b => b.onclick = () => setz(b.dataset.setz === "alles" ? hab : b.dataset.setz === "halb" ? Math.floor(hab / 2) : 0));
      const k = document.getElementById("bieten");
      if (k) k.onclick = () => { gesendet = entwurf; c.tun({ t: "b", a: "gebot", g: entwurf }); };
    }
  };
})();
