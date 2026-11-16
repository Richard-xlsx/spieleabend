// Gleisgenossen: Startseite, Bedienleiste über der 3D-Welt, Speichern. Schritt 1: ein Handy.
// Die Regeln stehen in logic.js (window.GG), die Welt in welt.js.
import { Welt } from "./welt.js?v=2026-11-16a";

const G = window.GG;
const app = document.getElementById("app"), weltEl = document.getElementById("welt"), hud = document.getElementById("hud");
const params = new URLSearchParams(location.search);
const T = params.get("test") ? "-" + params.get("test") : "";
const SPEICHER = "gg2:stand" + T;
const ls = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const zahl = n => Math.floor(n).toLocaleString("de-DE");
const dauer = s => { s = Math.floor(s); const h = s / 3600 | 0, m = (s % 3600) / 60 | 0; return h ? `${h} Std. ${m} Min.` : `${m} Min.`; };
const strecke = m => m < 1000 ? Math.floor(m) + " m" : (m / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " km";
const vor = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "gerade eben" : m < 60 ? `vor ${m} Min.` : new Date(t).toLocaleString("de-DE", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }); };

let S = null, welt = null, gespeichertUm = null, hinweisTimer = null, proMinute = 0;
const verlauf = [];          // [zeit, verdient] der letzten Minute für „pro Minute“
const ui = { modus: "schauen", teil: "g", panel: null };

let wake = null;
async function wachHalten() { try { if (navigator.wakeLock && !wake) { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => { wake = null; }); } } catch (e) {} }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && S) wachHalten(); });

// ---------- Startseite ----------
const TITELBILD = `<svg class="titelbild" viewBox="0 0 320 150" role="img" aria-label="Ein kleiner Dampfzug fährt auf einem Gleiskreis durch eine grüne Landschaft">
<rect x="2" y="2" width="316" height="146" rx="20" fill="#BFE3F2"/>
<g stroke="#1C1A33" stroke-width="2" stroke-linejoin="round">
<path d="M2 92 L60 74 L120 88 L190 70 L250 86 L318 72 V128 a20 20 0 0 1-20 20 H22 a20 20 0 0 1-20-20z" fill="#9BD45A"/>
<path d="M240 74 l20-34 l20 34z" fill="#8E8B84"/><path d="M253 52 l7-12 l7 12 l-7 4z" fill="#F7F7FA"/>
<path d="M272 78 l22-38 l22 38z" fill="#9C9C8E"/><path d="M286 54 l8-14 l8 14 l-8 4z" fill="#F7F7FA"/>
<path d="M22 84 l8-18 l8 18z M36 88 l7-15 l7 15z" fill="#2F8A4A"/>
</g>
<ellipse cx="160" cy="112" rx="112" ry="26" fill="none" stroke="#B9A68A" stroke-width="14"/>
<ellipse cx="160" cy="112" rx="112" ry="26" fill="none" stroke="#6B4A32" stroke-width="10" stroke-dasharray="2 5"/>
<ellipse cx="160" cy="112" rx="112" ry="26" fill="none" stroke="#8C8F99" stroke-width="2"/>
<g stroke="#1C1A33" stroke-width="2.2" stroke-linejoin="round">
<rect x="86" y="114" width="34" height="18" rx="3" fill="#2F6FDE"/><rect x="86" y="120" width="34" height="5" fill="#F3F0FF"/>
<rect x="124" y="108" width="40" height="18" rx="9" fill="#E2453A"/><rect x="154" y="96" width="22" height="30" rx="3" fill="#E2453A"/>
<rect x="150" y="92" width="30" height="6" rx="2" fill="#1C1A33"/><rect x="130" y="94" width="8" height="15" fill="#1C1A33"/>
<rect x="158" y="102" width="12" height="8" rx="1" fill="#BFE3F2"/>
<circle cx="136" cy="129" r="6" fill="#1C1A33"/><circle cx="152" cy="129" r="6" fill="#1C1A33"/><circle cx="168" cy="129" r="6" fill="#1C1A33"/>
<circle cx="94" cy="133" r="4" fill="#1C1A33"/><circle cx="112" cy="133" r="4" fill="#1C1A33"/>
</g>
<g fill="#FFFFFF" stroke="#1C1A33" stroke-width="2" opacity=".95"><circle cx="134" cy="84" r="8"/><circle cx="122" cy="70" r="10"/><circle cx="104" cy="56" r="12"/></g>
<g stroke="#1C1A33" stroke-width="2"><circle cx="214" cy="40" r="11" fill="#FFD447"/><circle cx="236" cy="22" r="8" fill="#FFD447"/><circle cx="196" cy="20" r="7" fill="#FFD447"/></g>
<text x="214" y="45" text-anchor="middle" font-family="Unbounded,system-ui,sans-serif" font-weight="800" font-size="12" fill="#1C1A33">T</text>
</svg>`;

