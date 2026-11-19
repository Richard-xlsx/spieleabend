// Würfelpoker: Verbindung (Handy des Spielleiters ist der Server, PeerJS) und Oberfläche.
(function () {
  const V = window.WP;
  const app = document.getElementById("app");
  const PREFIX = "fmwwp-";
  const ZEICHEN = "ABCDEFGHJKLMNPRSTUVWXYZ23456789";
  const PEER_OPT = window.SPIELEABEND_PEER ? window.SPIELEABEND_PEER() : { debug: 0 };   // TURN-Server siehe ../netz.js
  const params = new URLSearchParams(location.search);
  const T = params.get("test") ? "-" + params.get("test") : "";
  const ls = {
    get(k) { try { return JSON.parse(localStorage.getItem(k + T)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k + T, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k + T); } catch (e) {} }
  };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let PID = ls.get("slf:pid"); if (!PID) { PID = Math.random().toString(36).slice(2, 10); ls.set("slf:pid", PID); }
  let name = ls.get("slf:name") || "";
  let code = (params.get("raum") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  let rolle = null, S = null, peer = null, hostConn = null, verbunden = false, offlineSeit = null, fehlerText = "";
  const conns = new Map();
  let retryTimer = null, token = 0, versuch = 0, hinweis = "", hinweisTimer = null, gewaehlt = null, gesehenWurf = -1;

  const hostId = ep => PREFIX + code + "-" + ep;
  const link = () => location.origin + location.pathname + "?raum=" + code;
  const testTeil = () => (params.get("test") ? "&test=" + params.get("test") : "");

  // ---------- Bildschirm wach halten ----------
  let wake = null;
  async function wachHalten() { try { if (navigator.wakeLock && !wake) { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => { wake = null; }); } } catch (e) {} }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { wachHalten(); if (rolle === "client" && !hostConn) verbindeZumHost(); } });
  document.addEventListener("click", wachHalten);

  // ---------- Spielleiter ----------
  function speichernHost() { ls.set("wp:host:" + code, S); }
  function hostStarten(s) {
    rolle = "host"; S = s; S.host = PID;
    if (S.spieler[PID]) S.spieler[PID].name = name || S.spieler[PID].name;
    speichernHost(); oeffneHostPeer(); geaendert();
  }
  function oeffneHostPeer() {
    if (peer) { try { peer.destroy(); } catch (e) {} }
    verbunden = false;
    const p = peer = new Peer(hostId(S.epoch), PEER_OPT);
    p.on("open", () => { if (p !== peer) return; verbunden = true; fehlerText = ""; render(); });
    p.on("connection", c => {
      c.on("data", m => vonClient(c, m));
      c.on("close", () => { for (const [k, x] of conns) if (x === c) conns.delete(k); geaendert(); });
      c.on("error", () => {});
    });
    p.on("disconnected", () => { if (p !== peer) return; verbunden = false; render(); setTimeout(() => { try { if (!p.destroyed) p.reconnect(); } catch (e) {} }, 2000); });
    p.on("error", e => {
      if (p !== peer) return;
      verbunden = false;
      fehlerText = e.type === "unavailable-id" ? "Der Raum ist noch belegt, gleich geht es weiter …" : "Keine Verbindung zum Vermittlungsdienst, neuer Versuch …";
      render();
      if (["unavailable-id", "network", "server-error", "socket-error", "socket-closed"].includes(e.type)) setTimeout(() => { if (p === peer) oeffneHostPeer(); }, 3000);
    });
  }
  function vonClient(c, m) {
    if (!m || !m.pid) return;
    if (m.t === "hallo") conns.set(m.pid, c);
    const r = V.aktion(S, m.pid, m);
    if (r.ok) S = r.S;
    else if (m.t !== "hallo") { try { c.send({ t: "fehler", text: r.fehler }); } catch (e) {} }
    geaendert();
  }
  function geaendert() {
    S.online = [PID].concat([...conns.keys()]);
    speichernHost();
    for (const [, c] of conns) { try { c.send({ t: "zustand", s: S }); } catch (e) {} }
    render();
  }

  // ---------- Mitspieler ----------
  function clientStarten() {
    rolle = "client";
    const k = ls.get("wp:kopie:" + code); if (k) S = k;
    if (peer) { try { peer.destroy(); } catch (e) {} }
    const p = peer = new Peer(undefined, PEER_OPT);
    p.on("open", () => { if (p === peer && !hostConn) verbindeZumHost(); });
    p.on("disconnected", () => { if (p !== peer) return; setTimeout(() => { try { if (!p.destroyed) p.reconnect(); } catch (e) {} }, 2000); });
    p.on("error", e => {
      if (p !== peer) return;
      if (e.type === "peer-unavailable") fehlschlag(token);
      else if (["network", "server-error", "socket-error", "socket-closed"].includes(e.type)) verloren();
    });
    render();
  }
  function verbindeZumHost() {
    if (!peer || peer.destroyed || !peer.open || (hostConn && hostConn.open)) return;
    clearTimeout(retryTimer);
    const t = ++token, basis = S ? S.epoch : 0, ep = basis + (versuch % 2);
    const c = peer.connect(hostId(ep), { serialization: "json", reliable: true });
    c.on("open", () => {
      if (t !== token) { try { c.close(); } catch (e) {} return; }
      hostConn = c; versuch = 0; verbunden = true; offlineSeit = null; fehlerText = "";
      c.send({ t: "hallo", pid: PID, name }); render();
    });
    c.on("data", m => {
      if (!m) return;
      if (m.t === "zustand") { S = m.s; ls.set("wp:kopie:" + code, S); render(); }
      else if (m.t === "fehler") zeigeHinweis(m.text);
    });
    c.on("close", () => { if (hostConn === c) { hostConn = null; verloren(); } });
    c.on("error", () => {});
    retryTimer = setTimeout(() => { if (t === token && hostConn !== c) { try { c.close(); } catch (e) {} fehlschlag(t); } }, window.SPIELEABEND_WARTEN || 12000);
  }
  function fehlschlag(t) {
    if (t !== token) return;
    token++; versuch++;
    if (!offlineSeit) offlineSeit = Date.now();
    verbunden = false; render();
    clearTimeout(retryTimer); retryTimer = setTimeout(verbindeZumHost, 2000);
  }
  function verloren() { verbunden = false; hostConn = null; if (!offlineSeit) offlineSeit = Date.now(); render(); fehlschlag(token); }
  function uebernehmen() {
    if (!S) return;
    const s = JSON.parse(JSON.stringify(S)); s.epoch += 1;
    ls.del("wp:kopie:" + code); clearTimeout(retryTimer); token++;
    if (hostConn) { try { hostConn.close(); } catch (e) {} hostConn = null; }
    hostStarten(s);
  }
  function fortsetzenAlsHost(gespeichert) {
    rolle = "pruefen"; render();
    const probe = new Peer(undefined, PEER_OPT); let fertig = false;
    const ende = alsClient => {
      if (fertig) return; fertig = true; try { probe.destroy(); } catch (e) {}
      if (alsClient) { ls.del("wp:host:" + code); ls.set("wp:kopie:" + code, gespeichert); clientStarten(); }
      else hostStarten(gespeichert);
    };
    probe.on("open", () => { const c = probe.connect(hostId(gespeichert.epoch + 1), { serialization: "json" }); c.on("open", () => ende(true)); });
    probe.on("error", () => ende(false));
    setTimeout(() => ende(false), 4000);
  }

  // ---------- Aktionen ----------
  function tun(m) {
    if (rolle === "host") { const r = V.aktion(S, PID, m); if (r.ok) { S = r.S; geaendert(); } else zeigeHinweis(r.fehler); }
    else if (hostConn && hostConn.open) { try { hostConn.send(Object.assign({ pid: PID }, m)); } catch (e) {} }
    else zeigeHinweis("Keine Verbindung zum Spielleiter.");
  }
  function zeigeHinweis(t) { if (!t) return; hinweis = t; render(); clearTimeout(hinweisTimer); hinweisTimer = setTimeout(() => { hinweis = ""; render(); }, 2500); }
  function neuesSpiel() {
    code = (window.ABEND && ABEND.neuerRaum()) || Array.from({ length: 4 }, () => ZEICHEN[Math.floor(Math.random() * ZEICHEN.length)]).join("");
    history.replaceState(null, "", "?raum=" + code + testTeil());
    hostStarten(V.neu(code, PID, name));
  }
  function verlassen() { ls.del("wp:host:" + code); ls.del("wp:kopie:" + code); location.href = location.pathname + (params.get("test") ? "?test=" + params.get("test") : ""); }
  const meinZug = () => !!(S && S.phase === "spiel" && V.darf(S, PID));

  // ---------- Würfeln ----------
  function halten(i) {
    if (!meinZug() || S.wurf === 0 || S.wurf >= 3) return;
    if (rolle === "client") { S.halten[i] = !S.halten[i]; render(); }   // sofort zeigen, der Spielleiter bestätigt
    tun({ t: "halten", i });
  }
  function wuerfeln() {
    if (!meinZug() || S.wurf >= 3) return;
    gewaehlt = null;
    tun({ t: "wuerfeln", halten: S.halten, nr: S.wurfNr });
  }
  function feldTippen(k) {
    if (!meinZug() || S.wurf === 0) return;
    const z = S.zettel[S.teilnehmer[S.dran]] || {};
    if (z[k] !== undefined) return;
    if (gewaehlt === k) { eintragen(); return; }
    gewaehlt = k; render();
  }
  function eintragen() {
    if (!gewaehlt || !meinZug()) return;
    const k = gewaehlt; gewaehlt = null;
    tun({ t: "eintragen", k });
  }

  // ---------- Oberfläche ----------
  const K = V.KATEGORIEN;
  const sp = p => (S && S.spieler[p]) || { name: "?", siege: 0 };
  const online = p => !!(S && S.online && S.online.includes(p));
  const katName = k => (K.find(c => c.k === k) || {}).name || k;
  const AUGEN = { 1: [[50, 50]], 2: [[29, 29], [71, 71]], 3: [[27, 27], [50, 50], [73, 73]], 4: [[29, 29], [71, 29], [29, 71], [71, 71]],
    5: [[27, 27], [73, 27], [50, 50], [27, 73], [73, 73]], 6: [[29, 25], [71, 25], [29, 50], [71, 50], [29, 75], [71, 75]] };
  function wuerfelBild(n, gross) {
    const augen = (AUGEN[n] || []).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9.5"/>`).join("");
    return `<svg class="wbild" viewBox="0 0 100 100" aria-hidden="true"><rect x="4" y="4" width="92" height="92" rx="20" class="w-k"/><rect x="4" y="4" width="92" height="92" rx="20" class="w-r"/>${n ? `<g class="w-a">${augen}</g>` : `<text x="50" y="66" text-anchor="middle" class="w-f">?</text>`}</svg>`;
  }
  function statusZeile() {
    if (rolle === "host") return verbunden ? "" : (fehlerText || "Raum wird geöffnet …");
    if (rolle === "client" && !verbunden) return S ? "Verbindung zum Spielleiter weg, verbinde neu …" : (fehlerText || (window.ABEND && ABEND.aktiv ? "" : "Verbinde mit Raum " + code + " …"));
    return "";
  }
  function render() {
    const st = statusZeile(), ueb = rolle === "client" && S && offlineSeit && Date.now() - offlineSeit > 20000;
    let h = `<div class="status" ${st ? "" : "hidden"}><span>${esc(st)}</span>${ueb ? `<button class="klein" id="uebernehmen">Spielleitung übernehmen</button>` : ""}</div>`;
    if (!rolle) h += code ? bildschirmName() : bildschirmStart();
    else if (rolle === "pruefen" || !S) h += `<div class="mitte"><p class="leise">${window.ABEND ? ABEND.warten() : "Verbinde …"}</p></div>`;
    else h += S.phase === "lobby" ? bildschirmLobby() : bildschirmSpiel();
    if (hinweis) h += `<div class="toast" role="status">${esc(hinweis)}</div>`;
    app.innerHTML = h;
    if (S) gesehenWurf = S.wurfNr;
    binden();
  }
  setInterval(() => { if (rolle === "client" && offlineSeit) render(); }, 5000);

  // Titelbild: Würfelbecher, aus dem fünf Würfel rollen
  function titelbild() {
    const w = (x, y, r, n, gold) => `<g transform="translate(${x} ${y}) rotate(${r})"><rect x="-17" y="-17" width="34" height="34" rx="8" fill="#FFF8EC" stroke="${gold ? "#F2C14E" : "#1A0910"}" stroke-width="${gold ? 3.5 : 2.4}"/>${AUGEN[n].map(([a, b]) => `<circle cx="${(a - 50) * .34}" cy="${(b - 50) * .34}" r="3.3" fill="#2A0F18"/>`).join("")}</g>`;
    return `<svg class="titelbild" viewBox="0 0 320 150" role="img" aria-label="Ein umgekippter Würfelbecher, aus dem fünf Würfel rollen, vier davon zeigen eine Sechs">
      <rect x="2" y="2" width="316" height="146" rx="20" fill="#3B1724"/>
      <ellipse cx="160" cy="128" rx="146" ry="12" fill="#2A0F18" opacity=".6"/>
      <g transform="rotate(68 66 92)"><path d="M40 60h60l-8 64H48z" fill="#8B2E3F" stroke="#1A0910" stroke-width="3" stroke-linejoin="round"/><path d="M38 56h64v9H38z" fill="#F2C14E" stroke="#1A0910" stroke-width="3" stroke-linejoin="round"/><path d="M52 76v36M70 76v36M88 76v36" stroke="#6E2232" stroke-width="3"/></g>
      ${w(132, 108, -14, 6, true)}${w(176, 96, 9, 6, true)}${w(218, 112, -6, 6, true)}${w(258, 92, 18, 6, true)}${w(292, 116, 30, 2)}
      </svg>`;
  }
  function bildschirmStart() {
    return `<header class="titel">${titelbild()}<h1>Würfelpoker</h1><p class="leise">Fünf Würfel, drei Würfe, ein Zettel mit 13 Feldern: Pasch, Full House, Straße und fünf gleiche. Wer am Ende die meisten Punkte hat, gewinnt. Jeder auf seinem Handy.</p></header>
      <label class="feld">Dein Name<input id="name" maxlength="20" value="${esc(name)}" autocomplete="nickname" placeholder="z. B. Richard"></label>
      <div class="karte-box"><h2>Neues Spiel</h2><p class="leise klein">Ab 1 Person, bis zu ${V.MAX} spielen mit, alle weiteren schauen zu.</p>
        <button class="knopf" id="neu">Raum erstellen</button></div>
      <div class="karte-box"><h2>Mitspielen</h2>
        <label class="feld">Raumcode<input id="code" maxlength="4" autocapitalize="characters" placeholder="z. B. K7M2"></label>
        <button class="knopf zweit" id="beitreten">Beitreten</button></div>
      <a class="link" href="../">Alle Spiele</a>`;
  }
  function bildschirmName() {
    return `<header class="titel"><h1>Würfelpoker</h1><p class="leise">Du wurdest in Raum <b>${esc(code)}</b> eingeladen.</p></header>
      <label class="feld">Dein Name<input id="name" maxlength="20" value="${esc(name)}" autocomplete="nickname" placeholder="z. B. Lena"></label>
      <button class="knopf" id="mitspielen">Mitspielen</button>`;
  }
  function regeln() {
    return `<ul class="regeln">
      <li>Wer dran ist, würfelt bis zu <b>dreimal</b>. Würfel antippen hält sie fest, die anderen werden neu gewürfelt.</li>
      <li>Danach muss ein freies Feld auf dem Zettel belegt werden: antippen, dann eintragen. Passt nichts, gibt es eben 0 Punkte.</li>
      <li><b>Oben</b> zählen nur die Augen der jeweiligen Zahl. Sind es oben zusammen mindestens ${V.BONUS_AB}, gibt es <b>${V.BONUS} Bonus</b>.</li>
      <li><b>Unten:</b> ${K.filter(c => !c.oben).map(c => `${c.name} (${c.info.replace(/^.*?: /, "")})`).join(", ")}.</li>
      <li>Nach 13 Runden ist der Zettel voll. Die höchste Summe gewinnt.</li></ul>`;
  }
  function bildschirmLobby() {
    const host = rolle === "host", da = S.reihenfolge.filter(p => S.spieler[p] && online(p)), n = Math.min(da.length, V.MAX);
    let qr = "";
    try { if (window.qrcode) { const q = qrcode(0, "M"); q.addData(link()); q.make(); qr = q.createSvgTag({ cellSize: 5, margin: 2, scalable: true }); } } catch (e) {}
    return `<header class="titel"><p class="etikett">Würfelpoker · Raumcode</p><div class="code">${esc(code)}</div></header>
      ${qr ? `<div class="qr">${qr}</div>` : ""}
      <div class="reihe"><button class="knopf zweit" id="teilen">Link teilen</button><button class="knopf zweit" id="kopieren">Link kopieren</button></div>
      <div class="karte-box"><h2>Im Raum (${da.length})</h2><ul class="spieler">${S.reihenfolge.filter(p => S.spieler[p]).map(p => {
        const i = da.indexOf(p);
        return `<li><i class="punkt ${online(p) ? "an" : ""}"></i>${esc(sp(p).name)}${p === S.host ? " <small>Spielleiter</small>" : ""}${p === PID ? " <small>du</small>" : ""}${sp(p).siege ? ` <small>· ${sp(p).siege} ${sp(p).siege === 1 ? "Sieg" : "Siege"}</small>` : ""}${i >= V.MAX ? " <small>schaut zu</small>" : ""}</li>`; }).join("")}</ul>
        <p class="leise klein">Höchstens ${V.MAX} spielen mit, alle weiteren schauen zu. Allein geht auch: dann zählt die eigene Bestleistung.</p></div>
      <div class="karte-box"><h2>So geht's</h2>${regeln()}</div>
      ${host ? `<div class="unten"><button class="knopf" id="start" ${n < 1 ? "disabled" : ""}>${n === 1 ? "Allein spielen" : `Spiel starten (${n} Spieler)`}</button></div>`
        : `<p class="leise mitte">Warte, bis ${esc(sp(S.host).name)} das Spiel startet.</p>`}
      <button class="link" id="verlassen">Raum verlassen</button>`;
  }

  function zettel() {
    const T_ = S.teilnehmer, dranP = S.teilnehmer[S.dran], zeigVorschlag = meinZug() && S.wurf > 0 && S.phase === "spiel";
    const kopf = `<tr><th></th>${T_.map(p => `<th class="${S.phase === "spiel" && p === dranP ? "dran" : ""} ${p === PID ? "ich" : ""}" title="${esc(sp(p).name)}"><span>${esc(sp(p).name)}</span></th>`).join("")}</tr>`;
    const zeile = c => {
      let h = `<tr><th class="kat" title="${esc(c.info)}">${c.name}<small>${esc(c.info.replace(/^.*?: /, ""))}</small></th>`;
      for (const p of T_) {
        const z = S.zettel[p] || {}, v = z[c.k], neu = S.letzter && S.letzter.pid === p && S.letzter.k === c.k;
        if (v !== undefined) h += `<td class="${v === 0 ? "null" : ""} ${neu ? "neu" : ""} ${p === PID ? "ich" : ""}">${v === 0 ? "–" : v}</td>`;
        else if (zeigVorschlag && p === dranP) {
          const pk = V.punkte(c.k, S.wuerfel);
          h += `<td class="frei ich"><button class="vorschlag ${gewaehlt === c.k ? "an" : ""} ${pk ? "" : "nix"}" data-k="${c.k}" aria-label="${c.name}: ${pk} Punkte">${pk}</button></td>`;
        } else h += `<td class="${p === PID ? "ich" : ""}"></td>`;
      }
      return h + `</tr>`;
    };
    const summe = (titel, f, cls) => `<tr class="${cls}"><th>${titel}</th>${T_.map(p => `<td class="${p === PID ? "ich" : ""}">${f(V.wertung(S.zettel[p]), S.zettel[p] || {})}</td>`).join("")}</tr>`;
    const obenFertig = z => K.filter(c => c.oben).every(c => z[c.k] !== undefined);
    return `<div class="zettelrahmen"><table class="zettel"><thead>${kopf}</thead><tbody>
      ${K.filter(c => c.oben).map(zeile).join("")}
      ${summe("Oben", w => w.oben, "summe")}
      ${summe(`Bonus <small>ab ${V.BONUS_AB}</small>`, (w, z) => w.bonus ? `+${w.bonus}` : obenFertig(z) ? "–" : `<small>noch ${V.BONUS_AB - w.oben}</small>`, "summe bonus")}
      ${K.filter(c => !c.oben).map(zeile).join("")}
      ${summe("Gesamt", w => `<b>${w.gesamt}</b>`, "summe gesamt")}
    </tbody></table></div>`;
  }

  function bildschirmSpiel() {
    const host = rolle === "host", dranP = S.teilnehmer[S.dran], ende = S.phase === "ende", dabei = S.teilnehmer.includes(PID);
    const mz = meinZug(), fuer = mz && dranP !== PID;
    if (gewaehlt && (!mz || S.wurf === 0 || (S.zettel[dranP] || {})[gewaehlt] !== undefined)) gewaehlt = null;
    let zeile;
    if (ende) {
      const s = S.sieger || [];
      zeile = s.length > 1 ? `<span><b>Gleichstand</b> zwischen ${s.map(p => esc(sp(p).name)).join(" und ")}!</span>`
        : `<span><b>${s[0] === PID ? "Du gewinnst" : esc(sp(s[0]).name) + " gewinnt"}</b> mit ${V.wertung(S.zettel[s[0]]).gesamt} Punkten!</span>`;
    } else if (mz) zeile = `<span><b>${fuer ? `Du würfelst für ${esc(sp(dranP).name)}` : "Du bist dran."}</b> ${S.wurf === 0 ? "Würfeln!" : S.wurf < 3 ? "Würfel antippen zum Festhalten, nochmal würfeln oder ein Feld wählen." : "Wähle ein Feld auf dem Zettel."}</span>`;
    else zeile = `<span>${esc(sp(dranP).name)} ist dran${online(dranP) ? "" : " (nicht verbunden)"}${S.wurf ? ` · ${S.wurf}. Wurf` : ""}.</span>`;
    const letzt = S.letzter && !ende ? `<p class="letzter">${S.letzter.pid === PID ? "Du" : esc(sp(S.letzter.pid).name)}: <b>${S.letzter.p}</b> bei ${katName(S.letzter.k)}</p>` : "";
    const kannHalten = mz && S.wurf > 0 && S.wurf < 3, rollt = S.wurfNr !== gesehenWurf;
    const feld = ende ? "" : `<div class="wuerfelfeld ${mz ? "meins" : ""}">${S.wuerfel.map((w, i) => `<button class="wuerfel ${S.halten[i] && S.wurf ? "gehalten" : ""} ${rollt && !S.halten[i] && w ? "rollt" : ""}" style="--i:${i}" data-w="${i}" ${kannHalten ? "" : "disabled"} aria-pressed="${!!S.halten[i]}" aria-label="Würfel ${i + 1}: ${w || "noch nicht gewürfelt"}${S.halten[i] ? ", festgehalten" : ""}">${wuerfelBild(w)}<small>${S.halten[i] && S.wurf ? "hält" : ""}</small></button>`).join("")}</div>`;
    const pk = gewaehlt ? V.punkte(gewaehlt, S.wuerfel) : 0;
    const knoepfe = mz && !ende ? `<div class="unten">
        ${gewaehlt ? `<button class="knopf" id="eintragen">${pk} ${pk === 1 ? "Punkt" : "Punkte"} bei ${katName(gewaehlt)} eintragen</button>` : ""}
        ${S.wurf < 3 ? `<button class="knopf ${gewaehlt ? "zweit" : ""}" id="wuerfeln">${S.wurf === 0 ? "Würfeln" : `Nochmal würfeln (${3 - S.wurf} übrig)`}</button>` : gewaehlt ? "" : `<button class="knopf" disabled>Feld auf dem Zettel wählen</button>`}
      </div>` : "";
    let endeBox = "";
    if (ende) {
      const rang = S.teilnehmer.slice().sort((a, b) => V.wertung(S.zettel[b]).gesamt - V.wertung(S.zettel[a]).gesamt);
      endeBox = `<div class="karte-box"><h2>Ergebnis</h2><ol class="rang">${rang.map(p => `<li class="${(S.sieger || []).includes(p) ? "sieg" : ""}"><span>${esc(sp(p).name)}${p === PID ? " <small>du</small>" : ""}</span><b>${V.wertung(S.zettel[p]).gesamt}</b>${S.teilnehmer.length > 1 ? `<small>${sp(p).siege} ${sp(p).siege === 1 ? "Sieg" : "Siege"}</small>` : ""}</li>`).join("")}</ol></div>`;
      if (host) endeBox += `<div class="unten"><button class="knopf" id="weiter">Neue Partie</button></div><button class="link" id="lobby">Zurück in die Lobby</button>`;
      else endeBox += `<p class="leise mitte">${esc(sp(S.host).name)} startet die nächste Partie.</p>`;
    }
    const offline = !ende && host && dranP !== PID && !online(dranP)
      ? `<p class="leise mitte klein">${esc(sp(dranP).name)} ist nicht verbunden. Du kannst für ${esc(sp(dranP).name)} würfeln oder <button class="link inline" id="raus">${esc(sp(dranP).name)} aus der Partie nehmen</button>.</p>` : "";
    return `<p class="etikett mitte">${ende ? "Partie vorbei" : `Runde ${Math.min(13, S.runde)} von 13`}${dabei ? "" : " · du schaust zu"}</p>
      <p class="zug ${mz ? "du" : ""}" aria-live="polite">${zeile}</p>
      ${letzt}${feld}${offline}${endeBox}${zettel()}${knoepfe}
      <details class="karte-box klein"><summary>Regeln</summary>${regeln()}</details>
      <button class="link" id="verlassen">Raum verlassen</button>`;
  }

  function binden() {
    const $ = id => document.getElementById(id);
    const nameAus = () => { const n = ($("name").value || "").trim().slice(0, 20); if (!n) { $("name").focus(); return null; } name = n; ls.set("slf:name", n); return n; };
    if ($("uebernehmen")) $("uebernehmen").onclick = uebernehmen;
    if ($("neu")) $("neu").onclick = () => { if (nameAus()) neuesSpiel(); };
    if ($("beitreten")) $("beitreten").onclick = () => {
      if (!nameAus()) return;
      const c = ($("code").value || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); if (c.length !== 4) { $("code").focus(); return; }
      code = c; location.replace("?raum=" + code + testTeil());   // neu laden: war ich hier Spielleiter, geht es als Spielleiter weiter
    };
    if ($("mitspielen")) $("mitspielen").onclick = () => { if (nameAus()) clientStarten(); };
    if ($("teilen")) $("teilen").onclick = () => { if (navigator.share) navigator.share({ title: "Würfelpoker", text: "Spiel mit! Raum " + code, url: link() }).catch(() => {}); else kopieren(); };
    if ($("kopieren")) $("kopieren").onclick = kopieren;
    if ($("start")) $("start").onclick = () => tun({ t: "start", teilnehmer: S.reihenfolge.filter(p => S.spieler[p] && online(p)) });
    if ($("weiter")) $("weiter").onclick = () => tun({ t: "weiter" });
    if ($("lobby")) $("lobby").onclick = () => tun({ t: "lobby" });
    if ($("verlassen")) $("verlassen").onclick = verlassen;
    if ($("wuerfeln")) $("wuerfeln").onclick = wuerfeln;
    if ($("eintragen")) $("eintragen").onclick = eintragen;
    if ($("raus")) $("raus").onclick = () => { const p = S.teilnehmer[S.dran]; if (confirm(`${sp(p).name} aus der Partie nehmen? Der Zettel geht verloren.`)) tun({ t: "raus", ziel: p }); };
    document.querySelectorAll("[data-w]").forEach(b => b.onclick = () => halten(+b.dataset.w));
    document.querySelectorAll("[data-k]").forEach(b => b.onclick = () => feldTippen(b.dataset.k));
  }

  function kopieren() {
    const b = document.getElementById("kopieren");
    const fertig = () => { if (b) { b.textContent = "Kopiert"; setTimeout(() => { b.textContent = "Link kopieren"; }, 1500); } };
    try { navigator.clipboard.writeText(link()).then(fertig, () => prompt("Link kopieren:", link())); } catch (e) { prompt("Link kopieren:", link()); }
  }

  // ---------- Start ----------
  if (typeof Peer === "undefined") { app.innerHTML = `<div class="mitte"><p>Die Verbindungsbibliothek konnte nicht geladen werden. Bitte Internetverbindung prüfen und neu laden.</p></div>`; return; }
  if (code) {
    const gespeichert = ls.get("wp:host:" + code);
    if (gespeichert) fortsetzenAlsHost(gespeichert);
    else if (name) clientStarten();
    else render();
  } else render();
  window.__wp = { get S() { return S; }, get rolle() { return rolle; }, get verbunden() { return verbunden; }, PID, tun: params.get("test") ? tun : undefined };
})();
