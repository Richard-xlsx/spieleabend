// Verlies zu dritt: Kampfbühne. Zeichnet Gegner (oben) und Helden (unten, von hinten) in ein SVG
// und spielt eine Kampfrunde als Animation ab (Ereignisliste S.letzte aus verlies-logic.js).
// zeichne(): ruhende Bühne mit angekündigten Gegnerzügen und antippbaren Zielen.
// abspielen(): Wiedergabe einer Runde, gleich auf allen Handys.
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const T = "#2A2118";
  const L = (w = 3, c = T) => `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
  const F = (c, w = 3) => `fill="${c}" stroke="${T}" stroke-width="${w}" stroke-linejoin="round"`;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ---------- Figuren (Ursprung = Mitte der Füße) ----------
  const schatten = (rx) => `<ellipse cx="0" cy="0" rx="${rx}" ry="${Math.round(rx / 4.5)}" fill="#000" opacity=".35"/>`;
  const HELD = {
    kaempfer: `${schatten(34)}<path d="M-14 0v-30h10v30zM4 0v-30h10v30z" ${F("#4A3426")}/>
      <path d="M-26 -84q-10 30-8 62h68q2-32-8-62z" ${F("#B83A2A")}/><path d="M-6 -78q-6 26-4 54M8 -78q4 26 2 54" ${L(2, "#7E2318")}/>
      <path d="M-24 -86q24-12 48 0" ${F("#8C8F9A")}/><circle cx="0" cy="-100" r="16" ${F("#9EA2AE")}/><path d="M0 -118v-14M-6 -128q6-10 12 0" ${F("#B83A2A")}/><path d="M-14 -96h28" ${L(2)}/>
      <path d="M-50 -76q-2 30 14 44 16-14 14-44z" ${F("#7A5434")}/><path d="M-36 -74v40M-48 -60h26" ${L(2.5, "#4A3426")}/>
      <g class="waffe"><path d="M30 -70l14 -62" ${L(5, "#D9DCE4")}/><path d="M30 -70l14 -62" ${L(1.5)}/><path d="M22 -76l18 6" ${L(4)}/><path d="M28 -68l-4 12" ${L(5, "#6B4A2E")}/></g>`,
    paladin: `${schatten(34)}<path d="M-14 0v-30h10v30zM4 0v-30h10v30z" ${F("#7D808C")}/>
      <path d="M-26 -84q-8 30-6 62h64q2-32-6-62z" ${F("#C9CCD6")}/><path d="M-14 -80v58h28v-58z" ${F("#F3EEE0")}/><path d="M0 -74v40M-9 -60h18" ${L(4, "#C99A2E")}/>
      <ellipse cx="-24" cy="-82" rx="13" ry="8" ${F("#A6A9B2")}/><ellipse cx="24" cy="-82" rx="13" ry="8" ${F("#A6A9B2")}/>
      <circle cx="0" cy="-98" r="15" ${F("#B8BCC6")}/><path d="M0 -113q8-12 14-6" ${L(4, "#E8E2D0")}/>
      <g class="waffe"><path d="M26 -72l20 -52" ${L(5, "#6B4A2E")}/><rect x="30" y="-140" width="30" height="18" rx="4" ${F("#9EA2AE")} transform="rotate(22 45 -131)"/></g>`,
    dieb: `${schatten(30)}<path d="M-12 0v-26h9v26zM3 0v-26h9v26z" ${F("#2E2638")}/>
      <path d="M-24 -78q-14 36-10 60h68q4-24-10-60z" ${F("#4A3F8A")}/><path d="M-4 -74q-4 28-2 54" ${L(2, "#2E2660")}/>
      <path d="M-22 -80q-2-34 22-40 24 6 22 40-22 8-44 0z" ${F("#3A3170")}/><path d="M-10 -108q10-8 20 0" ${L(2, "#2E2660")}/>
      <g class="waffe"><path d="M-30 -56l-14 24" ${L(4, "#D9DCE4")}/><path d="M-26 -62l-6 9" ${L(5, "#6B4A2E")}/><path d="M30 -56l14 24" ${L(4, "#D9DCE4")}/><path d="M26 -62l6 9" ${L(5, "#6B4A2E")}/></g>`,
    waldlaeufer: `${schatten(32)}<path d="M-13 0v-28h10v28zM3 0v-28h10v28z" ${F("#5A4232")}/>
      <path d="M-24 -80q-12 32-10 62h68q2-30-10-62z" ${F("#5C6B3A")}/><path d="M-30 -24q30 8 60 0" ${L(2, "#3E4A26")}/>
      <path d="M2 -114l18 -4 8 58-18 4z" ${F("#8A6A44")}/><path d="M8 -116l-2-14M14 -118v-14M20 -119l2-13" ${L(2.5, "#D9CDB6")}/><path d="M5 -128l-4-6M13 -130l-2-7M21 -130l1-7" ${L(3, "#B83A2A")}/>
      <path d="M-20 -82q20-10 40 0" ${F("#4A5A2C")}/><circle cx="0" cy="-96" r="14" ${F("#6B4A2E")}/><path d="M-12 -100q12-12 24 0" ${L(3, "#4A3426")}/>
      <g class="waffe"><path d="M-40 -134q-26 62 0 124" ${L(4.5, "#6B4A2E")}/><path d="M-40 -134v124" ${L(1.2, "#D9CDB6")}/></g>`,
    magierin: `${schatten(30)}<path d="M-22 -78q-14 40-14 78h72q0-38-14-78z" ${F("#3E5BB8")}/><path d="M-30 -20q30 10 60 0" ${L(2.5, "#F5CF4A")}/>
      <path d="M-20 -80q20-10 40 0" ${F("#2F4690")}/><circle cx="0" cy="-92" r="13" ${F("#3A2A22")}/>
      <ellipse cx="0" cy="-100" rx="26" ry="6" ${F("#2F4690")}/><path d="M-16 -102l22 -48 10 20-14 28z" ${F("#3E5BB8")}/><path d="M2 -138l3 6 6 1-4 4 1 6-6-3-5 3 1-6-4-4 6-1z" fill="#F5CF4A"/>
      <g class="waffe"><path d="M30 -6v-118" ${L(5, "#6B4A2E")}/><circle cx="30" cy="-128" r="8" fill="#FFE27A" stroke="${T}" stroke-width="2.5"/></g>`,
    heilerin: `${schatten(30)}<path d="M-24 -76q-12 40-12 76h72q0-36-12-76z" ${F("#3E8C62")}/><path d="M0 -70v68" ${L(2, "#2C6648")}/>
      <path d="M-22 -80q-4-36 22-42 26 6 22 42-22 8-44 0z" ${F("#4FB98A")}/><path d="M-8 -110q8-8 16 0" ${L(2, "#2C6648")}/>
      <g class="waffe"><path d="M-34 -4v-112" ${L(5, "#6B4A2E")}/><path d="M-34 -116q-16-4-16-18 14-2 16 12 2-14 16-12 0 14-16 18z" ${F("#7BE3A0")}/></g>`
  };
  // Waffenspitze (für Strahlen und Geschosse), relativ zum Fuß
  const SPITZE = { kaempfer: [44, -130], paladin: [50, -132], dieb: [40, -40], waldlaeufer: [-40, -72], magierin: [30, -128], heilerin: [-34, -126] };

  const GEG = {
    ratte: { h: 52, svg: `${schatten(46)}<path d="M-40 -4q4-40 40-40 32 0 40 22l18 6-18 8q-24 8-80 4z" ${F("#8C7A6B")}/><circle cx="34" cy="-22" r="3" fill="#E23B2E"/>
      <path d="M-40 -6q-30 4-36-16" ${L(3.5, "#C99A8A")}/><path d="M18 -42q6-12 14-6" ${F("#C99A8A", 2.5)}/><path d="M-16 -2v6M10 -2v6" ${L(4)}/><path d="M52 -14l10-2M52 -10l10 2" ${L(1.5)}/>` },
    spinne: { h: 72, svg: `${schatten(50)}${[-1, 1].map(s => [0, 1, 2, 3].map(i => `<path d="M${s * 10} ${-34 + i * 4} q${s * (26 + i * 8)} ${-24 + i * 6} ${s * (40 + i * 5)} ${30 - i * 2}" ${L(4.5, "#7A6352")}/>`).join("")).join("")}
      <ellipse cx="0" cy="-30" rx="26" ry="20" ${F("#3A2E26")}/><path d="M-10 -40q10-8 20 0M-14 -28q14-8 28 0" ${L(2, "#5A4A3E")}/><circle cx="0" cy="-54" r="13" ${F("#3A2E26")}/>
      <circle cx="-5" cy="-56" r="3" fill="#E23B2E"/><circle cx="5" cy="-56" r="3" fill="#E23B2E"/><circle cx="-9" cy="-50" r="2" fill="#E23B2E"/><circle cx="9" cy="-50" r="2" fill="#E23B2E"/>
      <path d="M-4 -44l-2 7M4 -44l2 7" ${L(2.5, "#C9C1B0")}/>` },
    goblin: { h: 104, svg: `${schatten(36)}<path d="M-16 0v-30h12v30zM4 0v-30h12v30z" ${F("#4A3426")}/>
      <path d="M-22 -30q-4-34 22-40 26 6 22 40z" ${F("#7C8F64")}/><path d="M-22 -38h44" ${L(5, "#6B4A2E")}/>
      <circle cx="0" cy="-82" r="20" ${F("#7C8F64")}/><path d="M-18 -86l-24-12 18 20M18 -86l24-12-18 20" ${F("#7C8F64")}/>
      <circle cx="-7" cy="-84" r="3" fill="#E23B2E"/><circle cx="7" cy="-84" r="3" fill="#E23B2E"/><path d="M-8 -72l4 3 4-3 4 3 4-3" ${L(2)}/>
      <g class="waffe"><path d="M22 -52l24-30" ${L(5, "#6B4A2E")}/><path d="M42 -86l10 10" ${L(4, "#A6A9B2")}/></g>` },
    schamane: { h: 108, svg: `${schatten(36)}<path d="M-24 0q-2-40 24-46 26 6 24 46z" ${F("#5B4A6E")}/>
      <circle cx="0" cy="-74" r="19" ${F("#7C8F64")}/><path d="M-17 -78l-22-10 16 18M17 -78l22-10-16 18" ${F("#7C8F64")}/>
      <path d="M-20 -84q20-34 40 0" ${F("#5B4A6E")}/><circle cx="-6" cy="-74" r="3" fill="#F5CF4A"/><circle cx="6" cy="-74" r="3" fill="#F5CF4A"/>
      <g class="waffe"><path d="M34 0v-100" ${L(4.5, "#6B4A2E")}/><circle cx="34" cy="-104" r="8" ${F("#3E7A55")}/><circle cx="34" cy="-104" r="3" fill="#BFF5D0"/></g>` },
    skelett: { h: 124, svg: `${schatten(34)}<circle cx="0" cy="-104" r="17" ${F("#EDE4D0")}/><circle cx="-6" cy="-104" r="4" fill="${T}"/><circle cx="6" cy="-104" r="4" fill="${T}"/><path d="M-4 -93h8" ${L(2)}/>
      <path d="M0 -87v40M-16 -78q16 7 32 0M-16 -68q16 7 32 0M-14 -58q14 6 28 0M0 -47l-14 47M0 -47l14 47M0 -82l-26 24M0 -82l26 18" ${L(4, "#EDE4D0")}/>
      <path d="M0 -87v40M0 -47l-14 47M0 -47l14 47" ${L(1.2)}/>
      <g class="waffe"><path d="M26 -64l22 -40" ${L(4.5, "#A6A9B2")}/><path d="M22 -70l10 6" ${L(4)}/></g>` },
    ork: { h: 142, svg: `${schatten(56)}<path d="M-26 0v-40h18v40zM8 0v-40h18v40z" ${F("#4A3426")}/>
      <path d="M-40 -40q-6-50 40-62 46 12 40 62z" ${F("#5E7350")}/><path d="M-36 -46h72" ${L(7, "#6B4A2E")}/><rect x="-7" y="-51" width="14" height="10" rx="2" ${F("#C99A2E")}/>
      <path d="M-40 -88q-22 10-24 40" ${L(13, "#5E7350")}/><path d="M-12 -98q-10-30 12-36 22 6 12 36z" ${F("#5E7350")}/>
      <circle cx="0" cy="-122" r="22" ${F("#5E7350")}/><path d="M-14 -132l10 5M14 -132l-10 5" ${L(3.5)}/>
      <circle cx="-8" cy="-124" r="3.5" fill="#E23B2E"/><circle cx="8" cy="-124" r="3.5" fill="#E23B2E"/><path d="M-10 -108v-8M10 -108v-8" ${L(4.5, "#EDE4D0")}/><path d="M-8 -110q8 4 16 0" ${L(2)}/>
      <g class="waffe"><path d="M40 -88q14 6 16 30" ${L(13, "#5E7350")}/><path d="M56 -40v-80" ${L(5, "#6B4A2E")}/><path d="M56 -118q28 4 26 30-14-10-26-8z" ${F("#A6A9B2")}/></g>` },
    koenig: { h: 152, svg: `${schatten(58)}<path d="M-44 0q-6-74 44-86 50 12 44 86z" ${F("#3A2E26")}/><path d="M-30 -10q30 10 60 0" ${L(3, "#7A3FA0")}/>
      <path d="M-40 -66q40-18 80 0" ${F("#5B3A6E")}/><circle cx="0" cy="-104" r="22" ${F("#EDE4D0")}/>
      <circle cx="-8" cy="-106" r="5" fill="#3E7A55"/><circle cx="8" cy="-106" r="5" fill="#3E7A55"/><circle cx="-8" cy="-106" r="2" fill="#BFF5D0"/><circle cx="8" cy="-106" r="2" fill="#BFF5D0"/>
      <path d="M-6 -92h12M-4 -88v4M0 -88v4M4 -88v4" ${L(2)}/>
      <path d="M-20 -124l4-18 8 10 8-14 8 14 8-10 4 18z" ${F("#E8C24A")}/><circle cx="0" cy="-132" r="3" fill="#B83A2A"/>
      <g class="waffe"><path d="M44 -10v-110" ${L(5, "#D9CDB6")}/><circle cx="44" cy="-124" r="10" ${F("#EDE4D0")}/><circle cx="40" cy="-126" r="2.5" fill="${T}"/><circle cx="48" cy="-126" r="2.5" fill="${T}"/></g>` }
  };
  // Elite: Zeichnung des Grundgegners plus Kennzeichen (Krone, Helm, Sanduhr), etwas größer
  GEG.orkhaeuptling = { h: 156, svg: `<g transform="scale(1.08)">${GEG.ork.svg}<path d="M-18 -138l2-16 8 9 8-14 8 14 8-9 2 16z" ${F("#C99A2E")}/><circle cx="0" cy="-142" r="2.5" fill="#B83A2A"/></g>` };
  GEG.knochenwaechter = { h: 138, svg: `<g transform="scale(1.1)">${GEG.skelett.svg}<path d="M-19 -106q0-26 19-26 19 0 19 26z" ${F("#8A8F99")}/><path d="M0 -132q6-14 18-12" ${L(4, "#B83A2A")}/><path d="M-30 -82l12-6 4 10-12 6zM30 -82l-12-6-4 10 12 6z" ${F("#8A8F99", 2)}/></g>` };
  GEG.spinnenmutter = { h: 96, svg: `<g transform="scale(1.35)">${GEG.spinne.svg}<path d="M-5 -38h10l-5 7zM-5 -24h10l-5-7z" fill="#E23B2E"/></g>` };
  // Kerker: neue Gegner
  const arm = (d, c, w = 9) => `<path d="${d}" ${L(w + 4)}/><path d="${d}" ${L(w, c)}/>`;
  GEG.schwarm = { h: 40, svg: `<g transform="scale(.72)">${GEG.ratte.svg.replace("#8C7A6B", "#6E5E52")}</g>` };
  GEG.langfinger = { h: 98, svg: `${schatten(32)}<path d="M-14 0v-26h10v26zM4 0v-26h10v26z" ${F("#3A2E26")}/>
      <path d="M-36 -66q-14 8-10 32 12 8 24 0 4-24-14-32z" ${F("#C79A5B")}/><path d="M-30 -68l5 7" ${L(2.5)}/><circle cx="-26" cy="-40" r="3.5" ${F("#E8C24A", 1.5)}/>
      <path d="M-20 -26q-4-32 20-38 24 6 20 38z" ${F("#4A3F5A")}/>
      <circle cx="0" cy="-76" r="17" ${F("#7C8F64")}/><path d="M-15 -80l-22-10 16 16M15 -80l22-10-16 16" ${F("#7C8F64")}/>
      <path d="M-18 -80q0-26 18-26 18 0 18 26-18-8-36 0z" ${F("#4A3F5A")}/>
      <circle cx="-6" cy="-75" r="2.6" fill="#F5CF4A"/><circle cx="6" cy="-75" r="2.6" fill="#F5CF4A"/><path d="M-6 -66q6 4 12 0" ${L(2)}/>
      <g class="waffe"><path d="M20 -42l16-20" ${L(4, "#D9DCE4")}/><path d="M17 -38l5-6" ${L(5, "#6B4A2E")}/></g>` };
  GEG.bogenschuetze = { h: 124, svg: `${schatten(34)}<path d="M8 -96l14-5 7 34-14 5z" ${F("#6B4A2E", 2.5)}/><path d="M12 -98l-2-10M18 -100v-10" ${L(2.5, "#D9CDB6")}/>
      <circle cx="0" cy="-104" r="17" ${F("#EDE4D0")}/><path d="M-18 -104q0-26 18-26 18 0 18 26q-8-12-18-12-10 0-18 12z" ${F("#5A5560", 2.5)}/>
      <circle cx="-6" cy="-102" r="4" fill="${T}"/><circle cx="6" cy="-102" r="4" fill="${T}"/><path d="M-4 -92h8" ${L(2)}/>
      <path d="M0 -87v40M-16 -78q16 7 32 0M-16 -68q16 7 32 0M-14 -58q14 6 28 0M0 -47l-14 47M0 -47l14 47M0 -82l-30 0M0 -82l20 16" ${L(4, "#EDE4D0")}/>
      <path d="M0 -87v40M0 -47l-14 47M0 -47l14 47" ${L(1.2)}/>
      <g class="waffe"><path d="M-32 -124q-24 42 0 84" ${L(4.5, "#6B4A2E")}/><path d="M-32 -124v84" ${L(1.2, "#D9CDB6")}/></g>` };
  GEG.ghul = { h: 118, svg: `${schatten(42)}<path d="M-18 0l4-34h10l-2 34zM6 0l2-34h10l4 34z" ${F("#6F7A64")}/>
      <path d="M-30 -34q-8-48 32-60 34 10 30 60z" ${F("#8A9A7A")}/><path d="M-12 -62q12 6 24 0M-14 -52q14 6 28 0" ${L(2, "#5A6650")}/>
      <path d="M-30 -36h62l-6 12-8-7-8 9-8-9-8 9-8-8-8 7z" ${F("#4A3E48", 2)}/>
      ${arm("M-24 -80q-24 20-26 56", "#8A9A7A")}<path d="M-54 -24l-4 9M-50 -22v10M-46 -24l4 9" ${L(2.5, "#EDE4D0")}/>
      <circle cx="6" cy="-96" r="18" ${F("#8A9A7A")}/><path d="M-6 -106l8 4M18 -106l-8 4" ${L(3)}/>
      <circle cx="0" cy="-98" r="3.2" fill="#BFF5D0"/><circle cx="12" cy="-98" r="3.2" fill="#BFF5D0"/><path d="M-3 -86l3 4 3-4 3 4 3-4 3 4" ${L(2)}/>
      <g class="waffe">${arm("M30 -78q22 20 22 54", "#8A9A7A")}<path d="M48 -24l-4 9M52 -22v10M56 -24l4 9" ${L(2.5, "#EDE4D0")}/></g>` };
  GEG.kerkerwaerter = { h: 150, svg: `${schatten(56)}<path d="M-26 0v-40h18v40zM8 0v-40h18v40z" ${F("#4A4E58")}/>
      ${arm("M-46 -88q-14 24-8 48", "#5A5E68", 12)}
      <path d="M-40 -40q-6-54 40-64 46 10 40 64z" ${F("#7D808C")}/><path d="M-20 -94q20 10 40 0M-24 -76q24 10 48 0" ${L(2.5, "#5A5E68")}/>
      <path d="M-40 -42h80" ${L(7, "#6B4A2E")}/><circle cx="-18" cy="-30" r="8" ${L(3, "#C99A2E")}/><path d="M-22 -24l-3 13M-15 -23l3 12M-18 -22v14" ${L(3, "#C99A2E")}/>
      <ellipse cx="-36" cy="-96" rx="17" ry="10" ${F("#A6A9B2")}/><ellipse cx="36" cy="-96" rx="17" ry="10" ${F("#A6A9B2")}/>
      <path d="M-22 -104q0-40 22-40 22 0 22 40z" ${F("#A6A9B2")}/><path d="M-17 -118h34" ${L(5)}/><circle cx="-7" cy="-118" r="2" fill="#E23B2E"/><circle cx="7" cy="-118" r="2" fill="#E23B2E"/>
      <path d="M0 -144v-8" ${L(4)}/><path d="M-22 -104h44" ${L(3)}/>
      <g class="waffe">${arm("M46 -88q12 22 8 46", "#5A5E68", 12)}<path d="M54 -44q26 2 30-30 4-24-8-44" ${L(5, "#8A8F99")} stroke-dasharray="6 3"/><circle cx="76" cy="-122" r="10" ${F("#4A4E58")}/><path d="M68 -130l-4-4M84 -130l4-4M76 -133v-5" ${L(3)}/></g>` };
  GEG.totenbeschwoerer = { h: 152, svg: `${schatten(42)}<path d="M-36 0q-4-72 36-94 40 22 36 94z" ${F("#2E2638")}/><path d="M-18 0q0-40 18-62 18 22 18 62" ${L(2, "#5B3A6E")}/><path d="M-36 -3q36 9 72 0" ${L(3.5, "#3E7A55")}/>
      ${arm("M-24 -66q-16-10-22-30", "#2E2638")}<path d="M-48 -98l-5-8M-46 -100v-9M-43 -99l4-8" ${L(2.2, "#EDE4D0")}/><circle cx="-47" cy="-112" r="8" fill="#7BE3A0" opacity=".55"/>
      <path d="M-22 -88q-2-40 22-44 24 4 22 44-22 10-44 0z" ${F("#3A2E48")}/><ellipse cx="0" cy="-96" rx="12" ry="14" fill="#120E18"/>
      <circle cx="-5" cy="-98" r="2.8" fill="#7BE3A0"/><circle cx="5" cy="-98" r="2.8" fill="#7BE3A0"/>
      <g class="waffe"><path d="M36 0v-126" ${L(5, "#3A2E26")}/><circle cx="36" cy="-130" r="10" ${F("#EDE4D0")}/><circle cx="32" cy="-132" r="2.5" fill="${T}"/><circle cx="40" cy="-132" r="2.5" fill="${T}"/>
      <path d="M36 -141c-9-8-3-18 0-24 4 7 9 15 0 24z" fill="#7BE3A0" stroke="${T}" stroke-width="2"/></g>` };
  // Spinnengrotte
  GEG.brut = { h: 44, svg: `<g transform="scale(.6)">${GEG.spinne.svg.replace(/#3A2E26/g, "#5A4A3E")}</g>` };
  GEG.weberin = { h: 80, svg: `<path d="M0 -150v96" ${L(1.5, "#D8E8DF")}/><g transform="scale(1.05)">${GEG.spinne.svg.replace(/#3A2E26/g, "#D8CFC0").replace(/#7A6352/g, "#A89C88")}</g>` };
  GEG.spinnenmutter.svg = GEG.spinnenmutter.svg.replace("</g>", "") + `<circle cx="-14" cy="-6" r="6" ${F("#F3E6CC", 2)}/><circle cx="16" cy="-4" r="5" ${F("#F3E6CC", 2)}/></g>`;
  GEG.koenigin = { h: 150, svg: `<g transform="scale(1.9)">${GEG.spinne.svg.replace(/#3A2E26/g, "#4A2E5A").replace(/#7A6352/g, "#6A4A6E")}</g>
      <path d="M-20 -118l3-18 8 9 9-14 9 14 8-9 3 18z" ${F("#E8C24A")}/><circle cx="0" cy="-124" r="2.5" fill="#B83A2A"/>` };
  GEG.pilzling = { h: 76, svg: `${schatten(30)}<path d="M-12 0v-10h8v10zM4 0v-10h8v10z" ${F("#CFC2A8")}/>
      <path d="M-16 -8q-4-30 16-34 20 4 16 34z" ${F("#E8DCC4")}/><circle cx="-6" cy="-24" r="2.5" fill="${T}"/><circle cx="6" cy="-24" r="2.5" fill="${T}"/><path d="M-4 -16q4 3 8 0" ${L(2)}/>
      <path d="M-38 -40q38-54 76 0q-38 8-76 0z" ${F("#C2492E")}/><circle cx="-18" cy="-52" r="5" fill="#F3E6CC"/><circle cx="4" cy="-64" r="6" fill="#F3E6CC"/><circle cx="20" cy="-50" r="4" fill="#F3E6CC"/>` };
  const fledermaus = (x, y, k) => `<g transform="translate(${x} ${y}) scale(${k})"><path d="M-4 0Q-16-14-32-8Q-24-2-26 6Q-16 0-10 8Q-6 2-4 4z" ${F("#3A2E3E", 2)}/><path d="M4 0Q16-14 32-8Q24-2 26 6Q16 0 10 8Q6 2 4 4z" ${F("#3A2E3E", 2)}/>
      <ellipse rx="7" ry="9" ${F("#4A3E4E", 2)}/><path d="M-5-7l-2-7 5 3M5-7l2-7-5 3" ${F("#4A3E4E", 1.5)}/><circle cx="-3" cy="-2" r="1.8" fill="#E23B2E"/><circle cx="3" cy="-2" r="1.8" fill="#E23B2E"/></g>`;
  GEG.fledermaus = { h: 110, svg: `${schatten(34)}${fledermaus(-28, -66, 1.1)}${fledermaus(26, -92, 1.2)}<g class="waffe">${fledermaus(4, -44, 1.15)}</g>` };
  GEG.schleim = { h: 62, svg: `${schatten(42)}<path d="M-40 0q-6-36 20-50 20-12 40 0 26 14 20 50z" fill="#7BCF5A" fill-opacity=".88" stroke="${T}" stroke-width="3"/>
      <ellipse cx="-16" cy="-38" rx="8" ry="5" fill="#E9FFD9" opacity=".6"/><circle cx="-10" cy="-26" r="4" fill="${T}"/><circle cx="10" cy="-26" r="4" fill="${T}"/><path d="M-8 -14q8 6 16 0" ${L(2.5)}/>
      <circle cx="18" cy="-12" r="3" fill="none" stroke="#3E7A2E" stroke-width="1.5"/><circle cx="-22" cy="-10" r="2" fill="none" stroke="#3E7A2E" stroke-width="1.5"/>` };
  GEG.hoehlentroll = { h: 152, svg: `${schatten(60)}<path d="M-28 0v-36h20v36zM8 0v-36h20v36z" ${F("#5E6E52")}/>
      ${arm("M-44 -96q-22 30-20 64", "#7C8F64", 14)}
      <path d="M-46 -36q-10-64 46-76 56 12 46 76z" ${F("#7C8F64")}/><path d="M-24 -52q24 14 48 0" ${L(2.5, "#5E6E52")}/><path d="M-40 -38h80l-8 16h-64z" ${F("#6B4A2E", 2.5)}/>
      <path d="M-40 -102q8-8 16 0M24 -102q8-8 16 0" ${L(3, "#3E7A55")}/>
      <circle cx="0" cy="-118" r="18" ${F("#7C8F64")}/><path d="M-4 -120q4 10 8 0" ${L(2.5)}/><circle cx="-7" cy="-124" r="2.5" fill="#E8C24A"/><circle cx="7" cy="-124" r="2.5" fill="#E8C24A"/><path d="M-8 -106v-6M8 -106v-6" ${L(3.5, "#EDE4D0")}/>
      <g class="waffe">${arm("M44 -96q16 24 14 48", "#7C8F64", 14)}<path d="M58 -48l14-80" ${L(9, "#6B4A2E")}/><ellipse cx="74" cy="-132" rx="13" ry="20" ${F("#7A5434")}/></g>` };
  // Glutschlund
  GEG.kobold = { h: 84, svg: `${schatten(26)}<path d="M-10 0v-18h7v18zM3 0v-18h7v18z" ${F("#7A2E1E")}/>
      <path d="M14 -20q18 0 16-18l4-4h-6" ${L(3, "#D9583B")}/><path d="M-16 -18q-2-26 16-30 18 4 16 30z" ${F("#D9583B")}/>
      <circle cx="0" cy="-58" r="15" ${F("#D9583B")}/><path d="M-10 -68l-6-12 10 6M10 -68l6-12-10 6" ${F("#3A2E26", 2)}/>
      <circle cx="-5" cy="-60" r="2.6" fill="#FFE27A"/><circle cx="5" cy="-60" r="2.6" fill="#FFE27A"/><path d="M-6 -51q6 4 12 0" ${L(2)}/>
      <g class="waffe"><path d="M-22 -34c-8-6-4-14 0-18 2 6 6 8 4 14 4-2 6-6 4-10 6 6 4 14-2 16z" fill="#FF9A3C" stroke="${T}" stroke-width="2"/></g>` };
  GEG.schnecke = { h: 84, svg: `${schatten(54)}<path d="M-52 0q-4-16 18-18h52q18-2 24-22 4-12 14-12 10 2 8 14-4 24-14 38z" ${F("#C2603A")}/>
      <path d="M52 -50l-4-16M60 -48l4-16" ${L(2.5)}/><circle cx="48" cy="-68" r="3.5" ${F("#FFE27A", 1.5)}/><circle cx="64" cy="-66" r="3.5" ${F("#FFE27A", 1.5)}/>
      <circle cx="-8" cy="-44" r="34" ${F("#3A3036")}/><path d="M-28 -44a20 20 0 1 1 20 20a12 12 0 1 1-10-14a5 5 0 1 1 6 6" ${L(3.5, "#FF6A2A")}/>
      <g class="waffe"><path d="M66 -30l8 2" ${L(1)}/></g>` };
  GEG.salamander = { h: 60, svg: `${schatten(56)}<path d="M-56 -10q-22-2-34-16 18 4 34 6" ${F("#C2492E", 2.5)}/>
      <path d="M-34 -10l-8 10M-10 -8l6 10M20 -8l-6 10M38 -10l8 10" ${L(5, "#A8402A")}/>
      <path d="M-60 -12q10-26 50-28 40-2 60 10 14 2 22 10-8 10-24 10-40 10-108-2z" ${F("#D9583B")}/>
      <path d="M-26 -36q2-10 6-14 2 6 6 8 0-8 4-12 4 8 4 16" fill="#FF9A3C" stroke="${T}" stroke-width="2"/>
      <circle cx="-20" cy="-24" r="4" fill="#FFB547"/><circle cx="4" cy="-28" r="3.5" fill="#FFB547"/><circle cx="26" cy="-24" r="3" fill="#FFB547"/><circle cx="58" cy="-22" r="3" fill="#FFE27A" stroke="${T}" stroke-width="1.5"/>
      <g class="waffe"><path d="M70 -16l8 0" ${L(2, "#E23B2E")}/></g>` };
  GEG.orkschamane = { h: 134, svg: `${schatten(44)}<path d="M-34 0q-4-60 34-74 38 14 34 74z" ${F("#6B4A3A")}/><path d="M-30 -40h60" ${L(5, "#3A2E26")}/><path d="M-28 -72q28 12 56 0" ${L(7, "#B9AD99")}/>
      <path d="M-16 -104l-10-16M16 -104l10-16" ${L(5, "#EDE4D0")}/><circle cx="0" cy="-92" r="19" ${F("#5E7350")}/>
      <circle cx="-7" cy="-94" r="3" fill="#E23B2E"/><circle cx="7" cy="-94" r="3" fill="#E23B2E"/><path d="M-8 -80v-6M8 -80v-6" ${L(3.5, "#EDE4D0")}/>
      <g class="waffe"><path d="M38 0v-120" ${L(5, "#6B4A2E")}/><path d="M38 -136l-9 13 9 7 9-7z" ${F("#5BA8FF", 2)}/></g>` };
  GEG.golem = { h: 148, svg: `${schatten(58)}<path d="M-30 0l4-34h20l-2 34zM8 0l-2-34h20l4 34z" ${F("#1E1A22")}/>
      <path d="M-54 -88l-16 10-4 40 16 6 8-36z" ${F("#2A2430")}/>
      <path d="M-48 -34l-6-56 30-26h48l30 26-6 56z" ${F("#2A2430")}/><path d="M-40 -84l22-20M30 -90l12 14" ${L(2, "#5A4E66")}/>
      <path d="M-20 -100l10 20-6 16 12 20M24 -96l-8 18 10 14" ${L(3, "#FF6A2A")}/>
      <path d="M-18 -116l4-26h28l4 26z" ${F("#2A2430")}/><rect x="-10" y="-132" width="7" height="4" fill="#FF9A3C"/><rect x="3" y="-132" width="7" height="4" fill="#FF9A3C"/>
      <g class="waffe"><path d="M54 -88l16 10 4 40-16 6-8-36z" ${F("#2A2430")}/></g>` };
  GEG.feuerelementar = { h: 140, svg: `${schatten(46)}<path d="M-34 -6c-14-40 10-60 8-92 14 14 18 30 14 44 10-20 8-46-2-70 30 20 44 60 34 94 8-10 10-24 6-36 16 20 14 48-2 62z" fill="#FF6A2A" stroke="${T}" stroke-width="3"/>
      <path d="M-14 -10c-6-20 6-30 4-50 10 10 12 20 10 30 6-10 6-20 2-30 14 14 18 36 6 52z" fill="#FFB547"/><path d="M-4 -12c-2-10 2-16 4-22 4 8 6 14 2 22z" fill="#FFF3B0"/>
      <path d="M-14 -88l8 4M14 -88l-8 4" ${L(3)}/><circle cx="-8" cy="-80" r="3.5" fill="#FFF3B0" stroke="${T}" stroke-width="1.5"/><circle cx="8" cy="-80" r="3.5" fill="#FFF3B0" stroke="${T}" stroke-width="1.5"/>
      <g class="waffe"><path d="M30 -60c10-6 16 0 18 8-6-2-10 0-12 4" fill="#FF9A3C" stroke="${T}" stroke-width="2"/></g>` };
  const fluegel = `<path d="M-30 -110L-120 -170L-110 -122L-140 -110L-104 -88L-120 -66L-40 -70z" ${F("#7A2418")}/><path d="M-32 -106L-116 -164M-36 -94L-134 -110M-40 -80L-116 -68" ${L(2, "#4A140C")}/>`;
  GEG.drache = { h: 162, svg: `${schatten(80)}<g transform="scale(.82)">${fluegel}<g transform="scale(-1 1)">${fluegel}</g>
      <path d="M30 -20q50 0 70-30 6-10 16-8-8 8-6 16" ${L(14)}/><path d="M30 -20q50 0 70-30 6-10 16-8-8 8-6 16" ${L(9, "#B83A2A")}/>
      <path d="M-40 0v-30h22v30zM18 0v-30h22v30z" ${F("#8C2A1C")}/>
      <path d="M-50 -24q-10-70 50-86 60 16 50 86z" ${F("#B83A2A")}/><path d="M-20 -32q20 8 40 0M-24 -48q24 8 48 0M-24 -64q24 8 48 0M-20 -80q20 8 40 0" ${L(3, "#E8C24A")}/>
      <path d="M-14 -104q-6-30 14-44 20 14 14 44z" ${F("#B83A2A")}/>
      <path d="M-18 -170l-14-20 20 8M18 -170l14-20-20 8" ${F("#EDE4D0", 2.5)}/>
      <path d="M-26 -152q0-24 26-28 26 4 26 28-10 16-26 18-16-2-26-18z" ${F("#B83A2A")}/>
      <path d="M-15 -160l8 3M15 -160l-8 3" ${L(3)}/><circle cx="-9" cy="-154" r="3.5" fill="#FFE27A"/><circle cx="9" cy="-154" r="3.5" fill="#FFE27A"/><circle cx="-5" cy="-138" r="2" fill="${T}"/><circle cx="5" cy="-138" r="2" fill="${T}"/>
      <g class="waffe"><path d="M44 -60l16 14-4 4" ${L(4, "#EDE4D0")}/></g></g>` };
  const GROESSE = { koenig: 5, koenigin: 5, drache: 5, orkhaeuptling: 4.5, kerkerwaerter: 4.5, hoehlentroll: 4.5, totenbeschwoerer: 4.4, feuerelementar: 4.4, spinnenmutter: 4.3, golem: 4.2, ork: 4, ghul: 3.5, orkschamane: 3.4,
    skelett: 3, schleim: 2.8, schnecke: 2.8, bogenschuetze: 2.5, fledermaus: 2.5, weberin: 2.4, salamander: 2.3, schamane: 2, langfinger: 2, goblin: 2, spinne: 2, pilzling: 1.8, kobold: 1.6, ratte: 1, brut: 0.6, schwarm: 0.5 };
  const kurzName = n => { const k = n.replace("Goblin-", "").replace("Skelett-", "").replace("Höhlen", "").replace(/^(Der|Die) /, ""); return k.charAt(0).toUpperCase() + k.slice(1); };

  // ---------- Hintergrund ----------
  // Jede Ebene hat ihre eigene Bühne: Kerker (Fackeln), Spinnengrotte (Pilze, Netze), Glutschlund (Lava)
  const THEMA = {
    1: { wand: ["#1B1626", "#2E2638"], stein: "#251E30", fuge: "#120E18", boden: ["#3A3040", "#4A3E48"], linie: "#2A2230", licht: "#FFB547" },
    2: { wand: ["#0E1B16", "#1B2E25"], stein: "#16281F", fuge: "#08120D", boden: ["#1E3126", "#2A4031"], linie: "#13231A", licht: "#7BE3A0" },
    3: { wand: ["#1E0906", "#3A140E"], stein: "#2A110C", fuge: "#120503", boden: ["#3A1A12", "#4A2216"], linie: "#260E09", licht: "#FF7A3C" }
  };
  function hintergrund(ebene) {
    const t = THEMA[ebene] || THEMA[1];
    let s = `<defs>
      <linearGradient id="vl-wand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.wand[0]}"/><stop offset="1" stop-color="${t.wand[1]}"/></linearGradient>
      <linearGradient id="vl-boden" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.boden[0]}"/><stop offset="1" stop-color="${t.boden[1]}"/></linearGradient>
      <radialGradient id="vl-licht" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${t.licht}" stop-opacity=".35"/><stop offset="1" stop-color="${t.licht}" stop-opacity="0"/></radialGradient>
      <radialGradient id="vl-glut" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFF3B0"/><stop offset=".45" stop-color="#FF9A3C"/><stop offset="1" stop-color="#E2421F" stop-opacity="0"/></radialGradient>
      <radialGradient id="vl-heil" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#E9FFD9"/><stop offset=".5" stop-color="#7BE3A0" stop-opacity=".7"/><stop offset="1" stop-color="#4FB98A" stop-opacity="0"/></radialGradient>
      <radialGradient id="vl-vignette" cx=".5" cy=".45" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>
    </defs><rect width="400" height="250" fill="url(#vl-wand)"/>`;
    if (ebene === 2) {
      // Höhlenfels statt Mauern
      for (let r = 0; r < 6; r++) for (let c = -1; c < 8; c++) {
        const x = c * 62 + (r % 2 ? 31 : 0) + ((r * 5 + c * 7) % 9), y = r * 42 + ((c * 3) % 7);
        s += `<ellipse cx="${x + 30}" cy="${y + 20}" rx="${26 + (r + c) % 4 * 3}" ry="${17 + (r * c) % 3 * 2}" fill="${t.stein}" stroke="${t.fuge}" stroke-width="2" opacity="${(.6 + ((r * 7 + c * 3) % 5) * .07).toFixed(2)}"/>`;
      }
      // Netze in den oberen Ecken, herabhängende Fäden
      for (const [x, sx] of [[0, 1], [400, -1]]) {
        s += `<g opacity=".55" ${L(1.2, "#D8E8DF")}>${[0, 1, 2, 3].map(i => `<path d="M${x} ${i * 22} L${x + sx * (90 - i * 22)} 0"/>`).join("")}${[22, 44, 66].map(r => `<path d="M${x} ${r} Q${x + sx * r * .55} ${r * .55} ${x + sx * r} 0"/>`).join("")}</g>`;
      }
      for (const x of [96, 150, 262, 318]) s += `<path d="M${x} 0v${30 + (x % 40)}" ${L(1, "#D8E8DF")} opacity=".35"/>`;
    } else {
      for (let r = 0; r < 6; r++) for (let c = -1; c < 8; c++) {
        const x = c * 60 + (r % 2 ? 30 : 0), y = r * 40;
        s += `<rect x="${x + 2}" y="${y + 2}" width="56" height="36" rx="4" fill="${t.stein}" stroke="${t.fuge}" stroke-width="2" opacity="${(.55 + ((r * 7 + c * 3) % 5) * .08).toFixed(2)}"/>`;
      }
      if (ebene === 3) s += `<path d="M40 40l14 22-6 18 10 24M300 20l-8 26 12 14-4 30M190 0l6 30-10 20" ${L(2.5, "#FF6A2A")} opacity=".55"/>`;
    }
    s += `<path d="M0 248 Q200 228 400 248 V500 H0Z" fill="url(#vl-boden)"/>`;
    for (let i = 0; i < 9; i++) s += `<path d="M${200 + (i - 4) * 18} 240 L${200 + (i - 4) * 110} 500" stroke="${t.linie}" stroke-width="2" opacity=".6"/>`;
    for (let i = 0; i < 5; i++) s += `<path d="M0 ${280 + i * i * 9} Q200 ${270 + i * i * 9} 400 ${280 + i * i * 9}" stroke="${t.linie}" stroke-width="2" fill="none" opacity=".5"/>`;
    if (ebene === 2) {
      // leuchtende Pilze statt Fackeln
      for (const [x, b] of [[24, ""], [376, "b"]]) {
        s += `<circle cx="${x}" cy="200" r="64" fill="url(#vl-licht)"/>
          <g class="vl-flamme ${b}"><path d="M${x - 4} 236v-26h8v26z" ${F("#CFE6D8", 2)}/><path d="M${x - 18} 212q18-26 36 0z" ${F("#5BD69A", 2.5)}/><circle cx="${x - 6}" cy="204" r="2.5" fill="#E9FFD9"/><circle cx="${x + 6}" cy="206" r="2" fill="#E9FFD9"/>
          <path d="M${x + 12} 238v-14h5v14z" ${F("#CFE6D8", 1.5)}/><path d="M${x + 6} 226q8-14 17 0z" ${F("#3FB88A", 2)}/></g>`;
      }
    } else if (ebene === 3) {
      // Lavarinnen im Boden und Glut an den Seiten
      s += `<path d="M-10 300 Q60 290 90 320 T190 330 T300 310 T410 330" ${L(7, "#FF6A2A")} opacity=".8"/><path d="M-10 300 Q60 290 90 320 T190 330 T300 310 T410 330" ${L(2.5, "#FFE27A")}/>
        <path d="M30 420 Q90 400 130 430 M280 440 Q330 420 400 436" ${L(5, "#FF6A2A")} opacity=".6"/>`;
      for (const [x, b] of [[22, ""], [378, "b"]]) s += `<circle cx="${x}" cy="200" r="70" fill="url(#vl-licht)"/><g class="vl-flamme ${b}"><path d="M${x - 14} 240c-4-18 6-22 6-34 8 8 10 14 8 20 4-6 6-10 6-16 8 12 6 24 0 30z" fill="#FF6A2A" stroke="${T}" stroke-width="2.5"/><path d="M${x - 4} 238c-2-8 2-12 4-16 4 6 4 10 2 16z" fill="#FFE27A"/></g>`;
    } else {
      for (const [x, b] of [[22, ""], [378, "b"]]) {
        s += `<circle cx="${x}" cy="150" r="60" fill="url(#vl-licht)"/><path d="M${x - 6} 156 l4 30 h4 l4-30z" ${F("#6B4A2E", 2.5)}/><path d="M${x - 9} 152 h18" ${L(2.5)}/>
          <g class="vl-flamme ${b}"><path d="M${x} 122 c-11 13-11 24 0 31 11-7 11-18 0-31z" fill="#FF9A3C" stroke="${T}" stroke-width="2.5"/><path d="M${x} 133 c-4 6-4 12 0 15 4-3 4-9 0-15z" fill="#FFE27A"/></g>`;
      }
    }
    return s;
  }

  // ---------- Aufstellung ----------
  function aufstellung(gegner, helden) {
    const pos = {};
    const n = helden.length, hx = n === 1 ? [200] : n === 2 ? [125, 275] : n === 3 ? [78, 200, 322] : [52, 149, 251, 348], hy = n === 3 ? [430, 440, 430] : n === 4 ? [432, 440, 440, 432] : [436, 436, 436];
    helden.forEach((p, i) => { pos[p] = { x: hx[i], y: hy[i], s: n >= 4 ? .78 : 1, w: n >= 4 ? 94 : 108, held: true }; });
    const c = gegner.length;
    const plaetze = c === 1 ? [200] : c === 2 ? [112, 288] : c === 3 ? [200, 72, 328] : [148, 252, 52, 348];
    const skala = c <= 2 ? 1 : c === 3 ? .8 : .66;
    const sortiert = gegner.slice().sort((a, b) => (GROESSE[b.art] || 0) - (GROESSE[a.art] || 0) || (a.id < b.id ? -1 : 1));
    sortiert.forEach((g, i) => { const x = plaetze[i] !== undefined ? plaetze[i] : 50 + i * 60; pos[g.id] = { x, y: c >= 3 && i > 0 ? 234 : 226, s: skala, held: false, w: c >= 4 ? 92 : i === 0 && c === 3 ? 150 : Math.min(116, 400 / Math.max(c, 1) - 10) }; });
    return pos;
  }
  const mitte = (pos, id, art) => { const p = pos[id]; if (!p) return { x: 200, y: 250 }; return p.held ? { x: p.x, y: p.y - 62 } : { x: p.x, y: p.y - (GEG[art] ? GEG[art].h : 80) * p.s * .55 }; };

  // ---------- Zeichnen ----------
  const farbeBalken = q => q <= .3 ? "#FF6B57" : q <= .6 ? "#FFD447" : "#5BD69A";
  function plakette(id, x, y, w, name, hp, max, marken) {
    const q = Math.max(0, hp / max);
    // langer Name auf schmalem Schild: zusammendrücken, damit die Lebenszahl frei bleibt
    const platz = w - 14 - (String(max).length * 2 + 1) * 5.8 - 6, eng = name.length * 6.8 > platz ? ` textLength="${Math.round(platz)}" lengthAdjust="spacingAndGlyphs"` : "";
    return `<g id="vl-pl-${id}" class="vl-plakette"><rect x="${x}" y="${y}" width="${w}" height="${marken ? 46 : 34}" rx="8" fill="#1C1A33" opacity=".88" stroke="#3D3868"/>
      <text x="${x + 7}" y="${y + 14}" font-family="Inter,system-ui" font-weight="700" font-size="11" fill="#F3F0FF"${eng}>${esc(name)}</text>
      <text id="vl-z-${id}" x="${x + w - 7}" y="${y + 14}" text-anchor="end" font-family="Inter,system-ui" font-size="10" fill="#A8A2CC">${Math.max(0, hp)}/${max}</text>
      <rect x="${x + 7}" y="${y + 21}" width="${w - 14}" height="6" rx="3" fill="#0E0C18"/>
      <rect id="vl-b-${id}" x="${x + 7}" y="${y + 21}" width="${w - 14}" height="6" rx="3" fill="${farbeBalken(q)}" style="transform-box:fill-box;transform-origin:0 50%;transform:scaleX(${q})"/>
      ${marken ? `<text x="${x + 7}" y="${y + 40}" font-family="Inter,system-ui" font-weight="600" font-size="9.5" fill="#FFD447"${marken.length * 5.4 > w - 14 ? ` textLength="${w - 14}" lengthAdjust="spacingAndGlyphs"` : ""}>${esc(marken)}</text>` : ""}</g>`;
  }
  // daten: { gegner:[{id,art,name,hp,max,giftR,markiert,starr}], helden:[{id,rolle,name,hp,max,marken}], absicht, zielModus, zielHelden:[ids] }
  function svgBauen(daten) {
    const pos = aufstellung(daten.gegner, daten.helden.map(h => h.id));
    let s = hintergrund(daten.ebene || 1);
    for (const g of daten.gegner) {
      const p = pos[g.id], tot = g.hp <= 0;
      s += `<g class="vl-einheit" id="vl-e-${g.id}" style="transform:translate(${p.x}px,${p.y}px)"><g style="transform:scale(${p.s})"><g class="vl-fig" id="vl-f-${g.id}" ${tot ? 'style="opacity:0"' : ""}><g class="vl-atmen ${g.id.length % 2 ? "b" : ""}">${GEG[g.art] ? GEG[g.art].svg : ""}</g></g></g></g>`;
    }
    for (const h of daten.helden) {
      const p = pos[h.id], weg = h.hp <= 0;
      s += `<g class="vl-einheit" id="vl-e-${h.id}" style="transform:translate(${p.x}px,${p.y}px)"><g class="vl-fig" id="vl-f-${h.id}" ${weg ? 'style="transform:rotate(-80deg) translate(10px,10px);opacity:.45"' : ""}><g class="vl-atmen ${p.x > 200 ? "c" : p.x < 200 ? "" : "b"}"><g style="transform:scale(${p.s})">${HELD[h.rolle] || ""}</g></g></g></g>`;
    }
    // Plaketten, Absichten, Ziele
    for (const g of daten.gegner) {
      const p = pos[g.id], hoehe = (GEG[g.art] ? GEG[g.art].h : 80) * p.s, w = p.w, y = Math.max(28, p.y - hoehe - 42);
      const V = window.VL, eig = V ? V.eigenschaften(g.art).filter(e => e !== "wucht" && e !== "gift").map(e => V.EIGENSCHAFTEN[e][0]) : [];
      const marken = [...(g.zustand || []), g.giftR > 0 ? "Gift" : "", g.markiert > 0 ? "markiert" : "", g.starr > 0 ? "erstarrt" : ""].concat(eig).filter(Boolean).join(" · ");
      s += `<g ${g.hp <= 0 ? 'opacity=".25"' : ""}>${plakette(g.id, p.x - w / 2, y, w, kurzName(g.name), g.hp, g.max, marken)}</g>`;
      const a = daten.absicht && daten.absicht[g.id];
      if (a && g.hp > 0) {
        const wer = id => (daten.helden.find(x => x.id === id) || { name: "?" }).name;
        const txt = a.a === "beben" ? `⟁ ${a.name || "Beben"} → alle` : a.a === "ruf" ? "☠ ruft Verstärkung" : a.a === "flucht" ? "↯ will fliehen!"
          : a.a === "netz" ? `🕸 Netz → ${wer(a.ziel)}` : a.a === "ruhe" ? "… sammelt Kraft" : a.a === "schuetzen" ? `🛡 → ${kurzName((daten.gegner.find(x => x.id === a.ziel) || { name: "?" }).name)}`
          : a.a === "angriff" && a.doppelt ? `⚔⚔ → ${wer(a.ziel)}`
          : a.a === "stehlen" ? `✋ Gold → ${(daten.helden.find(x => x.id === a.ziel) || { name: "?" }).name}` : a.a === "heilen" ? `✚ → ${kurzName((daten.gegner.find(x => x.id === a.ziel) || { name: "?" }).name)}` : `⚔ → ${(daten.helden.find(x => x.id === a.ziel) || { name: "?" }).name}`;
        const bw = Math.min(w + 6, txt.length * 6.6 + 16);
        s += `<g id="vl-ab-${g.id}" class="vl-absicht"><rect x="${p.x - bw / 2}" y="${y - 24}" width="${bw}" height="20" rx="10" fill="#FFD447" stroke="${T}" stroke-width="2"/>
          <text x="${p.x}" y="${y - 10}" text-anchor="middle" font-family="Inter,system-ui" font-weight="700" font-size="10.5" fill="#1C1A33"${txt.length * 6.6 + 16 > bw ? ` textLength="${bw - 14}" lengthAdjust="spacingAndGlyphs"` : ""}>${esc(txt)}</text></g>`;
      }
    }
    for (const h of daten.helden) { const p = pos[h.id]; s += plakette(h.id, p.x - p.w / 2, p.y + 10, p.w, h.name, h.hp, h.max, h.marken); }
    if (daten.zielModus === "gegner") for (const g of daten.gegner) if (g.hp > 0) {
      const p = pos[g.id], hoehe = (GEG[g.art] ? GEG[g.art].h : 80) * p.s;
      s += `<ellipse class="vl-ring" cx="${p.x}" cy="${p.y}" rx="${44 * p.s + 10}" ry="${12 * p.s + 4}" fill="none" stroke="#FFD447" stroke-width="3"/>
        <rect data-ziel="${g.id}" x="${p.x - 50}" y="${p.y - hoehe - 10}" width="100" height="${hoehe + 24}" fill="#FFD447" fill-opacity=".001" style="cursor:pointer" role="button" aria-label="${esc(g.name)} als Ziel"/>`;
    }
    if (daten.zielModus === "held") for (const h of daten.helden) if ((daten.zielHelden || []).includes(h.id)) {
      const p = pos[h.id];
      s += `<ellipse class="vl-ring" cx="${p.x}" cy="${p.y}" rx="42" ry="11" fill="none" stroke="#FFD447" stroke-width="3"/>
        <rect data-ziel="${h.id}" x="${p.x - 54}" y="${p.y - 150}" width="108" height="210" fill="#FFD447" fill-opacity=".001" style="cursor:pointer" role="button" aria-label="${esc(h.name)} als Ziel"/>`;
    }
    s += `<g id="vl-fx"></g><rect id="vl-blitz" width="400" height="500" fill="#fff" opacity="0" pointer-events="none"/><rect width="400" height="500" fill="url(#vl-vignette)" pointer-events="none"/>`;
    return { svg: `<svg class="vl-svg" viewBox="0 0 400 500" role="img" aria-label="Kampfbühne">${s}</svg>`, pos };
  }

  function zeichne(el, daten) { el.innerHTML = svgBauen(daten).svg; }

  // ---------- Ton ----------
  let ac = null;
  function audio() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (ac && ac.state === "suspended") ac.resume(); return ac; }
  function rauschen(dauer, freq, laut) {
    const c = audio(); if (!c) return;
    const n = c.createBuffer(1, Math.floor(c.sampleRate * dauer), c.sampleRate), d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const q = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    q.buffer = n; f.type = "bandpass"; f.frequency.value = freq; f.Q.value = 1.2; g.gain.value = laut;
    q.connect(f); f.connect(g); g.connect(c.destination); q.start();
  }
  function ton(frequenzen, dauer, typ, laut) {
    const c = audio(); if (!c) return;
    frequenzen.forEach((fr, i) => {
      const o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime + i * dauer * 0.7;
      o.type = typ || "sine"; o.frequency.value = fr; g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(laut || .12, t0 + .02); g.gain.exponentialRampToValueAtTime(.001, t0 + dauer);
      o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dauer + .05);
    });
  }
  const SFX = {
    hieb() { rauschen(.18, 2400, .5); setTimeout(() => ton([110], .12, "square", .08), 80); },
    treffer() { ton([90, 60], .1, "triangle", .2); },
    schuss() { rauschen(.12, 3500, .35); },
    feuer() { rauschen(.5, 600, .5); },
    knall() { rauschen(.35, 200, .9); ton([70], .25, "sawtooth", .08); },
    eis() { ton([1800, 2400, 3100], .09, "triangle", .06); },
    heil() { ton([523, 659, 784, 1046], .16, "sine", .09); },
    segen() { ton([392, 523, 659, 784], .3, "sine", .07); },
    schutz() { ton([330, 440], .25, "triangle", .08); },
    gift() { rauschen(.25, 900, .35); ton([220, 180], .15, "sawtooth", .04); },
    tod() { rauschen(.7, 300, .45); ton([200, 150, 100], .2, "triangle", .07); },
    stampfen() { ton([55, 45], .2, "sine", .3); },
    ruf() { ton([196, 262, 330], .22, "sawtooth", .05); }
  };

  // ---------- Wiedergabe ----------
  // R = S.letzte, info = { name(pid), rolle(pid), tempo, ton, sag(textzeilen), abbruch() }
  async function abspielen(el, R, info) {
    let tempo = info.tempo || 1;
    const stumm = () => !info.ton || info.abbruch();
    const sfx = k => { if (!stumm() && SFX[k]) try { SFX[k](); } catch (e) {} };
    const warte = ms => new Promise(r => setTimeout(r, info.abbruch() ? 0 : ms * tempo));
    function animiere(e, frames, ms, opt) {
      if (!e) return Promise.resolve();
      const a = e.animate(frames, Object.assign({ duration: info.abbruch() ? 1 : ms * tempo, easing: "ease-in-out", fill: "forwards" }, opt || {}));
      return a.finished.catch(() => {});
    }
    const elt = (tag, attr, inner) => { const e = document.createElementNS(NS, tag); for (const k in attr || {}) e.setAttribute(k, attr[k]); if (inner) e.innerHTML = inner; return e; };

    // Ausgangslage aufbauen
    let gegner = R.start.gegner.map(g => Object.assign({}, g));
    const heldIds = Object.keys(R.start.helden);
    const helden = heldIds.map(p => ({ id: p, rolle: info.rolle(p), name: info.name(p), hp: R.start.helden[p].hp, max: R.start.helden[p].max, marken: "" }));
    const zust = {}; for (const g of gegner) zust[g.id] = g; for (const h of helden) zust[h.id] = h;
    let bau = svgBauen({ gegner, helden, absicht: R.start.absicht, ebene: R.start.ebene });
    el.innerHTML = bau.svg;
    let pos = bau.pos;
    let svg = el.querySelector("svg");
    const fx = () => svg.querySelector("#vl-fx");
    const $ = id => svg.querySelector("#" + CSS.escape(id));
    const artVon = id => (zust[id] && zust[id].art) || null;
    const M = id => mitte(pos, id, artVon(id));
    const istHeld = id => heldIds.includes(id);

    async function zahl(id, text, farbe) {
      const m = M(id), x = m.x + (Math.random() * 24 - 12);
      const t = elt("text", { x, y: m.y, "text-anchor": "middle", "font-family": "Unbounded,system-ui", "font-weight": "800", "font-size": "24", fill: farbe, stroke: T, "stroke-width": "5", "paint-order": "stroke" });
      t.textContent = text; fx().appendChild(t);
      await animiere(t, [{ transform: "translateY(0) scale(.6)", opacity: 0 }, { transform: "translateY(-16px) scale(1.15)", opacity: 1, offset: .25 }, { transform: "translateY(-44px) scale(1)", opacity: 0 }], 900, { easing: "ease-out" });
      t.remove();
    }
    function wort(id, text, farbe) { return zahl(id, text, farbe || "#F3F0FF"); }
    async function balken(id) {
      const z = zust[id], q = Math.max(0, z.hp / z.max), b = $("vl-b-" + id), t = $("vl-z-" + id);
      if (t) t.textContent = `${Math.max(0, z.hp)}/${z.max}`;
      if (b) { b.setAttribute("fill", farbeBalken(q)); await animiere(b, [{ transform: `scaleX(${q})` }], 420, { easing: "ease-out" }); }
    }
    async function wackeln(id) {
      await animiere($("vl-f-" + id), [{ transform: "translateX(0)" }, { transform: "translateX(-7px)" }, { transform: "translateX(7px)" }, { transform: "translateX(-4px)" }, { transform: "translateX(0)" }], 300);
    }
    async function bebenBild(st) { await animiere(svg, [{ transform: "translate(0,0)" }, { transform: `translate(${st}px,${-st}px)` }, { transform: `translate(${-st}px,${st / 2}px)` }, { transform: "translate(0,0)" }], 260); }
    function blitz(farbe, staerke) { const b = $("vl-blitz"); b.setAttribute("fill", farbe || "#fff"); animiere(b, [{ opacity: staerke || .3 }, { opacity: 0 }], 260); }
    async function partikel(x, y, farbe, n, streu, steigen, ms) {
      const alle = [];
      for (let i = 0; i < n; i++) {
        const p = elt("circle", { cx: x + (Math.random() - .5) * streu, cy: y + (Math.random() - .5) * streu * .5, r: 2 + Math.random() * 3.5, fill: farbe, stroke: T, "stroke-width": 1 });
        fx().appendChild(p);
        const dx = (Math.random() - .5) * streu, dy = -steigen * (.5 + Math.random());
        alle.push(animiere(p, [{ transform: "translate(0,0)", opacity: 1 }, { transform: `translate(${dx}px,${dy}px)`, opacity: 0 }], ms * (.7 + Math.random() * .6), { easing: "ease-out", delay: Math.random() * 150 * tempo }).then(() => p.remove()));
      }
      await Promise.all(alle);
    }
    async function vorstossen(id, zu, weite) {
      const a = pos[id], b = M(zu); if (!a) return;
      const von = M(id), dx = (b.x - von.x) * weite, dy = (b.y - von.y) * weite;
      await animiere($("vl-f-" + id), [{ transform: "translate(0,0)" }, { transform: `translate(${dx * -.08}px,${dy * -.08}px)`, offset: .3 }, { transform: `translate(${dx}px,${dy}px)` }], 240, { easing: "cubic-bezier(.5,0,.9,.6)" });
    }
    const zurueck = id => animiere($("vl-f-" + id), [{ transform: "translate(0,0)" }], 280, { easing: "ease-out" });
    async function heben(id) { await animiere($("vl-f-" + id), [{ transform: "translateY(0)" }, { transform: "translateY(-9px) scale(1.03)" }], 200); }
    const senken = id => animiere($("vl-f-" + id), [{ transform: "translateY(0) scale(1)" }], 220);
    async function flug(von, nach, inner, ms, bogen, drehen, spur) {
      const g = elt("g", {}, inner); fx().appendChild(g);
      const w = Math.atan2(nach.y - von.y, nach.x - von.x) * 180 / Math.PI, schritte = [];
      for (let i = 0; i <= 12; i++) { const t = i / 12, x = von.x + (nach.x - von.x) * t, y = von.y + (nach.y - von.y) * t - Math.sin(Math.PI * t) * (bogen || 0); schritte.push({ transform: `translate(${x}px,${y}px)` + (drehen ? ` rotate(${w}deg)` : "") }); }
      let iv = null;
      if (spur) iv = setInterval(() => { const r = g.getBoundingClientRect(), bb = svg.getBoundingClientRect(); if (bb.width) partikel((r.x + r.width / 2 - bb.x) * 400 / bb.width, (r.y + r.height / 2 - bb.y) * 500 / bb.height, spur, 1, 8, 8, 320); }, 45);
      await animiere(g, schritte, ms, { easing: "ease-in" });
      if (iv) clearInterval(iv);
      g.remove();
    }
    async function bogenSchnitt(ziel, farbe) {
      const m = M(ziel);
      const b = elt("path", { d: `M${m.x - 42} ${m.y - 36} Q${m.x + 28} ${m.y - 28} ${m.x + 36} ${m.y + 38}`, fill: "none", stroke: "#FFF6D8", "stroke-width": 9, "stroke-linecap": "round", "stroke-dasharray": "200", "stroke-dashoffset": "200" });
      const k = b.cloneNode(); k.setAttribute("stroke", farbe || "#FFD447"); k.setAttribute("stroke-width", 3.5);
      fx().append(b, k);
      await Promise.all([animiere(b, [{ strokeDashoffset: 200, opacity: 1 }, { strokeDashoffset: 0, opacity: 1, offset: .6 }, { strokeDashoffset: 0, opacity: 0 }], 330),
        animiere(k, [{ strokeDashoffset: 200 }, { strokeDashoffset: 0, offset: .6 }, { strokeDashoffset: 0, opacity: 0 }], 330)]);
      b.remove(); k.remove();
    }
    async function glut(x, y, def, gross, ms) {
      const c = elt("ellipse", { cx: x, cy: y, rx: gross, ry: gross * 1.25, fill: `url(#${def})`, class: "vl-mitte" });
      fx().appendChild(c);
      await animiere(c, [{ transform: "scale(.15)", opacity: 0 }, { transform: "scale(.85)", opacity: 1, offset: .4 }, { transform: "scale(1)", opacity: 0 }], ms || 800);
      c.remove();
    }
    async function blase(id, farbe) {
      const m = M(id), c = elt("ellipse", { cx: m.x, cy: m.y + 8, rx: 46, ry: 70, fill: farbe, "fill-opacity": .18, stroke: farbe, "stroke-width": 3, class: "vl-mitte" });
      fx().appendChild(c);
      await animiere(c, [{ transform: "scale(.3)", opacity: 0 }, { transform: "scale(1.05)", opacity: 1, offset: .5 }, { transform: "scale(1)", opacity: 0 }], 900);
      c.remove();
    }

    // Lebenspunkte und Folgen eines Ereignisses anzeigen
    async function folgen(e, farbeSchaden) {
      const warten = [];
      for (const [id, d, nach] of e.d || []) {
        const z = zust[id]; if (!z) continue;
        const war = z.hp; z.hp = nach;
        if (d < 0) { warten.push(wackeln(id)); zahl(id, "−" + -d, istHeld(id) ? "#FF6B57" : (farbeSchaden || "#FFFFFF")); if (istHeld(id)) { try { navigator.vibrate && navigator.vibrate(50); } catch (x) {} } }
        else zahl(id, "+" + d, "#7BE3A0");
        warten.push(balken(id));
        if (nach <= 0 && war > 0) {
          if (istHeld(id)) warten.push(animiere($("vl-f-" + id), [{ transform: "rotate(0)", opacity: 1 }, { transform: "rotate(-80deg) translate(10px,10px)", opacity: .45 }], 600));
          else { sfx("tod"); const m = M(id); partikel(m.x, m.y, "#8C8070", 22, 80, 60, 850); warten.push(animiere($("vl-f-" + id), [{ transform: "scale(1,1)", opacity: 1 }, { transform: "scale(1.15,.4) translateY(10px)", opacity: 0 }], 850, { easing: "ease-in" }));
            const ab = $("vl-ab-" + id); if (ab) ab.remove(); const pl = $("vl-pl-" + id); if (pl) animiere(pl, [{ opacity: 1 }, { opacity: .25 }], 400); }
        } else if (war <= 0 && nach > 0 && istHeld(id)) warten.push(animiere($("vl-f-" + id), [{ transform: "rotate(0)", opacity: 1 }], 500));
      }
      await Promise.all(warten);
    }
    const getroffene = (e, nurGegner) => (e.d || []).filter(([id, d]) => d < 0 && (nurGegner ? !istHeld(id) : true)).map(x => x[0]);

    // ---------- Heldenaktionen ----------
    const HFX = {
      nah: ["schlag", "vernichten", "dolch", "gift", "taschendieb", "hammer"],
      geschoss: ["funken", "pfeil", "eis", "markieren"],
      salve: ["doppel", "hagel"], strahl: ["stab"],
      heil: ["heilen", "handauflegen", "kraeuter", "trank"],
      gruppe: ["segen", "laeutern", "wiedergeburt"],
      schutz: ["schild", "fels", "arkan", "beschuetzen"]
    };
    const typVon = a => Object.keys(HFX).find(k => HFX[k].includes(a)) || a;
    // Frost und Ewiger Winter: kalte Welle über alle Gegner
    async function frostwelle(e) {
      sfx("eis"); await heben(e.von);
      const lebende = gegner.filter(g => g.hp > 0).map(g => g.id);
      blitz("#BFE8FF", .35);
      for (const id of lebende) { const m = M(id); partikel(m.x, m.y, "#DFF4FF", 14, 80, 40, 800); glut(m.x, m.y, "vl-heil", 55, 700); }
      await warte(450); senken(e.von); await folgen(e, "#BFE8FF");
    }
    const FARBE = { schlag: "#FFD447", vernichten: "#FF6B57", dolch: "#C9B8FF", gift: "#8BD14A", taschendieb: "#FFD447", hammer: "#FFE27A" };
    // Talent-Fähigkeiten nutzen die Effekte verwandter Grundfähigkeiten
    const AEHNLICH = { spott: "schlag", raserei: "wirbel", gottesurteil: "vernichten", todesstoss: "vernichten", meisterdieb: "taschendieb",
      kopfschuss: "pfeil", ranken: "eis", durchschuss: "hagel", treibjagd: "hagel", wolfsrudel: "hagel", inferno: "meteor", sonnenstrahl: "licht",
      sonnenzorn: "licht", giftwolke: "rauch", seuche: "rauch", bollwerk: "fels", wall: "fels", obhut: "arkan", taktik: "arkan",
      schlachtruf: "kriegsschrei", gnadenlicht: "wiedergeburt", auferstehung: "wiedergeburt", erloesung: "wiedergeburt", heiligtum: "wiedergeburt",
      heiligtumTick: "laeutern", zeitriss: "segen" };
    async function heldAktion(e0) {
      if (e0.a === "frost" || e0.a === "winter") { await frostwelle(e0); return; }
      if (e0.a === "befreien") { await wackeln(e0.von); await wort(e0.von, "frei!", "#F3F0FF"); return; }
      const e = AEHNLICH[e0.a] ? Object.assign({}, e0, { a: AEHNLICH[e0.a], phase: (e0.a === "sonnenstrahl" || e0.a === "sonnenzorn") ? 2 : e0.phase }) : e0;
      const p = e.von, a = e.a, typ = typVon(a), ziele = getroffene(e, true), ziel = e.ziel && zust[e.ziel] ? e.ziel : ziele[0];
      const spitze = () => { const q = pos[p], s = SPITZE[zust[p].rolle] || [0, -100]; return { x: q.x + s[0], y: q.y + s[1] }; };
      if (typ === "nah" && ziel) {
        await vorstossen(p, ziel, .55); sfx("hieb");
        await bogenSchnitt(ziel, FARBE[a]);
        if (a === "hammer") { sfx("stampfen"); bebenBild(4); }
        if (a === "gift") { const m = M(ziel); partikel(m.x, m.y, "#8BD14A", 12, 50, 30, 600); sfx("gift"); }
        if (a === "taschendieb") { const m = M(ziel); partikel(m.x, m.y, "#FFD447", 10, 40, 50, 700); }
        sfx("treffer"); await folgen(e, FARBE[a] === "#FFD447" ? "#FFFFFF" : FARBE[a]); await zurueck(p);
      } else if (typ === "geschoss" && ziel) {
        await heben(p);
        const formen = {
          pfeil: `<path d="M-24 0h40" ${L(3, "#D9CDB6")}/><path d="M16 0l-8-5v10z" fill="#A6A9B2" stroke="${T}" stroke-width="1.5"/><path d="M-24 0l-6-5M-24 0l-6 5" ${L(2.5, "#B83A2A")}/>`,
          markieren: `<path d="M-24 0h40" ${L(3, "#D9CDB6")}/><path d="M16 0l-8-5v10z" fill="#FFD447" stroke="${T}" stroke-width="1.5"/>`,
          funken: `<circle r="16" fill="url(#vl-glut)"/><circle r="5" fill="#FFF3B0" stroke="${T}" stroke-width="1.5"/>`,
          eis: `<path d="M-24 0 L0 -7 L28 0 L0 7z" fill="#BFE8FF" stroke="${T}" stroke-width="2.5"/><path d="M-18 0h40" stroke="#fff" stroke-width="2"/>`
        };
        sfx(a === "eis" ? "eis" : a === "funken" ? "feuer" : "schuss");
        await flug(spitze(), M(ziel), formen[a], a === "funken" ? 420 : 340, a === "funken" ? 30 : 8, true, a === "eis" ? "#DFF4FF" : a === "funken" ? "#FF9A3C" : null);
        senken(p); sfx("treffer");
        if (a === "eis") { const m = M(ziel); partikel(m.x, m.y + 20, "#DFF4FF", 14, 70, 20, 700); blitz("#BFE8FF", .2); }
        if (a === "markieren") { const m = M(ziel); const r = elt("circle", { cx: m.x, cy: m.y, r: 26, fill: "none", stroke: "#FFD447", "stroke-width": 3, class: "vl-mitte" }); fx().appendChild(r); animiere(r, [{ transform: "scale(1.6)", opacity: 0 }, { transform: "scale(1)", opacity: 1, offset: .5 }, { transform: "scale(.9)", opacity: 0 }], 800).then(() => r.remove()); }
        await folgen(e, a === "eis" ? "#BFE8FF" : a === "funken" ? "#FFB547" : "#FFFFFF");
      } else if (typ === "salve") {
        await heben(p);
        const n = a === "hagel" ? 4 : 2, liste = ziele.length ? ziele : gegner.filter(g => g.hp > 0).map(g => g.id);
        const fl = [];
        for (let i = 0; i < n && liste.length; i++) { sfx("schuss"); fl.push(flug(spitze(), M(liste[i % liste.length]), `<path d="M-20 0h34" ${L(3, "#D9CDB6")}/><path d="M14 0l-7-4v8z" fill="#A6A9B2" stroke="${T}" stroke-width="1.5"/>`, 320, 30 + i * 8, true)); await warte(110); }
        await Promise.all(fl); senken(p); sfx("treffer"); await folgen(e);
      } else if (typ === "strahl" && ziel) {
        const a1 = spitze(), b = M(ziel); sfx("segen");
        const s1 = elt("path", { d: `M${a1.x} ${a1.y} L${b.x} ${b.y}`, stroke: "#FFF3B0", "stroke-width": 10, "stroke-linecap": "round", opacity: 0 });
        const s2 = elt("path", { d: `M${a1.x} ${a1.y} L${b.x} ${b.y}`, stroke: "#fff", "stroke-width": 3, "stroke-linecap": "round", opacity: 0 });
        fx().append(s1, s2);
        await Promise.all([animiere(s1, [{ opacity: 0 }, { opacity: .9, offset: .3 }, { opacity: 0 }], 480), animiere(s2, [{ opacity: 0 }, { opacity: 1, offset: .3 }, { opacity: 0 }], 480)]);
        s1.remove(); s2.remove(); sfx("treffer"); await folgen(e, "#FFF3B0");
      } else if (a === "feuerball" || a === "meteor" || a === "wirbel" || (a === "licht" && e.phase === 2)) {
        const lebende = gegner.filter(g => g.hp > 0 || ziele.includes(g.id)).map(g => g.id);
        const xs = lebende.map(id => M(id).x), mx = xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 200, my = 150;
        if (a === "feuerball") {
          await heben(p); sfx("feuer");
          await flug(spitze(), { x: mx, y: my }, `<circle r="22" fill="url(#vl-glut)"/><circle r="9" fill="#FFF3B0" stroke="${T}" stroke-width="2"/>`, 580, 80, false, "#FF9A3C");
          senken(p); sfx("knall"); bebenBild(5); blitz("#FFB547", .3);
          partikel(mx, my, "#FFB547", 22, 220, 70, 650); glut(mx, my, "vl-glut", 150, 520);
          await folgen(e, "#FFB547");
        } else if (a === "meteor") {
          await heben(p); sfx("feuer");
          await flug({ x: mx + 160, y: -60 }, { x: mx, y: my + 20 }, `<circle r="30" fill="url(#vl-glut)"/><circle r="15" fill="#6B4A2E" stroke="${T}" stroke-width="3"/><path d="M-6 -4l5 3M3 6l4-2" ${L(2)}/>`, 620, 0, false, "#FF9A3C");
          senken(p); sfx("knall"); sfx("stampfen"); bebenBild(10); blitz("#FFB547", .45);
          partikel(mx, my + 20, "#FFB547", 30, 260, 90, 750); partikel(mx, my + 30, "#6B4A2E", 14, 200, 50, 700); glut(mx, my, "vl-glut", 190, 620);
          await folgen(e, "#FFB547");
        } else if (a === "wirbel") {
          sfx("hieb"); setTimeout(() => sfx("hieb"), 140 * tempo);
          const q = pos[p], dx = (mx - q.x) * .35;
          const ring = elt("ellipse", { cx: mx, cy: 190, rx: 180, ry: 50, fill: "none", stroke: "#FFF6D8", "stroke-width": 4, opacity: .9, class: "vl-mitte" });
          fx().appendChild(ring);
          await Promise.all([animiere($("vl-f-" + p), [{ transform: `translate(${dx}px,-60px) rotate(0)` }, { transform: `translate(${dx}px,-60px) rotate(360deg)` }], 420, { easing: "linear" }),
            animiere(ring, [{ transform: "scale(.05)", opacity: .9 }, { transform: "scale(1)", opacity: 0 }], 520, { easing: "ease-out" })]);
          ring.remove(); sfx("treffer"); await folgen(e); await zurueck(p);
        } else {
          sfx("segen");
          for (const id of lebende) { const m = M(id); const st = elt("path", { d: `M${m.x - 16} 0 L${m.x + 16} 0 L${m.x + 30} ${m.y + 40} L${m.x - 30} ${m.y + 40}z`, fill: "#FFE27A", opacity: 0 }); fx().appendChild(st); animiere(st, [{ opacity: 0 }, { opacity: .45, offset: .3 }, { opacity: 0 }], 800).then(() => st.remove()); }
          await warte(350); await folgen(e, "#FFE27A");
        }
      } else if (typ === "heil" || (a === "licht" && e.phase === 1)) {
        const zielH = a === "trank" ? p : (e.ziel || p);
        if (a === "licht") { sfx("segen"); for (const h of helden) partikel(pos[h.id].x, pos[h.id].y - 50, "#FFE27A", 6, 40, 60, 700); await warte(300); await folgen(e); return; }
        if (a === "trank") { const q = pos[p]; const fl = elt("g", {}, `<path d="M-7 -14h14v6l6 10v12h-26v-12l6-10z" fill="#E86FB0" stroke="${T}" stroke-width="2"/><rect x="-5" y="-20" width="10" height="7" fill="#C79A5B" stroke="${T}" stroke-width="1.5"/>`); fl.setAttribute("transform", `translate(${q.x} ${q.y - 150})`); fx().appendChild(fl); await animiere(fl, [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "translateY(0)", offset: .4 }, { opacity: 0, transform: "translateY(-10px)" }], 600); fl.remove(); }
        else await heben(p);
        sfx("heil");
        const m = M(zielH);
        glut(m.x, m.y + 10, "vl-heil", 60, 900);
        for (let i = 0; i < 5; i++) { const k = elt("path", { d: `M${m.x + (i - 2) * 15} ${m.y + 40}m-5 0h10m-5-5v10`, stroke: "#E9FFD9", "stroke-width": 3, "stroke-linecap": "round" }); fx().appendChild(k); animiere(k, [{ transform: "translateY(0)", opacity: 0 }, { opacity: 1, offset: .3 }, { transform: `translateY(${-70 - i * 8}px)`, opacity: 0 }], 900, { delay: i * 70 * tempo }).then(() => k.remove()); }
        await partikel(m.x, m.y + 20, "#7BE3A0", 14, 60, 80, 850);
        if (a !== "trank") senken(p);
        await folgen(e);
      } else if (typ === "gruppe" || a === "kriegsschrei") {
        if (a === "kriegsschrei") {
          sfx("ruf"); const q = M(p);
          for (let i = 0; i < 3; i++) { const r = elt("circle", { cx: q.x, cy: q.y, r: 120, fill: "none", stroke: "#FF6B57", "stroke-width": 4, class: "vl-mitte" }); fx().appendChild(r); animiere(r, [{ transform: "scale(.1)", opacity: .9 }, { transform: "scale(1)", opacity: 0 }], 600, { delay: i * 150 * tempo }).then(() => r.remove()); }
          await animiere($("vl-f-" + p), [{ transform: "scale(1)" }, { transform: "scale(1.08)" }, { transform: "scale(1)" }], 500);
        } else {
          sfx("segen"); const farbe = a === "laeutern" ? "#BFF5D0" : "#FFE27A";
          for (const h of helden) { const q = pos[h.id]; const st = elt("path", { d: `M${q.x - 20} 0 L${q.x + 20} 0 L${q.x + 34} ${q.y} L${q.x - 34} ${q.y}z`, fill: farbe, opacity: 0 }); fx().appendChild(st); animiere(st, [{ opacity: 0 }, { opacity: .35, offset: .3 }, { opacity: 0 }], 1000).then(() => st.remove()); partikel(q.x, q.y - 60, farbe, 7, 50, 70, 900); }
          await warte(500);
        }
        await folgen(e);
      } else if (typ === "schutz") {
        sfx("schutz");
        const zielS = a === "arkan" || a === "beschuetzen" ? (e.ziel || p) : p;
        if (a === "beschuetzen") { const a1 = M(p), b = M(zielS); const band = elt("path", { d: `M${a1.x} ${a1.y} Q${(a1.x + b.x) / 2} ${a1.y - 60} ${b.x} ${b.y}`, fill: "none", stroke: "#FFE27A", "stroke-width": 4, "stroke-dasharray": "6 6" }); fx().appendChild(band); animiere(band, [{ opacity: 0 }, { opacity: 1, offset: .3 }, { opacity: 0 }], 900).then(() => band.remove()); }
        await blase(zielS, a === "arkan" ? "#B9A8FF" : a === "fels" ? "#FFE27A" : "#9EC5FF");
        await folgen(e);
      } else if (a === "verstecken") {
        partikel(M(p).x, M(p).y + 30, "#4A3F8A", 12, 60, 30, 700);
        await animiere($("vl-f-" + p), [{ opacity: 1 }, { opacity: .25 }, { opacity: .6 }], 700);
        await folgen(e);
        animiere($("vl-f-" + p), [{ opacity: 1 }], 400);
      } else if (a === "rauch") {
        sfx("gift");
        for (const g of gegner.filter(x => x.hp > 0)) { const m = M(g.id); for (let i = 0; i < 4; i++) { const w = elt("circle", { cx: m.x + (i - 1.5) * 18, cy: m.y + 10, r: 22, fill: "#8C8F9A", opacity: 0, class: "vl-mitte" }); fx().appendChild(w); animiere(w, [{ opacity: 0, transform: "scale(.4)" }, { opacity: .7, transform: "scale(1)", offset: .4 }, { opacity: 0, transform: "scale(1.4) translateY(-20px)" }], 1100, { delay: i * 80 * tempo }).then(() => w.remove()); } }
        await warte(700); await folgen(e);
      } else { await folgen(e); }
    }

    // ---------- Gegneraktionen ----------
    async function gegnerAktion(e) {
      const g = e.von, art = artVon(g), opfer = (e.d || []).filter(([id, d]) => d < 0 && istHeld(id)).map(x => x[0]);
      const ab = $("vl-ab-" + g); if (ab) animiere(ab, [{ transform: "scale(1)" }, { transform: "scale(1.12)" }, { transform: "scale(1)" }], 300);
      if (e.a === "starr") { blitz("#BFE8FF", .12); await animiere($("vl-f-" + g), [{ transform: "translateX(0)" }, { transform: "translateX(-3px)" }, { transform: "translateX(3px)" }, { transform: "translateX(0)" }], 300); await wort(g, "erstarrt", "#BFE8FF"); return; }
      if (e.a === "keinziel") { await wackeln(g); await wort(g, "?", "#F3F0FF"); return; }
      if (e.a === "flucht") {
        // huscht seitlich davon, ohne Schadenszahl
        const z = zust[g]; if (z) z.hp = 0;
        const ab2 = $("vl-ab-" + g); if (ab2) ab2.remove();
        wort(g, "flieht!", "#FFD447");
        const pl = $("vl-pl-" + g); if (pl) animiere(pl, [{ opacity: 1 }, { opacity: .25 }], 400);
        await animiere($("vl-f-" + g), [{ transform: "translateX(0)", opacity: 1 }, { transform: `translateX(${pos[g] && pos[g].x > 200 ? 160 : -160}px)`, opacity: 0 }], 700, { easing: "ease-in" });
        return;
      }
      if (e.a === "ruhe") { await wort(g, "sammelt Kraft", "#FFB547"); return; }
      if (e.a === "phase") {
        sfx("ruf"); blitz("#FFD447", .3); bebenBild(6);
        await animiere($("vl-f-" + g), [{ transform: "scale(1)" }, { transform: "scale(1.12)" }, { transform: "scale(1)" }], 600);
        await wort(g, e.phase === 3 ? "Wut!" : "Phase " + e.phase, "#FFD447"); return;
      }
      if (e.a === "regen") { const m = M(g); sfx("heil"); glut(m.x, m.y, "vl-heil", 60, 700); await folgen(e); return; }
      if (e.a === "explosion") {
        const m = M(g); sfx("knall"); bebenBild(9); blitz("#FF9A3C", .4);
        glut(m.x, m.y, "vl-glut", 120, 700); partikel(m.x, m.y, "#FF9A3C", 26, 120, 40, 800);
        for (const h of helden) partikel(pos[h.id].x, pos[h.id].y - 60, "#FFB547", 8, 50, 30, 600);
        await folgen(e); return;
      }
      if (e.a === "netz" && e.ziel && pos[e.ziel]) {
        sfx("gift"); const a1 = M(g), b = M(e.ziel);
        await flug({ x: a1.x, y: a1.y }, b, `<g ${L(1.5, "#F3F0FF")}><circle r="12"/><circle r="6"/><path d="M-14 0h28M0-14v28M-10-10l20 20M10-10l-20 20"/></g>`, 500, 30, true);
        await wort(e.ziel, "eingesponnen", "#F3F0FF"); return;
      }
      if (e.a === "schuetzen") {
        sfx("schutz"); const a1 = M(g), b = M(e.ziel);
        await flug({ x: a1.x + 20, y: a1.y - 30 }, b, `<circle r="12" fill="#9EC5FF" fill-opacity=".5" stroke="#5BA8FF" stroke-width="2.5"/>`, 450, 40, false, "#9EC5FF");
        await wort(e.ziel, "Schild", "#9EC5FF"); return;
      }
      if (e.a === "beute") { const m = M(g); sfx("heil"); await partikel(m.x, m.y, "#E8C24A", 16, 70, 50, 700); return; }
      if (e.a === "heilen") {
        sfx("heil"); const a1 = M(g), b = M(e.ziel);
        await flug({ x: a1.x + 20, y: a1.y - 30 }, b, `<circle r="12" fill="url(#vl-heil)"/><circle r="5" fill="#BFF5D0" stroke="${T}" stroke-width="1.5"/>`, 450, 40, false, "#7BE3A0");
        glut(b.x, b.y, "vl-heil", 50, 700); await folgen(e); return;
      }
      if (e.a === "beben") {
        sfx("stampfen");
        await animiere($("vl-f-" + g), [{ transform: "translateY(0)" }, { transform: "translateY(-24px)" }, { transform: "translateY(0)" }], 420, { easing: "ease-in" });
        sfx("knall"); bebenBild(10); blitz("#E23B2E", .25);
        for (const h of helden) partikel(pos[h.id].x, pos[h.id].y, "#8C8070", 8, 60, 30, 600);
        await folgen(e); return;
      }
      if (e.a === "ruf") {
        sfx("ruf");
        await animiere($("vl-f-" + g), [{ transform: "scale(1)" }, { transform: "scale(1.08)" }, { transform: "scale(1)" }], 500);
        for (const [id, , nach] of e.d || []) if (zust[id]) zust[id].hp = nach;   // z. B. ein Schleim, der sich teilt
        gegner = gegner.filter(x => x.hp > 0);    // Besiegte machen Platz
        for (const n of e.neu || []) { const z = Object.assign({ giftR: 0, markiert: 0 }, n); gegner.push(z); zust[z.id] = z; }
        // neu aufstellen: Bühne mit allen Gegnern neu zeichnen, die neuen steigen aus dem Boden
        bau = svgBauen({ gegner, helden, absicht: {}, ebene: R.start.ebene }); el.innerHTML = bau.svg; pos = bau.pos;
        svg = el.querySelector("svg");
        for (const n of e.neu || []) { const f = $("vl-f-" + n.id); if (f) animiere(f, [{ transform: "translateY(40px)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }], 700, { easing: "ease-out" }); }
        await warte(800); return;
      }
      // Angriff (auch Biss, daneben)
      const ziel = opfer[0] || e.ziel;
      if (!ziel || !pos[ziel]) { await folgen(e); return; }
      const w = $("vl-f-" + g) && $("vl-f-" + g).querySelector(".waffe");
      if (w) animiere(w, [{ transform: "rotate(0)" }, { transform: "rotate(-25deg)" }], 220);
      await warte(120);
      await vorstossen(g, ziel, .6);
      if (w) animiere(w, [{ transform: "rotate(-25deg)" }, { transform: "rotate(50deg)" }], 140);
      if (e.a === "daneben") { await wort(ziel, "daneben", "#F3F0FF"); }
      else {
        const prallt = !opfer.length;
        sfx(prallt ? "schutz" : "treffer"); if (!prallt) { bebenBild(art === "ork" || art === "koenig" || art === "orkhaeuptling" ? 7 : 4); blitz(e.a === "biss" ? "#8BD14A" : "#E23B2E", .18); }
        if (e.a === "biss") partikel(M(ziel).x, M(ziel).y, "#8BD14A", 10, 50, 30, 600);
        if (prallt) wort(ziel, "abgeprallt", "#9EC5FF");
        if (e.a === "stehlen" && e.gold) { const m = M(ziel); partikel(m.x, m.y, "#E8C24A", 10, 50, 40, 600); setTimeout(() => wort(ziel, `−${e.gold} Gold`, "#FFD447"), 450); }
        await folgen(e);
      }
      if (w) animiere(w, [{ transform: "rotate(0)" }], 260);
      await zurueck(g);
    }

    // ---------- Ablauf ----------
    await warte(250);
    for (const e of R.ev) {
      if (info.abbruch()) break;
      info.sag(e.text);
      try {
        if (e.a === "giftTick") { const m = M(e.von); sfx("gift"); partikel(m.x, m.y + 20, "#8BD14A", 10, 40, 60, 600); await folgen(e, "#B6F07A"); }
        else if (istHeld(e.von)) await heldAktion(e);
        else await gegnerAktion(e);
      } catch (x) { if (window.console) console.error(x); }
      await warte(260);
    }
  }

  window.VBuehne = { zeichne, abspielen, audio, figur: art => GEG[art] || null };
})();
