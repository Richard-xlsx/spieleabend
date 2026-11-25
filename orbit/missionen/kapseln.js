// Mission „Rettungskapseln“ (Arena, Tippen): Wenn der Alarm losgeht, schnell eine Kapsel antippen. Es gibt immer eine
// zu wenig. Wer keine bekommt, ist raus und löst den nächsten Alarm aus. Dabei darf er täuschen: Ein Testalarm sieht
// fast genauso aus, und wer dabei einsteigt, ist auch raus.
// Damit alle den Alarm gleichzeitig sehen, kündigt der Spielleiter ihn 0,4 s vorher an (Zeit der abgeglichenen Uhr).
// Es zählt der Zeitstempel des Handys, höchstens 1 s vor der Ankunft beim Spielleiter.
(function () {
  const W = typeof window !== "undefined" ? window : globalThis;
  const M = W.ORBIT_MISSIONEN = W.ORBIT_MISSIONEN || {};
  const VORLAUF = 400, FENSTER = 5000, NACHFRIST = 700, TEST = 1600, MAXTEST = 2, AUSLOESER = 9000, AUFLOESUNG = 5000, LAUFZEIT = 1000;

  function runde(d, jetzt, ctx) {
    d.runde += 1; d.schritt = "bereit"; d.signal = null; d.tests = 0;
    d.kapseln = Math.max(1, d.drin.length - 1); d.belegt = {}; d.versuch = {}; d.falle = {}; d.letzteBelegung = 0;
    // Wer den Alarm auslöst: zuerst wer gerade rausgeflogen ist, sonst ein anderer, der raus ist (und da ist)
    const raus = d.tn.filter(p => !d.drin.includes(p) && (!ctx || ctx.aktiv.includes(p)));
    const neu = raus.filter(p => d.raus[p] === d.runde - 1);
    d.ausloeser = (neu.length ? neu : raus)[0] || null;
    d.bis = jetzt + (d.ausloeser ? AUSLOESER : 2500 + Math.round((ctx ? ctx.rng() : 0.5) * 4000));
    d.botPlan = {};
  }
  function alarm(d, art, jetzt) {
    const ab = jetzt + VORLAUF;
    if (art === "echt") { d.signal = { art, ab }; d.schritt = "alarm"; d.bis = ab + FENSTER; }
    else { d.signal = { art, ab, bis: ab + TEST }; d.tests += 1; }
    d.botPlan = {};
  }
  function aufloesen(d) {
    const ab = d.signal ? d.signal.ab : 0, raus = [];
    for (const p of d.drin) if (!Object.values(d.belegt).some(x => x.pid === p) || d.falle[p]) raus.push(p);
    for (const p of raus) d.raus[p] = d.runde;
    d.drin = d.drin.filter(p => !raus.includes(p));
    const zeit = {};
    for (const k in d.belegt) zeit[d.belegt[k].pid] = Math.round(d.belegt[k].t - ab);
    d.verlauf.push({ runde: d.runde, raus, zeit, falle: Object.keys(d.falle), kapseln: d.kapseln });
  }
  // Eine Kapsel gehört dem frühesten Zeitstempel. Wer verdrängt wird, darf eine andere antippen.
  function belegen(d, pid, k, t) {
    const alt = d.belegt[k];
    if (alt && alt.t <= t) return "Schon besetzt! Schnell eine andere!";
    for (const x in d.belegt) if (d.belegt[x].pid === pid) { if (d.belegt[x].t <= t) return true; delete d.belegt[x]; }
    d.belegt[k] = { pid, t };
    return true;
  }

  M.kapseln = {
    id: "kapseln", name: "Rettungskapseln", art: "Arena", ab: 3, eingabe: "Tippen", besser: "hoch", einheit: "Runden",
    kurz: "Beim Alarm schnell in eine Kapsel. Es gibt immer eine zu wenig.",
    anleitung: [
      "Wenn der <b>rote Alarm</b> losgeht, tippe schnell auf eine freie Kapsel. Es gibt immer <b>eine zu wenig</b>.",
      "Wer keine Kapsel bekommt, ist raus und <b>löst den nächsten Alarm aus</b>.",
      "Der Auslöser darf täuschen: Beim gelben <b>Testalarm</b> nicht einsteigen, sonst bist du auch raus!",
      "Es zählt, wie viele Runden du durchhältst."
    ],
    neu(tn) {
      return { tn, runde: 0, schritt: "warten", bis: 0, drin: tn.slice(), raus: {}, dabei: {}, signal: null, tests: 0, kapseln: 0,
        belegt: {}, versuch: {}, falle: {}, ausloeser: null, verlauf: [], botPlan: {}, fertig: false };
    },
    start(d, jetzt, ctx) { for (const p of ctx.aktiv) d.dabei[p] = true; runde(d, jetzt, ctx); },
    aktion(d, pid, m, jetzt) {
      if (m.a === "alarm") {
        if (pid !== d.ausloeser || d.schritt !== "bereit") return "Du löst gerade keinen Alarm aus.";
        if (d.signal && jetzt < d.signal.bis) return "Warte, bis der Testalarm vorbei ist.";
        if (m.art === "test") { if (d.tests >= MAXTEST) return "Keine Testalarme mehr."; alarm(d, "test", jetzt); }
        else alarm(d, "echt", jetzt);
        return true;
      }
      if (m.a !== "kapsel") return "?";
      if (!d.drin.includes(pid)) return "Du bist schon raus.";
      if (d.falle[pid]) return "Du bist beim Testalarm eingestiegen.";
      const z = typeof m.z === "number" && isFinite(m.z) ? m.z : jetzt;
      const t = Math.min(jetzt, Math.max(z, jetzt - LAUFZEIT));
      d.dabei[pid] = true;
      if (d.schritt === "bereit") {
        const s = d.signal;
        if (s && s.art === "test" && t >= s.ab && t < s.bis + 300) { d.falle[pid] = true; return true; }
        return "Noch kein Alarm!";
      }
      if (d.schritt !== "alarm") return "Gerade nicht.";
      if (t < d.signal.ab) return "Zu früh!";
      const k = m.k | 0;
      if (k < 0 || k >= d.kapseln) return "?";
      const r = belegen(d, pid, k, t);
      if (r === true) d.letzteBelegung = jetzt;
      return r;
    },
    takt(d, jetzt, ctx) {
      if (d.schritt === "bereit") {
        if (d.signal && d.signal.art === "test" && jetzt >= d.signal.bis + 300) { d.signal = null; return true; }
        if (jetzt >= d.bis && !(d.signal && d.signal.art === "test")) { alarm(d, "echt", jetzt); return true; }
        return false;
      }
      if (d.schritt === "alarm") {
        const voll = Object.keys(d.belegt).length >= d.kapseln, fertig = d.drin.filter(p => ctx.aktiv.includes(p)).every(p => d.falle[p] || Object.values(d.belegt).some(x => x.pid === p));
        if (jetzt >= d.bis || ((voll || fertig) && jetzt >= Math.max(d.letzteBelegung, d.signal.ab) + NACHFRIST)) {
          aufloesen(d); d.schritt = "aufloesung"; d.bis = jetzt + AUFLOESUNG; return true;
        }
        return false;
      }
      if (d.schritt === "aufloesung" && jetzt >= d.bis) {
        if (d.drin.length <= 1) d.fertig = true; else runde(d, jetzt, ctx);
        return true;
      }
      return false;
    },
    wertung(d) {
      return Object.fromEntries(d.tn.map(p => [p, !d.dabei[p] ? null : d.raus[p] !== undefined ? d.raus[p] - 1 : d.runde]));
    },
    // Wann der automatische Alarm kommt, weiß nur der Spielleiter; der Plan der Bots ist auch geheim
    sicht(d) {
      const v = Object.assign({}, d);
      delete v.botPlan;
      if (d.schritt === "bereit" && !d.ausloeser) v.bis = 0;
      return v;
    },
    // Bots reagieren nach 0,3 bis 0,9 s und fallen manchmal auf den Testalarm herein. Als Auslöser täuschen sie gern.
    bot(d, pid, rng, jetzt) {
      const plan = d.botPlan;
      if (d.schritt === "bereit" && pid === d.ausloeser) {
        if (d.signal && jetzt < d.signal.bis + 300) return null;
        if (plan[pid] === undefined) plan[pid] = jetzt + 1500 + rng() * 3500;
        if (jetzt < plan[pid]) return null;
        delete plan[pid];
        return { t: "b", a: "alarm", art: d.tests < MAXTEST && rng() < 0.4 ? "test" : "echt" };
      }
      if (!d.drin.includes(pid) || d.falle[pid] || !d.signal || jetzt < d.signal.ab) return null;
      if (d.signal.art === "test") {
        if (plan[pid] === undefined) plan[pid] = rng() < 0.22 ? d.signal.ab + 300 + rng() * 500 : Infinity;
        return jetzt >= plan[pid] ? { t: "b", a: "kapsel", k: 0, z: plan[pid] } : null;
      }
      if (d.schritt !== "alarm" || Object.values(d.belegt).some(x => x.pid === pid)) return null;
      if (plan[pid] === undefined || plan[pid] < d.signal.ab) plan[pid] = d.signal.ab + 300 + rng() * 600;
      if (jetzt < plan[pid]) return null;
      const frei = Array.from({ length: d.kapseln }, (_, i) => i).filter(i => !d.belegt[i]);
      if (!frei.length) return null;
      const z = plan[pid]; plan[pid] = jetzt + 250;   // falls verdrängt: kurz danach die nächste
      return { t: "b", a: "kapsel", k: frei[Math.floor(rng() * frei.length)], z };
    }
  };

  // ---------- Anzeige auf dem Handy ----------
  if (typeof document === "undefined") return;
  const U = W.ORBIT_UI = W.ORBIT_UI || {};
  let getippt = null;   // { runde, k } sofort zeigen, bevor der Spielleiter antwortet
  let gesummt = 0;      // Alarm, für den das Handy schon vibriert hat

  const kapselSvg = `<svg viewBox="0 0 60 60" aria-hidden="true"><ellipse cx="30" cy="32" rx="22" ry="24" fill="#C9D1E0" stroke="#060A1C" stroke-width="2.5"/><circle cx="30" cy="28" r="11" fill="#0A1030" stroke="#060A1C" stroke-width="2"/><path d="M24 24q3-4 8-4" stroke="#FFFFFF" stroke-opacity=".5" stroke-width="2" fill="none"/><path d="M12 46h36" stroke="#9AA7D1" stroke-width="3"/></svg>`;

  U.kapseln = {
    html(d, c) {
      if (getippt && getippt.runde !== d.runde) getippt = null;
      const punkte = `<div class="helmreihe kapselcrew">${d.tn.map(p => `<span class="${d.drin.includes(p) ? "" : "blass"}" title="${c.esc(c.name(p))}">${c.helm(p)}</span>`).join("")}</div>`;
      const kopf = `<div class="missionskopf"><span class="etikett">Runde ${d.runde} · ${d.drin.length} an Bord</span>${d.schritt === "aufloesung" && !d.fertig ? c.uhr(d.bis) : ""}</div>`;
      if (d.schritt === "aufloesung" || d.fertig) {
        const v = d.verlauf[d.verlauf.length - 1];
        if (!v) return kopf;
        const zeilen = Object.keys(v.zeit).sort((a, b) => v.zeit[a] - v.zeit[b]).map(p => `<li class="${v.raus.includes(p) ? "gestoert" : ""}"><span class="fnr">${(v.zeit[p] / 1000).toFixed(2).replace(".", ",")}</span><span class="wer">${c.helm(p)}<small>${c.esc(c.name(p))}</small></span><span class="was">${v.raus.includes(p) ? "Testalarm" : "gerettet"}</span></li>`).join("");
        const ohne = v.raus.filter(p => v.zeit[p] === undefined);
        const namen = v.raus.map(p => p === c.PID ? "Du" : c.esc(c.name(p)));
        const satz = !namen.length ? "Alle gerettet!" : namen.length === 1 ? `${namen[0]} ${namen[0] === "Du" ? "bist" : "ist"} raus.` : `${namen.slice(0, -1).join(", ")} und ${namen[namen.length - 1]} sind raus.`;
        return kopf + `<p class="mitte gross"><b>${satz}</b></p>
          <ol class="aufloesung">${zeilen}${ohne.map(p => `<li class="gestoert"><span class="fnr">–</span><span class="wer">${c.helm(p)}<small>${c.esc(c.name(p))}</small></span><span class="was">${v.falle.includes(p) ? "beim Testalarm eingestiegen" : "keine Kapsel"}</span></li>`).join("")}</ol>
          ${d.fertig ? "" : `<p class="leise mitte klein">${d.drin.length > 1 ? `Nächste Runde mit ${d.drin.length - 1} ${d.drin.length - 1 === 1 ? "Kapsel" : "Kapseln"}.` : ""}</p>`}${punkte}`;
      }
      const ich = c.PID, drin = d.drin.includes(ich), sig = d.signal;
      const meins = Object.keys(d.belegt).find(k => d.belegt[k].pid === ich);
      const kapseln = Array.from({ length: d.kapseln }, (_, k) => {
        const b = d.belegt[k], mein = b ? b.pid === ich : getippt && getippt.k === k && !b;
        return `<button class="kapsel ${b ? "besetzt" : ""} ${mein ? "mein" : ""}" data-kapsel="${k}" ${!drin || meins || d.falle[ich] ? "disabled" : ""} aria-label="Kapsel ${k + 1}${b ? ", besetzt von " + c.esc(c.name(b.pid)) : ""}">${kapselSvg}${b ? `<span class="insasse">${c.helm(b.pid)}</span>` : ""}</button>`;
      }).join("");
      const alarmAttr = sig ? `data-ab="${sig.ab}" data-testende="${sig.bis || 0}" data-art="${sig.art}"` : "";
      let unten = "";
      if (ich === d.ausloeser && d.schritt === "bereit") {
        unten = `<div class="ausloeser"><p class="mitte"><b>Du löst den Alarm aus.</b> Täusche die anderen mit einem Testalarm!</p>
          <div class="zweier"><button class="knopf alarmknopf" data-alarm="echt">Alarm!</button><button class="knopf testknopf" data-alarm="test" ${d.tests >= MAXTEST || (sig && sig.art === "test") ? "disabled" : ""}>Testalarm (${MAXTEST - d.tests})</button></div>
          <p class="leise klein mitte">Sonst geht der Alarm in ${c.uhr(d.bis)} s von selbst los.</p></div>`;
      } else if (!drin) unten = `<p class="leise mitte">Du bist raus${d.ausloeser ? ` und schaust zu, wie ${c.esc(c.name(d.ausloeser))} den Alarm auslöst` : ""}.</p>`;
      else if (d.falle[ich]) unten = `<p class="mitte gross"><b>Das war nur ein Testalarm!</b> Du bist eingestiegen und raus.</p>`;
      else if (meins) unten = `<p class="mitte gross"><b>Gerettet!</b> Du sitzt in Kapsel ${+meins + 1}.</p>`;
      else unten = `<p class="leise mitte">${d.ausloeser ? `${c.esc(c.name(d.ausloeser))} löst den Alarm aus.` : "Der Alarm kann jeden Moment losgehen."} Nur beim <b>roten</b> Alarm einsteigen!</p>`;
      return kopf + `<div class="sirene ${d.schritt}" id="sirene" ${alarmAttr}><span class="sirenentext">Warten auf Alarm …</span></div>
        <div class="kapseln n${d.kapseln}">${kapseln}</div>${unten}${punkte}`;
    },
    binden(c) {
      document.querySelectorAll("[data-kapsel]").forEach(b => b.addEventListener("pointerdown", e => {
        e.preventDefault();
        if (b.disabled) return;
        const d = c.S.mission.d;
        getippt = { runde: d.runde, k: +b.dataset.kapsel };
        b.classList.add("mein");
        c.tun({ t: "b", a: "kapsel", k: getippt.k, z: c.jetzt() });
      }));
      document.querySelectorAll("[data-alarm]").forEach(b => b.onclick = () => c.tun({ t: "b", a: "alarm", art: b.dataset.alarm }));
    },
    // Der Alarm erscheint auf allen Handys zur selben Zeit (abgeglichene Uhr)
    bewegen(d, c) {
      const el = document.getElementById("sirene");
      if (!el) return;
      const jetzt = c.jetzt(), ab = +el.dataset.ab || 0, bis = +el.dataset.testende || 0, art = el.dataset.art;
      const zustand = !ab || jetzt < ab ? "ruhe" : art === "test" ? (jetzt < bis ? "test" : "ruhe") : "echt";
      if (el.dataset.zustand === zustand) return;
      el.dataset.zustand = zustand;
      el.querySelector(".sirenentext").textContent = zustand === "echt" ? "ALARM! Rein in eine Kapsel!" : zustand === "test" ? "TESTALARM – nicht einsteigen" : "Warten auf Alarm …";
      const feld = el.closest(".missionsfeld");
      if (feld) { feld.classList.toggle("alarm-echt", zustand === "echt"); feld.classList.toggle("alarm-test", zustand === "test"); }
      // Beim Test öffnen sich die Kapseln genauso, nur Farbe und Text verraten den Unterschied
      document.querySelectorAll(".kapsel").forEach(k => k.classList.toggle("offen", zustand !== "ruhe"));
      if (zustand !== "ruhe" && gesummt !== ab && navigator.vibrate) { gesummt = ab; try { navigator.vibrate([120, 60, 120]); } catch (e) {} }
    }
  };
})();
