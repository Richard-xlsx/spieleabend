// Orbit: Anzeige der Raumstation (Spielbrett) und der Rundenschritte auf dem Handy.
// app.js ruft ORBIT_BRETT.html(c), .ende(c), .binden(c) und alle 100 ms .bewegen(c) auf.
// c = { S, PID, R, esc, helm(p), helmInnen(p), name(p), farbe(p), uhr(bis), jetzt(), tun(m), host, da(p) }
(function () {
  const W = window, R = W.RM, SN = W.ORBIT_SENSOR;
  // Schütteln würfelt, solange der Würfelknopf zu sehen ist
  if (SN) SN.beiSchuetteln(() => { const b = document.getElementById("wurf"); if (b && !b.disabled) b.click(); });
  const CX = 180, CY = 180, RING = 136;
  const FARBE = { L: "#C9D1E0", V: "#2EC4B6", M: "#FF7A2F", P: "#FF5C9A", T: "#A57BFF", B: "#4DA3FF", G: "#FFD23F", A: "#7BD957", W: "#4B2FA8" };
  const winkel = i => -Math.PI / 2 + i * 2 * Math.PI / R.N;
  const punkt = (i, r) => [CX + Math.cos(winkel(i)) * r, CY + Math.sin(winkel(i)) * r];
  const f1 = x => Math.round(x * 10) / 10;

  // Symbole der Felder (20 × 20)
  const ICON = {
    L: `<rect x="5" y="3.5" width="10" height="13" rx="2"/><path d="M10 3.5v13"/>`,
    V: `<path d="M10 4.5v11M4.5 10h11" stroke-width="3"/>`,
    M: `<circle cx="12.5" cy="7.5" r="3.6" fill="#060A1C"/><path d="M9.5 10.5L4 16M7.6 8.6L3.6 10.6M11.4 12.4l-2 4"/>`,
    P: `<circle cx="10" cy="8.6" r="5.2" fill="#060A1C"/><circle cx="8" cy="8.6" r="1.4" fill="#FF5C9A" stroke="none"/><circle cx="12" cy="8.6" r="1.4" fill="#FF5C9A" stroke="none"/><path d="M7.6 13.5v3M10 13.5v3M12.4 13.5v3"/>`,
    T: `<path d="M4 7h11l-3-3M16 13H5l3 3"/>`,
    B: `<rect x="3.5" y="4" width="13" height="9.5" rx="1.6"/><path d="M8 16.5h4M10 13.5v3M6.5 8.5h3"/>`,
    G: `<path d="M10 10a1.5 1.5 0 1 1 1.5 1.5a3 3 0 1 1 -3 -3a4.6 4.6 0 1 1 -4.6 4.6"/>`,
    A: `<path d="M10 3.5c4 0 6.2 2.8 6.2 6 0 3.5-3.2 7-6.2 7s-6.2-3.5-6.2-7c0-3.2 2.2-6 6.2-6z" fill="#060A1C"/><ellipse cx="7.6" cy="10" rx="2" ry="1.15" fill="#7BD957" stroke="none" transform="rotate(25 7.6 10)"/><ellipse cx="12.4" cy="10" rx="2" ry="1.15" fill="#7BD957" stroke="none" transform="rotate(-25 12.4 10)"/>`,
    W: `<g stroke="#EAF2FF"><circle cx="10" cy="10" r="6.5"/><circle cx="10" cy="10" r="3.4"/></g><circle cx="10" cy="10" r="1" fill="#EAF2FF" stroke="none"/>`
  };
  const symbole = () => `<defs>${Object.keys(ICON).map(k => `<symbol id="ic-${k}" viewBox="0 0 20 20"><g fill="none" stroke="#060A1C" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</g></symbol>`).join("")}</defs>`;
  const feldIcon = (k, gr) => `<svg class="feldicon" viewBox="0 0 20 20" width="${gr || 22}" height="${gr || 22}" aria-hidden="true"><circle cx="10" cy="10" r="10" fill="${FARBE[k]}"/><svg x="3" y="3" width="14" height="14" viewBox="0 0 20 20"><g fill="none" stroke="#060A1C" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</g></svg></svg>`;

  function wuerfel(n) {
    const P = { 1: [[10, 10]], 2: [[6, 6], [14, 14]], 3: [[6, 6], [10, 10], [14, 14]], 4: [[6, 6], [14, 6], [6, 14], [14, 14]],
      5: [[6, 6], [14, 6], [10, 10], [6, 14], [14, 14]], 6: [[6, 5.5], [14, 5.5], [6, 10], [14, 10], [6, 14.5], [14, 14.5]] }[n] || [];
    return `<svg class="wuerfel" viewBox="0 0 20 20" role="img" aria-label="${n}"><rect x="1" y="1" width="18" height="18" rx="4.5" fill="#EAF2FF" stroke="#060A1C" stroke-width="1.4"/>${P.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.9" fill="#0B1026"/>`).join("")}</svg>`;
  }
  const kristall = () => `<svg class="kristall" viewBox="0 0 12 14" aria-hidden="true"><path d="M6 .8l5 4.2-5 8.2-5-8.2z" fill="#FFD23F" stroke="#060A1C" stroke-width="1"/><path d="M1 5h10M6 .8L4 5l2 8.2L8 5z" fill="none" stroke="#060A1C" stroke-width=".6" opacity=".55"/></svg>`;
  const wurfSumme = w => R.summe(w);

  // Position der Figuren: der ziehende Helm steht groß im Korridor, die anderen innen am Modul
  function figurOrte(c) {
    const S = c.S, P = S.partie, z = P.zug, orte = {};
    const zieher = z ? z.pid : null;
    const nachModul = {};
    for (const p of R.mitspieler(S)) {
      if (p === zieher) continue;
      (nachModul[P.pos[p]] = nachModul[P.pos[p]] || []).push(p);
    }
    for (const m in nachModul) {
      const ps = nachModul[m], n = ps.length;
      ps.forEach((p, k) => {
        const reihe = k < 4 ? 0 : 1, inReihe = reihe ? n - 4 : Math.min(n, 4), idx = reihe ? k - 4 : k;
        const r = RING - 35 - reihe * 25, w = winkel(+m), t = (idx - (inReihe - 1) / 2) * 25;
        orte[p] = [CX + Math.cos(w) * r - Math.sin(w) * t, CY + Math.sin(w) * r + Math.cos(w) * t, 0];
      });
    }
    if (zieher && P.pos[zieher] !== undefined) orte[zieher] = zugOrt(c);
    return orte;
  }
  function zugOrt(c) {
    const P = c.S.partie, z = P.zug;
    let modul = P.pos[z.pid];
    if (z.stufe === "laufen") {
      const k = Math.max(0, Math.min(z.pfad.length, Math.floor((c.jetzt() - z.start) / R.ZEIT.schritt)));
      modul = k === 0 ? z.von : z.pfad[k - 1];
    }
    const [x, y] = punkt(modul, RING);
    return [x, y, 1];
  }
  // Übergänge über das Neuzeichnen hinweg: Jedes Element merkt sich sein letztes Ziel.
  // Ändert sich das Ziel, wird es am alten Ort gezeichnet und gleitet (per CSS-Übergang) zum neuen.
  const bahn = {};
  function gleiten(key, nach, dauer) {
    const jetzt = performance.now(), b = bahn[key];
    if (!b || dauer === 0) { bahn[key] = { von: nach, nach, t0: 0, dauer: 0 }; return `transform:${nach}`; }
    if (b.nach !== nach) Object.assign(b, { von: b.nach, nach, t0: jetzt, dauer });
    const alt = jetzt - b.t0;
    if (alt >= b.dauer) return `transform:${nach}`;
    return `transform:${b.von};transition:transform ${b.dauer}ms ease-in-out ${-Math.round(alt)}ms" data-nach="${nach}`;
  }
  // Einmalige Effekte (Energie schwebt hoch, Kristalle fliegen): Startzeit merken, beim Neuzeichnen weiterlaufen lassen
  const zuerst = {};
  function effekt(key, dauer) {
    const jetzt = performance.now();
    if (!(key in zuerst)) zuerst[key] = jetzt;
    const alt = jetzt - zuerst[key];
    return alt < dauer ? `animation-delay:${-Math.round(alt)}ms` : null;
  }
  const figur = (c, p, o, fest) => {
    const gross = o[2], s = gross ? 0.8 : 0.66, h = 20 * s;
    const t = `translate(${f1(o[0])}px,${f1(o[1])}px)`, alt = bahn["f:" + p];
    const weit = alt ? Math.hypot(...(alt.nach.match(/-?[\d.]+/g) || [0, 0]).map((v, i) => +v - o[i])) : 0;
    return `<g class="figur ${p === c.PID ? "ich" : ""} ${gross ? "zieht" : ""}" data-fig="${p}" style="${gleiten("f:" + p, t, fest ? 0 : weit > 110 ? 950 : 480)}">
      ${p === c.PID ? `<circle r="${h + 3}" class="meinring"/>` : ""}<g transform="translate(${-h} ${-h - 1}) scale(${s})">${c.helmInnen(p)}</g></g>`;
  };

  // Zoom: beim Ziehen folgt das Brett dem Helm, bei der eigenen Schrittwahl zeigt es die möglichen Ziele
  function zoomZiel(c) {
    const P = c.S.partie, z = P.zug;
    if (P.schritt !== "ziehen" || !z) return null;
    const fr = z.frage;
    if (fr && fr.art === "schritte") {
      const n = Math.max(...fr.optionen), span = n * 2 * Math.PI / R.N, sehne = 2 * RING * Math.sin(Math.min(span, Math.PI) / 2);
      const sk = Math.min(1.55, 330 / (sehne + 90));
      return sk < 1.15 ? null : [punkt(z.von + n / 2, RING - 10), sk];
    }
    if (fr && fr.art !== "kauf") return null;          // Pirat, Teleporter, Wurmloch: ganzes Brett zeigen
    if (z.stufe === "laufen") return [zugOrt(c), 1.7];
    return [punkt(c.S.partie.pos[z.pid], RING - 20), 1.45];
  }
  function zoomText(c) {
    const zz = zoomZiel(c);
    if (!zz) return `translate(${CX}px,${CY}px) scale(1) translate(${-CX}px,${-CY}px)`;
    const [[x, y], sk] = zz, rand = CX - CX / sk;      // nicht über den Rand hinaus schieben
    const kx = Math.max(CX - rand, Math.min(CX + rand, x)), ky = Math.max(CY - rand, Math.min(CY + rand, y));
    return `translate(${CX}px,${CY}px) scale(${f1(sk)}) translate(${f1(-kx)}px,${f1(-ky)}px)`;
  }
  // Was im Zug passiert, direkt am Helm: Energie schwebt hoch, der Pirat zieht Energie ab, Kristalle fliegen vom Schiff
  function effekte(c, orte) {
    const P = c.S.partie, z = P.zug;
    if (!z || !z.feld || !orte[z.pid]) return "";
    const [x, y] = orte[z.pid], k = P.runde + ":" + z.pid + ":" + z.start, teile = [];
    const schwebe = (key, tx, ty, text, farbe) => { const st = effekt(key, 1900); if (st) teile.push(`<g transform="translate(${f1(tx)} ${f1(ty)})"><g class="schwebe" style="${st}"><text y="-26" fill="${farbe}">${text}</text></g></g>`); };
    const flug = (key, vx, vy, inhalt, verz) => { const st = effekt(key, 1300 + verz); if (st) teile.push(`<g transform="translate(${f1(x)} ${f1(y)})"><g class="flug" style="--dx:${f1(vx - x)}px;--dy:${f1(vy - y)}px;${st.replace(/(-?\d+)ms/, (m, n) => (+n + verz) + "ms")}">${inhalt}</g></g>`); };
    const m = /([+−-])(\d+) Energie/.exec(z.text || "");
    if (m && !z.opfer) schwebe(k + ":e", x, y, `${m[1] === "+" ? "+" : "−"}${m[2]} ⚡`, m[1] === "+" ? "#7BD957" : "#FF7A2F");
    else if (/Sternkristall!/.test(z.text || "")) schwebe(k + ":k", x, y, "+1 ◆", "#FFD23F");
    else if (z.feld === "B" && P.gratis[z.pid]) schwebe(k + ":b", x, y, "Gratiswette", "#4DA3FF");
    else if (z.feld === "A" && P.alien === z.pid) schwebe(k + ":a", x, y, "Alien!", "#7BD957");
    if (z.opfer && orte[z.opfer]) {
      const [ox, oy] = orte[z.opfer];
      flug(k + ":p", ox, oy, `<circle r="9" fill="#FF5C9A" stroke="#060A1C" stroke-width="1.5"/><text y="4" class="flugtext">⚡</text>`, 0);
      schwebe(k + ":p1", ox, oy, `−${z.beute} ⚡`, "#FF7A2F");
      schwebe(k + ":p2", x, y, `+${z.beute} ⚡`, "#7BD957");
    }
    if (z.kauf) {
      const h = z.pfad.find(m => R.schiffe(P).includes(m)), q = punkt(h == null ? P.pos[z.pid] : h, RING + 27);
      for (let i = 0; i < z.kauf; i++) flug(k + ":c" + i, q[0], q[1], `<path d="M0-9l7 6-7 11-7-11z" fill="#FFD23F" stroke="#060A1C" stroke-width="1.4"/>`, i * 220);
      schwebe(k + ":c", x, y, `+${z.kauf} ◆`, "#FFD23F");
    }
    return teile.join("");
  }

  function brettSvg(c) {
    const S = c.S, P = S.partie;
    const kacheln = Array.from(R.FELDER).map((k, i) => {
      const [x, y] = punkt(i, RING), h = R.schiffe(P).includes(i);
      return `<g class="modul" transform="translate(${f1(x)} ${f1(y)})">${h ? `<circle r="19" class="haendlerring"/>` : ""}<circle r="14" fill="${FARBE[k]}" stroke="#060A1C" stroke-width="2"/><use href="#ic-${k}" x="-9" y="-9" width="18" height="18"/></g>`;
    }).join("");
    const [wa, wb] = [punkt(8, RING - 14), punkt(24, RING - 14)];
    const speichen = [4, 12, 20, 28].map(i => { const [a, b] = punkt(i, 58), [x, y] = punkt(i, RING - 16); return `<path d="M${f1(a)} ${f1(b)}L${f1(x)} ${f1(y)}"/>`; }).join("");
    // Händlerschiff außen am Ring, quer zur Laufrichtung
    // Die Schiffe kreisen beim Weiterfliegen um die Station (immer vorwärts)
    const schiff = R.schiffe(P).map((hm, k) => { const b = bahn["s:" + k]; let grad = hm * 360 / R.N;
      if (b) { const alt = +b.nach.match(/-?[\d.]+/)[0]; while (grad < alt - 0.01) grad += 360; if (grad - alt >= 360) grad -= 360; }
      return `<g class="schiffbahn" style="${gleiten("s:" + k, `rotate(${f1(grad)}deg)`, 1800)}"><g class="schiff" transform="translate(${CX} ${CY - RING - 27})"><path d="M-15 2l5-7h20l5 7-5 4h-20z" fill="#FFD23F" stroke="#060A1C" stroke-width="1.8" stroke-linejoin="round"/><path d="M-5-5l2-5h6l2 5" fill="#9AA7D1" stroke="#060A1C" stroke-width="1.6"/><circle cx="-6" cy="1" r="1.6" fill="#060A1C"/><circle cx="0" cy="1" r="1.6" fill="#060A1C"/><circle cx="6" cy="1" r="1.6" fill="#060A1C"/></g></g>`; }).join("");
    // Wählt jemand gerade die Schrittzahl, sind die möglichen Ziele markiert
    const zw = P.zug && P.zug.frage && P.zug.frage.art === "schritte" ? P.zug : null;
    // … ebenso die eigenen, solange man beim Würfeln vorab wählt
    const meinW = P.wurf[c.PID], vor = !zw && Array.isArray(meinW) && P.pos[c.PID] !== undefined && (P.schritt === "wuerfeln" || (P.schritt === "ziehen" && !P.zug && P.reihe.includes(c.PID)));
    const marken = zw ? { von: zw.von, opt: zw.frage.optionen, gew: null } : vor ? { von: P.pos[c.PID], opt: R.schrittOptionen(meinW), gew: P.schritte && P.schritte[c.PID] } : null;
    const ziele = marken ? marken.opt.map(n => { const [x, y] = punkt((marken.von + n) % R.N, RING); return `<g class="zielmarke ${marken.gew === n ? "gewaehlt" : ""}" transform="translate(${f1(x)} ${f1(y)})"><circle r="18"/><text y="-22">${n}</text></g>`; }).join("") : "";
    const orte = figurOrte(c);
    const reihenfolge = Object.keys(orte).sort((a, b) => (orte[a][2] - orte[b][2]) || ((a === c.PID) - (b === c.PID)));
    const z = P.zug, laeuft = z && z.stufe === "laufen";
    const final = P.runde >= P.runden;
    const schritt = { wuerfeln: "Würfeln", ziehen: "Ziehen", wahl: "Missionswahl", wetten: "Wetten" }[P.schritt] || "";
    return `<svg class="brett" viewBox="0 0 360 360" role="img" aria-label="Raumstation mit ${R.N} Modulen, Runde ${P.runde} von ${P.runden}">${symbole()}
      <g class="welt" style="${laeuft ? (bahn.zoom = { von: zoomText(c), nach: zoomText(c), t0: 0, dauer: 0 }, `transform:${zoomText(c)}`) : gleiten("zoom", zoomText(c), 700)}">
      <circle cx="${CX}" cy="${CY}" r="${RING}" fill="none" stroke="#1C2550" stroke-width="36"/>
      <circle cx="${CX}" cy="${CY}" r="${RING}" fill="none" stroke="#2A3568" stroke-width="1.5" stroke-dasharray="3 5"/>
      <path d="M${f1(wa[0])} ${f1(wa[1])}L${f1(wb[0])} ${f1(wb[1])}" stroke="#7E63E0" stroke-width="2" stroke-dasharray="2 6" stroke-linecap="round" opacity=".8"/>
      <g stroke="#2A3568" stroke-width="5" stroke-linecap="round">${speichen}</g>
      <circle cx="${CX}" cy="${CY}" r="58" fill="#141B3D" stroke="#2A3568" stroke-width="2"/>
      <circle cx="${CX}" cy="${CY}" r="48" fill="none" stroke="${final ? "#FF7A2F" : "#2EC4B6"}" stroke-width="1.5" opacity=".5" class="hubpuls"/>
      ${hubWurf(c) ? `<text x="${CX}" y="${CY - 30}" class="hubklein">RUNDE ${P.runde}/${P.runden}</text>
      <text x="${CX}" y="${CY + 42}" class="hubklein ${final ? "doppelt" : ""}">${final ? "DOPPELT" : schritt.toUpperCase()}</text>` : `<text x="${CX}" y="${CY - 18}" class="hubklein">RUNDE</text>
      <text x="${CX}" y="${CY + 12}" class="hubgross">${P.runde}<tspan class="hubvon">/${P.runden}</tspan></text>
      <text x="${CX}" y="${CY + 32}" class="hubklein ${final ? "doppelt" : ""}">${final ? "DOPPELT" : schritt.toUpperCase()}</text>`}
      ${kacheln}${schiff}${ziele}
      ${reihenfolge.map(p => figur(c, p, orte[p], laeuft && p === z.pid)).join("")}
      ${effekte(c, orte)}
    </g></svg>`;
  }

  // ---------- Würfel in der Stationsmitte (CSS-3D) ----------
  // Welcher Wurf liegt in der Mitte? Beim Würfeln der eigene, beim Ziehen der des Ziehenden.
  function hubWurf(c) {
    const S = c.S, P = S.partie, ich = P.pos[c.PID] !== undefined;
    if (P.schritt === "wuerfeln" && ich) return { pid: c.PID, w: P.wurf[c.PID] || null };
    if (P.schritt === "ziehen" && P.zug && Array.isArray(P.wurf[P.zug.pid])) return { pid: P.zug.pid, w: P.wurf[P.zug.pid] };
    if (P.schritt === "ziehen" && !P.zug && ich && Array.isArray(P.wurf[c.PID])) return { pid: c.PID, w: P.wurf[c.PID] };
    return null;
  }
  // Augen 1–6 auf die Seiten eines Würfels, gedreht so, dass die Zahl n vorn liegt
  const SEITE = { 1: "", 6: "rotateY(180deg)", 2: "rotateY(90deg)", 5: "rotateY(-90deg)", 3: "rotateX(-90deg)", 4: "rotateX(90deg)" };
  const ZEIGT = { 1: "", 6: "rotateY(180deg)", 2: "rotateY(-90deg)", 5: "rotateY(90deg)", 3: "rotateX(90deg)", 4: "rotateX(-90deg)" };
  const wuerfel3d = (n, k) => `<div class="w3" style="transform:rotateX(-16deg) rotateY(${k ? -20 : 20}deg) ${ZEIGT[n] || ""}">${[1, 2, 3, 4, 5, 6].map(f => `<i style="transform:${SEITE[f]} translateZ(calc(var(--s) / 2))">${wuerfel(f)}</i>`).join("")}</div>`;
  const ROLLZEIT = 1150, gesehen = {};
  let gedrueckt = null;
  function wurfBuehne(c) {
    const h = hubWurf(c), P = c.S.partie;
    if (!h) return "";
    if (!h.w) {
      // Noch nicht gewürfelt: zwei Würfel wackeln in der Mitte, Tippen würfelt
      const schuettelt = gedrueckt === P.runde;
      return `<button class="wurfbuehne hubwurf ${schuettelt ? "schuettelt" : ""}" id="hubwurf" aria-label="Würfeln">
        <span class="w3bahn">${wuerfel3d(5, 0)}</span><span class="w3bahn">${wuerfel3d(2, 1)}</span></button>`;
    }
    const key = P.runde + ":" + h.pid, jetzt = performance.now();
    if (!(key in gesehen)) gesehen[key] = jetzt;
    const alt = jetzt - gesehen[key], rollt = alt < ROLLZEIT;
    const z = P.zug, gew = z && z.pid === h.pid && z.wurf != null && z.wurf !== h.w[0] + h.w[1] ? (z.wurf === h.w[0] ? 1 : 0) : -1;   // nicht benutzter Würfel
    const fremd = h.pid !== c.PID;
    return `<div class="wurfbuehne ${fremd ? "fremd" : ""} ${zoomZiel(c) ? "ecke" : ""}" style="--farbe:${c.farbe(h.pid)}" aria-label="Wurf ${h.w.join(" und ")}" role="img">
      ${h.w.map((n, k) => `<span class="w3bahn ${rollt ? "rollt" : ""} ${k === gew ? "blass" : ""}" ${rollt ? `style="animation-delay:${-Math.round(alt) + k * 60}ms"` : ""}>${wuerfel3d(n, k)}</span>`).join("")}</div>`;
  }

  // Schrittwahl gleich nach dem Würfeln: drei Knöpfe nebeneinander, bis zum eigenen Zug änderbar
  function vorwahl(c) {
    const P = c.S.partie, w = P.wurf[c.PID];
    if (!Array.isArray(w) || P.pos[c.PID] === undefined) return "";
    if (P.schritt === "ziehen" && (!P.reihe.includes(c.PID) || (P.zug && P.zug.pid === c.PID))) return "";
    const opt = R.schrittOptionen(w), summe = w[0] + w[1], gew = P.schritte && P.schritte[c.PID], von = P.pos[c.PID];
    const knoepfe = opt.map(n => {
      const ziel = (von + n) % R.N, typ = R.FELDER[ziel], vorbei = Array.from({ length: n }, (_, i) => (von + i + 1) % R.N).some(m => R.schiffe(P).includes(m));
      const art = n === summe && opt.length > 1 ? "beide" : "1 Würfel";
      return `<button class="vorwahl ${gew === n ? "an" : ""}" data-schritte="${n}" aria-pressed="${gew === n}">${feldIcon(typ, 24)}<b>${n}</b><small>${art}${vorbei ? " · " + kristall() : ""}</small><small class="fn">${c.esc(R.FELD[typ].name)}</small></button>`;
    }).join("");
    return `<div class="vorwahlbox"><p class="klein mitte">${gew ? `Du ziehst <b>${gew}</b> Module, sobald du dran bist. Ändern geht noch.` : `Wie weit willst du ziehen? Du kannst schon jetzt wählen.`}</p><div class="vorwahlen">${knoepfe}</div></div>`;
  }

  // Erste Partie: Beim ersten Mal auf einem Feldtyp (auf diesem Handy) erklärt ein Satz, was das Feld macht
  const erklaert = {};
  function feldNeu(z) {
    const k = z.feld, zk = z.pid + ":" + z.start;
    if (erklaert[k]) return erklaert[k] === zk;
    let gesehen = {};
    try { gesehen = JSON.parse(localStorage.getItem("ob:felder") || "{}") || {}; } catch (e) {}
    if (gesehen[k]) { erklaert[k] = "alt"; return false; }
    gesehen[k] = 1; erklaert[k] = zk;
    try { localStorage.setItem("ob:felder", JSON.stringify(gesehen)); } catch (e) {}
    return true;
  }

  // ---------- Panels unter dem Brett ----------
  let tipp = null, einsatz = 0, wettMerker = "";
  function panel(c) {
    const S = c.S, P = S.partie, ich = P.pos[c.PID] !== undefined, esc = c.esc, sp = p => S.spieler[p] || { name: "?", energie: 0, kristalle: 0 };
    const kopf = (titel, bis) => `<div class="panelkopf"><h2>${titel}</h2>${bis ? c.uhr(bis) : ""}</div>`;
    if (P.schritt === "wuerfeln") {
      const mein = P.wurf[c.PID];
      const reihe = R.mitspieler(S).filter(p => p !== c.PID || !ich).map(p => `<li>${c.helm(p)}<span class="nm">${esc(c.name(p))}</span>${P.wurf[p] ? `<span class="wuerfelpaar">${wuerfel(P.wurf[p][0])}${wuerfel(P.wurf[p][1])}</span>` : `<span class="leise klein">${c.da(p) ? "…" : "offline"}</span>`}</li>`).join("");
      return kopf("Alle würfeln", P.bis) +
        (ich && !mein ? `<button class="knopf wuerfelknopf" id="wurf">${wuerfel(5)}${wuerfel(2)}<span>Würfeln</span></button>
          <p class="leise klein mitte">Tippen oder Handy schütteln${SN && SN.brauchtErlaubnis() ? ` · <button class="link" id="schuettelnErlauben">Schütteln erlauben</button>` : ""}</p>` : "") +
        (ich && mein ? vorwahl(c) : "") +
        (!ich ? `<p class="mitte leise">${sp(c.PID).wartet ? "Du steigst in der nächsten Runde ein." : "Du schaust zu."}</p>` : "") +
        `<ul class="wurfchips">${reihe}</ul>`;
    }
    if (P.schritt === "ziehen") {
      const z = P.zug;
      const danach = P.reihe.length ? `<p class="leise klein mitte">Danach: ${P.reihe.map(p => esc(c.name(p))).join(", ")}</p>` : "";
      if (!z) return kopf("Ziehen") + `<p class="mitte leise">Wer hinten liegt, zieht zuerst.</p>` + danach + vorwahl(c);
      const feld = z.feld ? R.FELD[z.feld] : null, meins = z.pid === c.PID;
      const w = P.wurf[z.pid], titel = z.wurf == null ? `${meins ? "Du hast" : esc(c.name(z.pid)) + " hat"} ${Array.isArray(w) ? w.join(" und ") : w} gewürfelt` : `${meins ? "Du ziehst" : esc(c.name(z.pid)) + " zieht"} ${z.wurf} Module`;
      let h = `<div class="zugkarte">${c.helm(z.pid)}<div><b>${titel}</b>
        ${feld ? `<p class="feldzeile">${feldIcon(z.feld, 20)}<span><b>${esc(feld.name)}</b>${z.text ? ": " + esc(z.text) : ""}</span></p>${feldNeu(z) ? `<p class="feldneu">Neu: ${esc(feld.text)}</p>` : ""}` : `<p class="leise klein">${z.wurf == null ? "wählt: ein Würfel oder beide" : "unterwegs …"}</p>`}
        ${z.text2 ? `<p class="feldzeile">${kristall()}<span>${esc(z.text2)}</span></p>` : ""}</div></div>`;
      const fr = z.frage;
      if (fr && meins) {
        const k = [];
        if (fr.art === "schritte") {
          const wurf = Array.isArray(P.wurf[c.PID]) ? P.wurf[c.PID] : [], summe = fr.optionen[fr.optionen.length - 1];
          h = `<p class="mitte">Du hast ${wurf.map(n => wuerfel(n)).join(" ")} gewürfelt. Mit <b>einem Würfel</b> oder mit <b>beiden</b>?</p>`;
          for (const n of fr.optionen) {
            const ziel = (z.von + n) % R.N, typ = R.FELDER[ziel], vorbei = Array.from({ length: n }, (_, i) => (z.von + i + 1) % R.N).some(m => R.schiffe(P).includes(m));
            const art = n === summe && fr.optionen.length > 1 ? "beide Würfel" : wurf[0] === wurf[1] && n === wurf[0] ? "ein Würfel" : `Würfel ${n}`;
            k.push(`<button class="knopf zweit wahlknopf schrittknopf" data-antwort="${n}">${feldIcon(typ, 26)}<span><b>${n} ${n === 1 ? "Modul" : "Module"}</b> · ${art}<small>${esc(R.FELD[typ].name)}${vorbei ? " · am Händler vorbei" : ""}</small></span></button>`);
          }
          return kopf("Wie weit ziehst du?", fr.bis) + h + `<div class="knoepfe">${k.join("")}</div>`;
        }
        if (fr.art === "kauf") {
          for (let n = 1; n <= fr.optionen; n++) k.push(`<button class="knopf" data-antwort="${n}">${n === 1 ? "1 Kristall" : n + " Kristalle"} für ${n * R.PREIS} ⚡</button>`);
          k.push(`<button class="knopf zweit" data-antwort="nein">Nichts kaufen</button>`);
          h += `<p class="mitte">Das Händlerschiff verkauft Sternkristalle. Du hast <b>${sp(c.PID).energie} ⚡</b>.</p>`;
        } else if (fr.art === "pirat" || fr.art === "teleporter") {
          h += `<p class="mitte">${fr.art === "pirat" ? `Wem klaust du ${5 * R.faktor(S)} Energie?` : "Mit wem tauschst du den Platz?"}</p>`;
          for (const p of fr.optionen) k.push(`<button class="knopf zweit wahlknopf" data-antwort="${esc(p)}">${c.helm(p)}<span>${esc(c.name(p))}</span><small>${fr.art === "pirat" ? sp(p).energie + " ⚡" : "Modul " + (P.pos[p] + 1)}</small></button>`);
          if (fr.art === "teleporter") k.push(`<button class="knopf zweit" data-antwort="nein">Nicht tauschen</button>`);
        } else if (fr.art === "wurmloch") {
          h += `<p class="mitte">Durchs Wurmloch auf die andere Seite der Station?</p>`;
          k.push(`<button class="knopf" data-antwort="ja">Springen für ${R.WURMPREIS} ⚡</button><button class="knopf zweit" data-antwort="nein">Hierbleiben</button>`);
        }
        return kopf("Deine Entscheidung", fr.bis) + h + `<div class="knoepfe">${k.join("")}</div>`;
      }
      if (fr) h += `<p class="mitte leise">${esc(c.name(z.pid))} entscheidet … ${c.uhr(fr.bis)}</p>`;
      return kopf("Ziehen") + h + danach + vorwahl(c);
    }
    if (P.schritt === "wahl" && P.wahl) {
      const w = P.wahl, meins = w.wer === c.PID;
      const karten = w.optionen.map(id => {
        const M = R.MISSIONEN[id] || { name: id, art: "", eingabe: "", kurz: "" };
        return `<div class="missionskarte"><div><b>${esc(M.name)}</b><small>${esc(M.art)} · ${esc(M.eingabe)}</small><p class="leise klein">${esc(M.kurz)}</p></div>${meins ? `<button class="knopf klein-knopf" data-waehle="${id}">Wählen</button>` : ""}</div>`;
      }).join("");
      return kopf(meins ? "Du wählst die Mission" : "Missionswahl", P.bis) +
        `<p class="mitte ${meins ? "" : "leise"}">${meins ? "Du liegst hinten, deshalb wählst du die nächste Mission." : `${c.helm(w.wer)} <b>${esc(c.name(w.wer))}</b> liegt hinten und wählt die nächste Mission.`}</p>${karten}`;
    }
    if (P.schritt === "wetten") {
      const M = R.MISSIONEN[P.gewaehlt] || { name: P.gewaehlt, kurz: "" };
      const tn = R.mitspieler(S).filter(p => c.da(p));
      const mein = P.wetten[c.PID], gratis = P.gratis[c.PID];
      const merk = P.runde + ":" + P.gewaehlt;
      if (wettMerker !== merk) { wettMerker = merk; tipp = null; einsatz = 0; }
      if (tipp === null && mein && mein.auf && !mein.verdeckt) { tipp = mein.auf; einsatz = mein.einsatz; }
      const abgegeben = tn.filter(p => P.wetten[p]).length;
      let h = kopf("Wetten", P.bis) + `<div class="missionskarte kompakt"><div><b>${esc(M.name)}</b><p class="leise klein">${esc(M.kurz)}</p></div></div>`;
      if (!ich) return h + `<p class="mitte leise">Die anderen wetten.</p>`;
      const maxE = Math.min(R.MAXWETTE, sp(c.PID).energie), q = R.wettQuote(P.gewaehlt);
      h += `<p class="mitte klein">Wer gewinnt? Richtig getippt gibt <b>${q.text}</b>${q.leicht ? " (hier gewinnt ein ganzes Team)" : ""}.${gratis ? ` <span class="gratis">Gratiswette: richtig getippt +${q.gratis} ⚡</span>` : ""}</p>
        <div class="tipps" role="group" aria-label="Tipp">${tn.map(p => `<button class="tippknopf ${tipp === p ? "an" : ""}" data-tipp="${esc(p)}" aria-pressed="${tipp === p}">${c.helm(p)}<small>${p === c.PID ? "ich" : esc(c.name(p))}</small></button>`).join("")}</div>
        <div class="einsaetze" role="group" aria-label="Einsatz">${Array.from({ length: R.MAXWETTE + 1 }, (_, n) => `<button class="einsatz ${einsatz === n ? "an" : ""}" data-einsatz="${n}" ${n > maxE ? "disabled" : ""} aria-pressed="${einsatz === n}">${n}</button>`).join("")}<span class="leise klein">⚡ Einsatz</span></div>
        <div class="reihe"><button class="knopf" id="wetteab" ${tipp ? "" : "disabled"}>${mein && mein.auf ? "Wette ändern" : "Wette abgeben"}</button><button class="knopf zweit" id="ohnewette">Ohne Wette</button></div>
        ${mein ? `<p class="mitte klein">${mein.auf ? `Deine Wette: <b>${esc(c.name(mein.auf))}</b> mit ${mein.einsatz} ⚡` : "Du wettest diesmal nicht."}</p>` : ""}`;
      return h + `<p class="leise klein mitte">Abgegeben: ${abgegeben} von ${tn.length}</p>`;
    }
    return "";
  }

  function standListe(c) {
    const S = c.S, P = S.partie, esc = c.esc;
    const pl = R.plaetze(S);
    const wartend = S.reihenfolge.filter(p => S.spieler[p] && S.spieler[p].wartet && c.da(p));
    return `<div class="karte-box"><h2>Stand</h2><ol class="stand">${pl.map(e => {
      const sp = S.spieler[e.pid], marken = [];
      if (P.alien === e.pid) marken.push("Alien");
      if (P.gratis[e.pid]) marken.push("Gratiswette");
      if (!c.da(e.pid)) marken.push("offline");
      return `<li class="${e.pid === c.PID ? "ich" : ""}"><span class="pl">${e.platz}.</span>${c.helm(e.pid)}<span class="nm">${esc(sp.name)}${marken.length ? `<small>${marken.join(" · ")}</small>` : ""}</span><span class="kr">${sp.kristalle}${kristall()}</span><span class="energie">${sp.energie}<i>⚡</i></span></li>`;
    }).join("")}</ol>${wartend.length ? `<p class="leise klein">Steigen nächste Runde ein: ${wartend.map(p => esc(S.spieler[p].name)).join(", ")}</p>` : ""}</div>`;
  }
  function legende() {
    return `<div class="legende"><h2>Was die Module machen</h2><ul>${Object.keys(R.FELD).map(k => `<li>${feldIcon(k)}<span><b>${R.FELD[k].name}</b> ${k === "L" ? "Hier starten alle." : R.FELD[k].text}</span></li>`).join("")}
      <li>${kristall()}<span><b>Händlerschiffe</b> Zwei Schiffe docken an. Wer an einem vorbeizieht oder darauf landet, kauft bis zu ${R.MAXKAUF} Sternkristalle für je ${R.PREIS} Energie. Sie bleiben eine Runde und fliegen dann weiter.</span></li></ul>
      <p class="leise klein">Nach dem Würfeln ziehst du mit einem Würfel oder mit beiden; wählen kannst du gleich nach dem Wurf. In der letzten Runde zählen Felder und Mission doppelt.
        Am Ende gibt es drei Bonus-Kristalle: Missionsheld (meiste Energie aus Missionen), Bester Tipper (meiste Energie aus Wetten) und Comeback (die meisten Plätze aufgeholt).
        Es gewinnt, wer die meisten Kristalle hat, bei Gleichstand entscheidet die Energie.</p></div>`;
  }

  // Aufbau: Brett und Entscheidung passen zusammen auf den Bildschirm, darunter Reiter für Stand, Logbuch und Module
  let reiter = "stand";
  function html(c) {
    const S = c.S, P = S.partie, esc = c.esc;
    const log = P.log.slice(-12).reverse().map(t => `<li>${esc(t)}</li>`).join("");
    const ich = S.spieler[c.PID], pl = R.plaetze(S).find(e => e.pid === c.PID);
    const werte = ich && pl ? `<span class="ichwert">${pl.platz}. · ${ich.energie}<i>⚡</i> · ${ich.kristalle}${kristall()}</span>` : "";
    const zuletzt = P.log.length ? `<span class="logzeile" aria-live="polite">${esc(P.log[P.log.length - 1])}</span>` : `<span class="logzeile"></span>`;
    const tab = (k, t) => `<button role="tab" class="reiterknopf ${reiter === k ? "an" : ""}" data-reiter="${k}" aria-selected="${reiter === k}">${t}</button>`;
    const final = P.runde >= P.runden, bst = P.schritt === "wuerfeln" ? effekt("runde:" + P.runde, 2600) : null;
    const banner = bst ? `<div class="rundenbanner ${final ? "final" : ""}" style="${bst}" aria-hidden="true"><b>${final ? "Letzte Runde!" : "Runde " + P.runde}</b><small>${final ? "Felder und Mission zählen doppelt" : P.runde === 1 ? "Alle würfeln" : "Die Händlerschiffe sind weitergeflogen"}</small></div>` : "";
    return banner + `<div class="brettseite">
        <div class="brettrahmen">${brettSvg(c)}${wurfBuehne(c)}</div>
        <div class="blickzeile">${werte}${zuletzt}<button class="link" id="zumStand" aria-label="Zum Stand">Stand ▾</button></div>
        <div class="karte-box panel">${panel(c)}</div>
      </div>
      <div class="reiter" id="reiter" role="tablist">${tab("stand", "Stand")}${tab("log", "Logbuch")}${tab("module", "Module")}</div>
      <div data-flaeche="stand" ${reiter === "stand" ? "" : "hidden"}>${standListe(c)}</div>
      <div data-flaeche="log" ${reiter === "log" ? "" : "hidden"}><div class="karte-box"><ul class="logbuch">${log}</ul></div></div>
      <div data-flaeche="module" ${reiter === "module" ? "" : "hidden"}>${legende()}</div>
      ${c.host ? `<button class="link" id="beenden">Partie vorzeitig beenden</button>` : ""}`;
  }

  // Siegerehrung als kleine Show: Bonus-Kristalle werden einzeln aufgedeckt, dann fährt das Podest hoch (mit Konfetti).
  // Die Zeiten laufen über das Neuzeichnen hinweg weiter (negative animation-delay).
  const EHRUNG = { start: 1.2, schritt: 2.4 };
  EHRUNG.sieg = n => EHRUNG.start + n * EHRUNG.schritt + 0.4;
  function ende(c) {
    const S = c.S, P = S.partie, esc = c.esc, es = P.endstand || [], eh = P.ehrung || [];
    const sieger = es.filter(e => e.platz === 1).map(e => e.pid);
    const key = "ende:" + es.map(e => e.pid).join(",");
    if (!(key in zuerst)) zuerst[key] = performance.now();
    const alt = (performance.now() - zuerst[key]) / 1000, d = t => `animation-delay:${(t - alt).toFixed(2)}s`;
    const SIEG = EHRUNG.sieg(eh.length);
    const bonus = eh.map((b, i) => { const t = EHRUNG.start + i * EHRUNG.schritt; return `<li class="aufdecken" style="${d(t)}"><div><b>${esc(b.titel)}</b><small>${esc(b.text)}${b.pids.length ? ` (${b.wert})` : ""}</small></div><span class="helme plopp" style="${d(t + 1.1)}">${b.pids.length ? b.pids.map(p => c.helm(p)).join("") : `<span class="leise klein">niemand</span>`}</span>${b.pids.length ? `<span class="kr plopp" style="${d(t + 1.3)}">+1${kristall()}</span>` : ""}</li>`; }).join("");
    const titel = (P.titel || []).map((t, i) => `<li class="aufdecken" style="${d(SIEG + 2 + i * 0.3)}"><div><b>${esc(t.titel)}</b><small>${esc(t.text)} (${t.wert})</small></div><span class="helme">${t.pids.map(p => c.helm(p)).join("")}</span></li>`).join("");
    const farben = ["#2EC4B6", "#FF7A2F", "#FFD23F", "#FF5C9A", "#A57BFF", "#4DA3FF", "#7BD957"];
    const konfetti = Array.from({ length: 34 }, (_, i) => `<span style="left:${(i * 37) % 100}%;background:${farben[i % farben.length]};${d(SIEG + (i % 9) * 0.12)};animation-duration:${(2.6 + (i % 5) * 0.35).toFixed(2)}s;--dreh:${(i % 2 ? 1 : -1) * (360 + (i % 4) * 180)}deg"></span>`).join("");
    return `<div class="ehrungsshow" id="ehrungsshow">
      <header class="missionstitel"><p class="etikett">Orbit · Siegerehrung</p><div class="ehrkopf"><h1 class="vorher" style="${d(SIEG)}">Und gewonnen hat …</h1><h1 class="nachher" style="${d(SIEG)}">${sieger.length > 1 ? "Gleichstand!" : esc(c.name(sieger[0])) + " gewinnt!"}</h1></div></header>
      <div class="podest aufsteigen" style="${d(SIEG)}">${sieger.map(p => `<span>${c.helm(p, "riesig")}<b>${esc(c.name(p))}</b></span>`).join("")}</div>
      <div class="karte-box"><h2>Bonus-Kristalle</h2><ul class="bonus">${bonus}</ul></div>
      <div class="karte-box aufdecken" style="${d(SIEG + 1)}"><h2>Endstand</h2><ol class="stand">${es.map(e => { const sp = S.spieler[e.pid] || { name: "?", kristalle: 0, energie: 0 }; return `<li class="${e.platz === 1 ? "erster" : ""} ${e.pid === c.PID ? "ich" : ""}"><span class="pl">${e.platz}.</span>${c.helm(e.pid)}<span class="nm">${esc(sp.name)}</span><span class="kr">${sp.kristalle}${kristall()}</span><span class="energie">${sp.energie}<i>⚡</i></span></li>`; }).join("")}</ol></div>
      ${titel ? `<div class="karte-box aufdecken" style="${d(SIEG + 1.8)}"><h2>Ehrentitel</h2><ul class="bonus">${titel}</ul></div>` : ""}
      ${alt < SIEG ? `<button class="link" id="ueberspringen">Überspringen</button>` : ""}
      <div class="konfetti" aria-hidden="true">${konfetti}</div>
      </div>
      ${c.host ? `<div class="unten"><button class="knopf" id="neuePartie">Neue Partie</button></div>` : `<p class="leise mitte">${esc(c.name(S.host))} startet die nächste Partie.</p>`}
      <button class="link" id="verlassen">Raum verlassen</button>`;
  }
  // Überspringen: Startzeit weit zurücksetzen, dann stehen alle Animationen am Ende
  function ehrungUeberspringen() {
    for (const k in zuerst) if (k.startsWith("ende:")) zuerst[k] = -1e9;
    const el = document.getElementById("ehrungsshow");
    if (el) el.querySelectorAll("[style*=animation-delay]").forEach(x => { x.style.animationDelay = "-60s"; });
    const u = document.getElementById("ueberspringen"); if (u) u.remove();
  }

  function binden(c) {
    const $ = id => document.getElementById(id);
    const gleitend = document.querySelectorAll("[data-nach]");
    if (gleitend.length) { gleitend.forEach(el => el.getBoundingClientRect()); requestAnimationFrame(() => gleitend.forEach(el => { el.style.transform = el.dataset.nach; })); }
    if ($("schuettelnErlauben")) $("schuettelnErlauben").onclick = async () => { await SN.erlauben(); const b = $("schuettelnErlauben"); if (b) b.remove(); };
    const wirf = () => {
      if ($("wurf")) { $("wurf").disabled = true; $("wurf").classList.add("rollt"); }
      if ($("hubwurf")) $("hubwurf").classList.add("schuettelt");
      gedrueckt = c.S.partie.runde; c.tun({ t: "wurf" });
    };
    if ($("wurf")) $("wurf").onclick = wirf;
    if ($("hubwurf")) $("hubwurf").onclick = () => { if (!$("wurf") || !$("wurf").disabled) wirf(); };
    document.querySelectorAll("[data-antwort]").forEach(b => b.onclick = () => { const w = b.dataset.antwort; c.tun({ t: "antwort", w: /^\d+$/.test(w) ? +w : w }); });
    document.querySelectorAll("[data-schritte]").forEach(b => b.onclick = () => {
      document.querySelectorAll("[data-schritte]").forEach(x => { x.classList.toggle("an", x === b); x.setAttribute("aria-pressed", x === b); });
      c.tun({ t: "schritte", n: +b.dataset.schritte });
    });
    document.querySelectorAll("[data-waehle]").forEach(b => b.onclick = () => c.tun({ t: "waehle", id: b.dataset.waehle }));
    const wettAnzeige = () => {
      document.querySelectorAll("[data-tipp]").forEach(x => { x.classList.toggle("an", x.dataset.tipp === tipp); x.setAttribute("aria-pressed", x.dataset.tipp === tipp); });
      document.querySelectorAll("[data-einsatz]").forEach(x => { x.classList.toggle("an", +x.dataset.einsatz === einsatz); x.setAttribute("aria-pressed", +x.dataset.einsatz === einsatz); });
      if ($("wetteab")) $("wetteab").disabled = !tipp;
    };
    document.querySelectorAll("[data-tipp]").forEach(b => b.onclick = () => { tipp = b.dataset.tipp; wettAnzeige(); });
    document.querySelectorAll("[data-einsatz]").forEach(b => b.onclick = () => { einsatz = +b.dataset.einsatz; wettAnzeige(); });
    if ($("wetteab")) $("wetteab").onclick = () => { if (tipp) c.tun({ t: "wette", auf: tipp, einsatz }); };
    if ($("ohnewette")) $("ohnewette").onclick = () => { tipp = null; einsatz = 0; c.tun({ t: "wette", auf: null, einsatz: 0 }); };
    document.querySelectorAll("[data-reiter]").forEach(b => b.onclick = () => {
      reiter = b.dataset.reiter;
      document.querySelectorAll("[data-reiter]").forEach(x => { x.classList.toggle("an", x === b); x.setAttribute("aria-selected", x === b); });
      document.querySelectorAll("[data-flaeche]").forEach(x => { x.hidden = x.dataset.flaeche !== reiter; });
    });
    if ($("zumStand")) $("zumStand").onclick = () => { const r = $("reiter"); if (r) r.scrollIntoView({ behavior: "smooth", block: "start" }); };
    if ($("beenden")) $("beenden").onclick = () => { if (confirm("Partie jetzt beenden und zur Siegerehrung?")) c.tun({ t: "beenden" }); };
    if ($("ueberspringen")) $("ueberspringen").onclick = () => { ehrungUeberspringen(); if (c.ueberspringen) c.ueberspringen(); };
    if ($("neuePartie")) $("neuePartie").onclick = () => c.tun({ t: "neuePartie" });
  }

  // Der ziehende Helm läuft Modul für Modul (ohne neu zu zeichnen)
  function bewegen(c) {
    const P = c.S && c.S.partie, z = P && P.zug;
    if (!z || z.stufe !== "laufen") return;
    const el = document.querySelector(`[data-fig="${z.pid}"]`);
    if (!el) return;
    const o = zugOrt(c), t = `translate(${f1(o[0])}px,${f1(o[1])}px)`;
    if (el.style.transform !== t) { el.style.transform = t; bahn["f:" + z.pid] = { von: t, nach: t, t0: 0, dauer: 0 }; }
    const w = document.querySelector(".brett .welt"), zt = zoomText(c);
    if (w && w.style.transform !== zt) { w.style.transform = zt; bahn.zoom = { von: zt, nach: zt, t0: 0, dauer: 0 }; }
  }

  W.ORBIT_BRETT = { EHRUNG, html, ende, binden, bewegen, wuerfel, kristall, feldIcon };
})();