function startseite() {
  document.documentElement.classList.remove("spiel"); document.body.classList.remove("spiel");
  weltEl.hidden = true; hud.hidden = true; app.hidden = false;
  const g = ls.get(SPEICHER);
  app.innerHTML = `<header class="titel">${TITELBILD}<h1>Gleisgenossen</h1>
      <p class="leise">Ein kleiner Zug fährt im Kreis, und jeder Meter bringt Geld. Kauft Gleise und Land, verbessert den Zug und baut eure Strecke in einer großen Landschaft immer weiter aus.</p></header>
    ${g ? `<div class="karte-box"><h2>Weiterspielen</h2>
      <p class="stand">Gespeichert ${esc(vor(g.um))} · <b>${zahl(g.S.kasse)} T</b> in der Kasse · ${strecke(g.S.meter)} gefahren</p>
      <button class="knopf" id="weiter">Weiterspielen</button></div>` : ""}
    <div class="karte-box"><h2>Neue Welt</h2>
      <p class="leise klein">Ihr startet mit einem Gleiskreis und einer kleinen Dampflok. Speichert über das Menü, um später weiterzuspielen. Wer ohne Speichern schließt, verwirft den Spielstand.</p>
      <button class="knopf ${g ? "zweit" : ""}" id="neu">Neue Welt starten</button></div>
    <p class="leise klein mitte">Zusammen auf mehreren Handys spielen kommt in einem späteren Schritt.</p>
    <a class="link" href="../">Alle Spiele</a>`;
  if (g) document.getElementById("weiter").onclick = () => spielen(g.S, g.um);
  document.getElementById("neu").onclick = () => spielen(G.neu(), null);
}

// ---------- Spiel ----------
function spielen(stand, um) {
  S = stand; gespeichertUm = um; verlauf.length = 0; proMinute = 0;
  Object.assign(ui, { modus: "schauen", teil: "g", panel: null });
  app.hidden = true; weltEl.hidden = false; hud.hidden = false;
  document.documentElement.classList.add("spiel"); document.body.classList.add("spiel");
  if (!welt) {
    welt = new Welt(weltEl);
    welt.onTap = feldGetippt;
    welt.onFolgenAus = () => render();
    welt.vorBild = dt => { if (S && !hud.hidden) G.schritt(S, dt); };
    setInterval(zahlenAuffrischen, 250);
  }
  welt.groesse();
  welt.setzen(S);
  const z = S.zug.seg; welt.blick(z.i % G.B + .5, (z.i / G.B | 0) + .5, 30);
  welt.markieren(null);
  wachHalten();
  render();
}

function tun(m) {
  const r = G.aktion(S, m);
  if (r.fehler) { hinweis(r.fehler); return r; }
  welt.setzen(S);
  render();
  return r;
}

function feldGetippt(i) {
  if (!S) return;
  if (!G.besitzt(S, i)) { ui.panel = { art: "land", p: G.parzelle(i) }; welt.markieren(i); render(); return; }
  if (ui.modus === "bauen") { welt.markieren(i); tun({ typ: "bauen", i, t: ui.teil }); return; }
  if (ui.modus === "abreissen") { welt.markieren(i); tun({ typ: "abreissen", i }); return; }
  ui.panel = { art: "feld", i }; welt.markieren(i); render();
}

function speichern() {
  const alt = ls.get(SPEICHER);
  if (alt && alt.S.seed !== S.seed && !confirm("Es gibt schon einen gespeicherten Spielstand aus einer anderen Welt. Überschreiben?")) return;
  const um = Date.now();
  if (ls.set(SPEICHER, { S, um })) { gespeichertUm = um; hinweis("Gespeichert. Ihr könnt jederzeit weiterspielen."); render(); }
  else hinweis("Speichern hat nicht geklappt (Speicher des Browsers voll oder gesperrt).");
}
function beenden() {
  if (!confirm(gespeichertUm ? "Zur Startseite? Was seit dem letzten Speichern passiert ist, geht verloren." : "Zur Startseite? Diese Welt ist nicht gespeichert und geht verloren.")) return;
  S = null; welt.markieren(null); if (T) window.__gg = { get S() { return S; }, get welt() { return welt; }, ui };
startseite();
}

