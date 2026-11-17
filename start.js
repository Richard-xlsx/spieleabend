// Startseite: Bereich „Abend“ (ein Raum für alle Spiele). Verbindung und Stand stehen in abend.js (window.ABEND).
(function () {
  const A = window.ABEND, box = document.getElementById("abend");
  if (!A || !box) return;
  const params = new URLSearchParams(location.search);
  const T = params.get("test") ? "-" + params.get("test") : "";
  const ls = {
    get(k) { try { return JSON.parse(localStorage.getItem(k + T)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k + T, JSON.stringify(v)); } catch (e) {} }
  };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const $ = id => document.getElementById(id);
  let toastTimer = null, letzte = "";

  function toast(t) {
    let el = $("toast");
    if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.textContent = t; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 3000);
  }
  function nameLesen() {
    const n = (($("aname") || {}).value || "").trim().slice(0, 20);
    if (!n) { toast("Bitte gib zuerst deinen Namen ein."); if ($("aname")) $("aname").focus(); return null; }
    ls.set("slf:name", n); A.nameGeaendert(); return n;
  }

  // Ohne Abend: eröffnen oder beitreten
  function ohneAbend() {
    const z = ls.get("abend:zuletzt"), frisch = z && z.code && Date.now() - z.um < 12 * 3600 * 1000;
    return `<div><h2>Gemeinsamer Abend</h2><p class="leise">Einmal beitreten, dann wählt einer die Spiele, und alle Handys springen von selbst mit.</p></div>
      <label class="feld">Dein Name<input id="aname" maxlength="20" value="${esc(A.name())}" autocomplete="nickname" placeholder="z. B. Richard"></label>
      <button class="knopf" id="eroeffnen">Abend eröffnen</button>
      <div class="oder">oder</div>
      <div class="reihe"><label class="feld" style="flex:1.2">Abendcode<input id="acode" maxlength="4" autocapitalize="characters" autocomplete="off" placeholder="z. B. K7M2"></label></div>
      <button class="knopf zweit" id="beitreten">Beitreten</button>
      ${frisch ? `<button class="link" id="wieder">Zurück in den Abend ${esc(z.code)}</button>` : ""}`;
  }

  // Im Abend
  function imAbend() {
    const s = A.stand, leute = s ? Object.keys(s.leute || {}) : [], on = p => s && (s.online || []).includes(p);
    const chef = s && s.leute && s.leute[s.leiter] ? s.leute[s.leiter].name : "Der Spielleiter";
    let qr = "";
    try { if (window.qrcode) { const q = qrcode(0, "M"); q.addData(A.link()); q.make(); qr = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); } } catch (e) {}
    let lage;
    if (!A.name()) lage = `<label class="feld">Dein Name<input id="aname" maxlength="20" autocomplete="nickname" placeholder="z. B. Lena"></label><button class="knopf" id="namesetzen">Weiter</button>`;
    else if (!A.leiter && !A.verbunden) lage = `<p class="hinweis">Verbinde mit dem Abend … ${s ? "" : "Ist das Handy des Spielleiters an und die Startseite oder ein Spiel offen?"}</p>`;
    else if (s && s.spiel) lage = `<div class="laeuft"><p class="hinweis">Gerade läuft <b>${esc(A.NAMEN[s.spiel] || s.spiel)}</b>.</p>
        ${A.leiter ? `<div class="reihe"><button class="knopf" id="holen">Zurück ins Spiel</button><button class="knopf zweit" id="allezurueck">Alle hierher holen</button></div>`
          : `<button class="knopf" id="holen">Mitspielen</button>`}</div>`;
    else lage = `<p class="hinweis">${A.leiter ? "Tippe unten auf ein Spiel. Alle Handys springen mit." : `<b>${esc(chef)}</b> wählt das nächste Spiel. Dein Handy springt dann von selbst hinein.`}</p>`;
    return `<div class="abendkopf"><div><p class="etikett">Abend</p><div class="code">${esc(A.code)}</div>
        <p class="leise" style="font-size:.85rem;margin-top:6px">${A.leiter ? "Du leitest den Abend." : "Spielleiter: " + esc(chef)}</p></div>
        ${qr ? `<div class="qr" aria-label="QR-Code zum Beitreten">${qr}</div>` : ""}</div>
      ${A.leiter ? `<div class="reihe"><button class="knopf zweit" id="teilen">Link teilen</button><button class="knopf zweit" id="kopieren">Link kopieren</button></div>` : ""}
      <ul class="leute">${leute.map(p => `<li><i class="punkt ${on(p) ? "an" : ""}"></i>${esc(s.leute[p].name || "?")}${p === s.leiter ? " <small>Spielleiter</small>" : ""}${p === A.pid ? " <small>du</small>" : ""}</li>`).join("")}</ul>
      ${lage}
      <button class="link" id="verlassen">${A.leiter ? "Abend beenden" : "Abend verlassen"}</button>`;
  }

  function zeigen() {
    const html = A.aktiv ? imAbend() : ohneAbend();
    document.body.classList.toggle("abend-leiter", A.aktiv && A.leiter);
    document.body.classList.toggle("abend-gast", A.aktiv && !A.leiter);
    box.classList.toggle("an", A.aktiv);
    if (html === letzte) return;
    // Eingabe nicht unter den Fingern wegnehmen
    const fokus = document.activeElement && box.contains(document.activeElement) && document.activeElement.tagName === "INPUT" ? document.activeElement.id : null;
    const werte = {}; box.querySelectorAll("input").forEach(i => { werte[i.id] = i.value; });
    letzte = html; box.innerHTML = html;
    box.querySelectorAll("input").forEach(i => { if (werte[i.id] != null) i.value = werte[i.id]; });
    if (fokus && $(fokus)) $(fokus).focus();
    binden();
  }
  function binden() {
    const on = (id, f) => { const el = $(id); if (el) el.onclick = f; };
    on("eroeffnen", () => { const n = nameLesen(); if (n) A.eroeffnen(n); });
    on("beitreten", () => {
      if (!nameLesen()) return;
      const c = (($("acode") || {}).value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (c.length !== 4) { toast("Der Abendcode hat 4 Zeichen."); $("acode").focus(); return; }
      A.beitreten(c);
    });
    on("wieder", () => { const z = ls.get("abend:zuletzt"); if (z) A.beitreten(z.code); });
    on("namesetzen", () => { if (nameLesen()) zeigen(); });
    on("holen", A.holen);
    on("allezurueck", () => A.zurueck());
    on("verlassen", () => { if (A.leiter && !confirm("Abend beenden? Die anderen kommen dann zur normalen Startseite.")) return; A.verlassen(); });
    on("teilen", () => { if (navigator.share) navigator.share({ title: "Spieleabend", text: "Komm in den Abend " + A.code, url: A.link() }).catch(() => {}); else kopieren(); });
    on("kopieren", kopieren);
    const ac = $("acode"); if (ac) ac.onkeydown = e => { if (e.key === "Enter") $("beitreten").click(); };
  }
  function kopieren() {
    try { navigator.clipboard.writeText(A.link()).then(() => toast("Link kopiert."), () => prompt("Link kopieren:", A.link())); } catch (e) { prompt("Link kopieren:", A.link()); }
  }

  // Spielkarten: Im Abend startet der Spielleiter das Spiel für alle; die anderen warten
  document.querySelectorAll("a.spiel").forEach(a => a.addEventListener("click", e => {
    if (!A.aktiv) return;
    e.preventDefault();
    const spiel = a.getAttribute("href").replace(/\/$/, "");
    if (A.leiter) {
      const s = A.stand;
      if (s && s.spiel && !confirm(`Gerade läuft ${A.NAMEN[s.spiel] || s.spiel}. Trotzdem alle zu ${A.NAMEN[spiel] || spiel} schicken?`)) return;
      A.waehle(spiel);
      toast(`${A.NAMEN[spiel] || spiel}: alle springen mit …`);
    } else {
      const s = A.stand;
      toast(s && s.leute && s.leute[s.leiter] ? s.leute[s.leiter].name + " wählt das Spiel." : "Der Spielleiter wählt das Spiel.");
    }
  }));

  A.beiAenderung(zeigen);
  zeigen();
  setInterval(zeigen, 2000);
})();