// ---------- Bedienleiste ----------
function hinweis(t) {
  let el = document.getElementById("toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; document.body.appendChild(el); }
  el.textContent = t; el.hidden = false;
  clearTimeout(hinweisTimer); hinweisTimer = setTimeout(() => { el.hidden = true; }, 2800);
}

const TEIL_BILD = {
  g: `<svg viewBox="0 0 34 34"><rect x="11" y="1" width="12" height="32" fill="#B9A68A"/><g fill="#6B4A32">${[4, 10, 16, 22, 28].map(y => `<rect x="9" y="${y}" width="16" height="2.5"/>`).join("")}</g><path d="M14 1v32M20 1v32" stroke="#C8CBD6" stroke-width="1.6"/></svg>`,
  k: `<svg viewBox="0 0 34 34"><path d="M17 33 A16 16 0 0 1 33 17" fill="none" stroke="#B9A68A" stroke-width="12"/><path d="M14 33 A19 19 0 0 1 33 14 M20 33 A13 13 0 0 1 33 20" fill="none" stroke="#C8CBD6" stroke-width="1.6"/></svg>`,
  x: `<svg viewBox="0 0 34 34"><rect x="11" y="1" width="12" height="32" fill="#B9A68A"/><rect x="1" y="11" width="32" height="12" fill="#B9A68A"/><path d="M14 1v32M20 1v32M1 14h32M1 20h32" stroke="#C8CBD6" stroke-width="1.6"/></svg>`
};

function render() {
  if (!S) return;
  const w = G.werte(S);
  hud.innerHTML = `
    <div class="hud-oben">
      <div class="chip gross"><small>Kasse</small><b id="kasse">${zahl(S.kasse)} T</b></div>
      <div class="chip"><small>pro Minute</small><b id="promin">${zahl(proMinute)} T</b></div>
      <div class="chip"><small>Tempo</small><b id="tempo">${G.kmh(S.zug.v)} km/h</b></div>
      <button class="rund ${welt.folgen ? "an" : ""}" id="folgen" aria-label="Kamera folgt dem Zug" title="Zug folgen">🎥</button>
      <button class="rund" id="menue" aria-label="Menü">☰</button>
    </div>
    <div class="hud-unten">
      ${panelHtml(w)}
      <div class="werkzeuge">
        ${[["schauen", "👆", "Schauen"], ["bauen", "🛤️", "Gleise"], ["abreissen", "⛏️", "Abreißen"], ["zug", "🚂", "Zug"]].map(([m, i, t]) =>
          `<button data-modus="${m}" class="${(ui.panel && ui.panel.art === "zug") ? (m === "zug" ? "an" : "") : (ui.modus === m && !(ui.panel && ["menue", "land"].includes(ui.panel.art)) ? "an" : "")}"><i>${i}</i>${t}</button>`).join("")}
      </div>
    </div>`;
  hud.querySelectorAll("[data-modus]").forEach(b => b.onclick = () => {
    const m = b.dataset.modus;
    if (m === "zug") { ui.panel = ui.panel && ui.panel.art === "zug" ? null : { art: "zug" }; }
    else { ui.modus = m; ui.panel = null; welt.markieren(null); }
    render();
  });
  hud.querySelectorAll("[data-teil]").forEach(b => b.onclick = () => { ui.teil = b.dataset.teil; render(); });
  hud.querySelectorAll("[data-stufe]").forEach(b => b.onclick = () => tun({ typ: "stufe", k: b.dataset.stufe }));
  const on = (id, f) => { const el = document.getElementById(id); if (el) el.onclick = f; };
  on("folgen", () => { welt.folgen = !welt.folgen; render(); });
  on("menue", () => { ui.panel = ui.panel && ui.panel.art === "menue" ? null : { art: "menue" }; render(); });
  on("zu", () => { ui.panel = null; welt.markieren(null); render(); });
  on("wenden", () => { tun({ typ: "wenden" }); });
  on("land", () => { const r = tun({ typ: "land", p: ui.panel.p }); if (r.ok) { ui.panel = null; welt.markieren(null); render(); hinweis("Neues Land gekauft."); } });
  on("speichern", speichern);
  on("beenden", beenden);
  zahlenAuffrischen();
}

function panelHtml(w) {
  const p = ui.panel;
  const kopf = t => `<div class="kopf"><h3>${t}</h3><button class="zu" id="zu" aria-label="Schließen">✕</button></div>`;
  if (p && p.art === "menue") {
    return `<div class="panel">${kopf("Menü")}
      <p class="stand">${strecke(S.meter)} gefahren · ${zahl(S.verdient)} T verdient · ${S.gebaut} Gleisteile gebaut · Spielzeit ${dauer(S.zeit)}</p>
      <p class="hinweis">${gespeichertUm ? "Zuletzt gespeichert " + esc(vor(gespeichertUm)) + "." : "Diese Welt ist noch nicht gespeichert."} Wer ohne Speichern schließt, verwirft den Spielstand.</p>
      <div class="knopfreihe"><button class="knopf" id="speichern">Speichern</button><button class="knopf zweit" id="beenden">Zur Startseite</button></div>
      <p class="hinweis"><b>So geht's:</b> Gleise: Teil wählen, Feld antippen. Ein Gleis nochmal antippen dreht es. Kurven bremsen den Zug, auf langen Geraden wird er schnell und verdient mehr.</p>
    </div>`;
  }
  if (p && p.art === "land") {
    const kaufbar = G.landKaufbar(S, p.p), preis = G.landPreis(S);
    return `<div class="panel kompakt">${kopf("Grundstück")}
      <p class="hinweis">${kaufbar ? `8 × 8 Felder. Danach könnt ihr hier bauen.` : "Kaufen geht nur direkt neben eigenem Land (gelbe Linie)."}</p>
      ${kaufbar ? `<button class="knopf" id="land" data-preis="${preis}">Kaufen für ${zahl(preis)} T</button>` : ""}
    </div>`;
  }
  if (p && p.art === "zug") {
    const st = S.zug.stufen, wagen = 1 + st.wagen;
    const was = {
      tempo: `${G.kmh(w.vmax)} km/h → ${G.kmh(w.vmax + .3)} km/h`,
      kraft: `+22 % Beschleunigung`,
      kurve: `${G.kmh(w.vk)} km/h → ${G.kmh(w.vk + .12)} km/h in Kurven`,
      bremse: `+22 % Bremskraft`,
      wagen: `${wagen} → ${wagen + 1} Wagen, ${(w.geld).toLocaleString("de-DE")} → ${(w.geld + .5).toLocaleString("de-DE")} T pro 10 m`
    };
    return `<div class="panel">${kopf("Zug")}
      <p class="hinweis">${S.zug.wartet ? "<b>Der Zug steht am Gleisende.</b> Baut weiter oder wendet ihn. " : ""}Jede 10 m bringen ${w.geld.toLocaleString("de-DE")} T.</p>
      <div class="stufen">${Object.keys(G.STUFEN).map(k => {
        const d = G.STUFEN[k], voll = st[k] >= d.max, preis = G.stufenPreis(S, k);
        return `<div class="stufe"><div><b>${d.name} · Stufe ${st[k]}</b><small>${voll ? "ganz ausgebaut" : was[k]}</small></div>
          <button data-stufe="${k}" ${voll ? "disabled" : `data-preis="${preis}"`}>${voll ? "fertig" : zahl(preis) + " T"}</button></div>`;
      }).join("")}</div>
      <button class="knopf zweit" id="wenden">Zug wenden</button>
    </div>`;
  }
  if (p && p.art === "feld") {
    const g = S.karte.g[p.i], t = S.gleise[p.i];
    return `<div class="panel kompakt">${kopf(t ? G.TEILE[t.t].name : G.GELAENDE[g])}
      <p class="hinweis">${t ? "Gleisteil. Zum Drehen oder Ersetzen auf „Gleise“ tippen, zum Entfernen auf „Abreißen“." :
        g === "w" ? "Wald. Bauen kostet 15 T mehr fürs Roden." : g === "~" ? "Wasser. Brücken kommen später." : g === "b" ? "Berg. Tunnel kommen später." : g === "h" ? "Ein Dorf. Bahnhöfe kommen später." : "Freie Wiese, hier könnt ihr bauen."}</p>
    </div>`;
  }
  if (ui.modus === "bauen") {
    return `<div class="panel kompakt">
      <div class="teile">${Object.keys(G.TEILE).map(k => `<button data-teil="${k}" class="${ui.teil === k ? "an" : ""}">${TEIL_BILD[k]}${G.TEILE[k].name}<small>${G.TEILE[k].preis} T</small></button>`).join("")}</div>
      <p class="hinweis">Feld antippen: bauen. Gleis antippen: drehen (kostenlos) oder durch das gewählte Teil ersetzen.</p>
    </div>`;
  }
  if (ui.modus === "abreissen") return `<div class="panel kompakt"><p class="hinweis">Gleis antippen: abreißen. Ihr bekommt die Hälfte des Preises zurück.</p></div>`;
  return "";
}

function zahlenAuffrischen() {
  if (!S || hud.hidden) return;
  const jetzt = S.zeit;
  verlauf.push([jetzt, S.verdient]);
  while (verlauf.length > 2 && jetzt - verlauf[0][0] > 60) verlauf.shift();
  const [t0, v0] = verlauf[0];
  if (jetzt - t0 > 3) proMinute = (S.verdient - v0) / (jetzt - t0) * 60;
  const set = (id, t) => { const el = document.getElementById(id); if (el && el.textContent !== t) el.textContent = t; };
  set("kasse", zahl(S.kasse) + " T"); set("promin", zahl(proMinute) + " T"); set("tempo", G.kmh(S.zug.v) + " km/h");
  hud.querySelectorAll("[data-preis]").forEach(b => b.classList.toggle("teuer", S.kasse < +b.dataset.preis));
}

if (T) window.__gg = { get S() { return S; }, get welt() { return welt; }, ui };
startseite();
