// Verlies zu dritt: Tuschezeichnungen für Räume, Gegner und Helden (inline SVG, Tinte auf Pergament).
(function () {
  const T = "#2A2118";            // Tinte
  const R = "#9E2B1F";            // Rötel
  const G = "#3E7A55";            // Grünspan
  const L = `fill="none" stroke="${T}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"`;
  const F = c => `fill="${c}" stroke="${T}" stroke-width="3" stroke-linejoin="round"`;
  const boden = `<path d="M10 104 Q60 98 100 103 T190 101" ${L}/><path d="M24 112h20M70 110h14M120 112h26M164 110h12" ${L} stroke-width="2"/>`;
  const bogen = (x, w) => `<path d="M${x} 104V44a${w / 2} ${w / 2} 0 0 1 ${w} 0v60" ${L}/>`;

  const B = {
    eingang: `${boden}<path d="M60 104l18-18h44l18 18M74 90h52M70 96h60" ${L}/><path d="M78 86V30h44v56" ${L}/>${[86, 96, 106, 116].map(x => `<path d="M${x} 30v56" ${L} stroke-width="2"/>`).join("")}<path d="M78 46h44M78 64h44" ${L} stroke-width="2"/><circle cx="40" cy="40" r="7" ${F(R)}/><path d="M40 47v20M34 72h12" ${L}/><circle cx="160" cy="40" r="7" ${F(R)}/><path d="M160 47v20M154 72h12" ${L}/>`,
    tueren: `${boden}${bogen(40, 44)}${bogen(116, 44)}<circle cx="76" cy="76" r="3" fill="${T}"/><circle cx="124" cy="76" r="3" fill="${T}"/><path d="M48 60h28M48 80h28M124 60h28M124 80h28" ${L} stroke-width="2"/><path d="M100 30v-12M95 23l5-5 5 5" ${L}/>`,
    "boss-tuer": `${boden}<path d="M50 104V38q50-34 100 0v66" ${F("#3A2E26")}/><path d="M100 22v82" ${L}/><circle cx="90" cy="70" r="5" ${F(R)}/><circle cx="110" cy="70" r="5" ${F(R)}/><path d="M70 46q30-16 60 0" ${L} stroke="${G}"/>`,
    truhe: `${boden}<path d="M54 98V66h92v32z" ${F("#C79A5B")}/><path d="M54 66q0-22 46-22t46 22" ${F("#C79A5B")}/><path d="M54 66h92M70 46v52M130 46v52" ${L}/><rect x="92" y="62" width="16" height="16" rx="3" ${F("#E8C24A")}/><path d="M100 70v4" ${L}/><path d="M36 50l6-6M164 50l-6-6M100 30v-8M40 74h-8M168 74h-8" ${L} stroke="${R}" stroke-width="2"/>`,
    feuer: `${boden}<path d="M70 102l60-10M70 92l60 10" ${L} stroke-width="5"/><path d="M100 90c-18-8-14-26-4-38 0 10 8 12 10 4 8 10 14 26-6 34z" ${F("#E8892F")}/><path d="M100 88c-6-4-6-12 0-18 4 6 8 10 0 18z" ${F("#F5CF4A")}/><path d="M40 60q6-8 0-16M156 58q-6-8 0-16" ${L} stroke-width="2"/>`,
    brunnen: `${boden}<path d="M60 102V70h80v32z" ${F("#B9AD99")}/><path d="M60 82h80M60 92h80M80 70v12M120 70v12M100 82v10" ${L} stroke-width="2"/><ellipse cx="100" cy="70" rx="40" ry="8" ${F("#6FB7D9")}/><path d="M64 70V34h72v36M58 34h84" ${L}/><path d="M100 34v18" ${L}/><path d="M94 52h12v10H94z" ${F("#8A6A44")}/>`,
    troll: `${boden}<path d="M40 102q-6-40 34-46 40-4 50 20 8 22-6 26z" ${F("#7C8F64")}/><circle cx="70" cy="74" r="2.5" fill="${T}"/><path d="M60 82q8 4 16 0" ${L}/><path d="M86 56q6-8 14-4" ${L}/><text x="94" y="44" font-family="serif" font-size="16" fill="${T}">z z</text><path d="M140 102q4-14 14-14t14 14z" ${F("#E8C24A")}/><circle cx="150" cy="96" r="3" ${F("#E8C24A")}/><circle cx="160" cy="98" r="3" ${F("#E8C24A")}/>`,
    haendler: `${boden}<path d="M70 104q0-48 30-60 30 12 30 60z" ${F("#5B4A6E")}/><path d="M86 66q14-20 28 0" ${F("#2A2118")}/><circle cx="94" cy="62" r="2" fill="#F5CF4A"/><circle cx="106" cy="62" r="2" fill="#F5CF4A"/><path d="M136 86h30v18h-30z" ${F("#8A6A44")}/><path d="M144 86v-8h6v8M154 86v-12h6v12" ${F("#C04A7A")}/>`,
    altar: `${boden}<path d="M66 102V70h68v32z" ${F("#B9AD99")}/><path d="M58 70h84v-8H58z" ${F("#CFC4B0")}/><path d="M86 62q14-14 28 0" ${F("#E8C24A")}/><path d="M76 84h48M76 92h30" ${L} stroke-width="2"/><path d="M100 40v-12M90 34l-6-6M110 34l6-6" ${L} stroke="${R}"/>`,
    bruecke: `<path d="M10 70h40M150 70h40" ${L}/><path d="M50 70q50 26 100 0" ${L}/>${[62, 76, 90, 104, 118, 132].map((x, i) => `<path d="M${x} ${74 + [3, 7, 9, 9, 7, 3][i]}v10" ${L} stroke-width="2"/>`).join("")}<path d="M50 50q50 26 100 0" ${L} stroke-width="2"/><path d="M50 50v20M150 50v20" ${L}/><path d="M70 104l6-8 6 8M118 108l6-8 6 8" ${L} stroke-width="2"/>`,
    ratte: `${boden}<path d="M50 96q4-26 40-26 30 0 36 18l14 4-14 6q-20 6-76-2z" ${F("#8C7A6B")}/><circle cx="128" cy="90" r="2.5" fill="${R}"/><path d="M50 94q-26 4-30-12" ${L}/><path d="M112 74q4-10 10-4" ${L}/><path d="M74 98v6M100 98v6" ${L}/>`,
    goblin: `${boden}<path d="M80 104V76h40v28" ${F("#7C8F64")}/><circle cx="100" cy="58" r="18" ${F("#7C8F64")}/><path d="M82 54l-18-10 14 18M118 54l18-10-14 18" ${F("#7C8F64")}/><circle cx="93" cy="56" r="2.5" fill="${R}"/><circle cx="107" cy="56" r="2.5" fill="${R}"/><path d="M92 66l4 3 4-3 4 3 4-3" ${L} stroke-width="2"/><path d="M124 80l20-24" ${L} stroke-width="4"/><path d="M140 52l8 8" ${L}/>`,
    spinne: `${boden}<path d="M100 10v44" ${L} stroke-width="1.5"/>${[-1, 1].map(s => [0, 1, 2, 3].map(i => `<path d="M100 ${66 + i * 3}q${s * (26 + i * 4)} ${-18 + i * 8} ${s * (40 + i * 2)} ${10 + i * 6}" ${L} stroke-width="2.5"/>`).join("")).join("")}<ellipse cx="100" cy="72" rx="16" ry="14" ${F("#3A2E26")}/><circle cx="100" cy="56" r="8" ${F("#3A2E26")}/><circle cx="96" cy="55" r="2" fill="${R}"/><circle cx="104" cy="55" r="2" fill="${R}"/><path d="M100 66l-4 6 4 6 4-6z" fill="${R}"/>`,
    skelett: `${boden}<circle cx="100" cy="40" r="15" ${F("#EDE4D0")}/><circle cx="94" cy="40" r="3.5" fill="${T}"/><circle cx="106" cy="40" r="3.5" fill="${T}"/><path d="M96 50h8" ${L} stroke-width="2"/><path d="M100 55v32M86 64q14 6 28 0M86 72q14 6 28 0M88 80q12 5 24 0M100 87l-12 16M100 87l12 16M100 60l-22 18M100 60l22 14" ${L}/><path d="M122 74l18-30" ${L} stroke-width="4"/>`,
    schamane: `${boden}<path d="M80 104V76h40v28" ${F("#5B4A6E")}/><circle cx="100" cy="58" r="17" ${F("#7C8F64")}/><path d="M82 54l-16-8 12 16M118 54l16-8-12 16" ${F("#7C8F64")}/><path d="M84 46q16-20 32 0" ${F("#5B4A6E")}/><circle cx="94" cy="58" r="2.5" fill="#F5CF4A"/><circle cx="106" cy="58" r="2.5" fill="#F5CF4A"/><path d="M130 104V40" ${L} stroke-width="4"/><circle cx="130" cy="36" r="7" ${F(G)}/>`,
    ork: `${boden}<path d="M66 104V74q34-16 68 0v30" ${F("#5E7350")}/><circle cx="100" cy="52" r="22" ${F("#5E7350")}/><path d="M86 62v-8M114 62v-8" ${L} stroke="#EDE4D0" stroke-width="4"/><path d="M88 46l8 4M112 46l-8 4" ${L}/><circle cx="92" cy="52" r="2.5" fill="${R}"/><circle cx="108" cy="52" r="2.5" fill="${R}"/><path d="M140 104V48" ${L} stroke-width="5"/><path d="M140 48q20 4 18 24-10-8-18-6" ${F("#9A9A9A")}/>`,
    koenig: `${boden}<path d="M54 104V50h92v54" ${F("#3A2E26")}/><path d="M54 50l10-18 10 18 10-22 16 22 16-22 10 22 10-18 10 18" ${F("#3A2E26")}/><circle cx="100" cy="66" r="17" ${F("#EDE4D0")}/><path d="M86 50l4-12 6 8 4-10 4 10 6-8 4 12z" ${F("#E8C24A")}/><circle cx="94" cy="66" r="4" fill="${G}"/><circle cx="106" cy="66" r="4" fill="${G}"/><path d="M96 76h8M100 83v21M84 92q16 6 32 0" ${L}/>`,
    sieg: `${boden}<path d="M70 104l60-60M130 104L70 44" ${L} stroke-width="5"/><path d="M64 50l12-12M136 50l-12-12" ${L} stroke-width="7"/><circle cx="100" cy="74" r="10" ${F("#E8C24A")}/>`,
    krone: `${boden}<path d="M56 86l-6-40 26 20 24-32 24 32 26-20-6 40z" ${F("#E8C24A")}/><path d="M56 86h88v12H56z" ${F("#E8C24A")}/><circle cx="76" cy="66" r="4" ${F(R)}/><circle cx="100" cy="58" r="5" ${F(G)}/><circle cx="124" cy="66" r="4" ${F(R)}/>`,
    grab: `${boden}<path d="M74 104V54q26-28 52 0v50" ${F("#B9AD99")}/><path d="M100 60v28M90 70h20" ${L}/><path d="M50 104q4-12 10 0M140 104q4-14 12 0" ${L} stroke="${G}"/>`,
    // Helden
    kaempfer: `<path d="M60 20h80v40q0 36-40 52-40-16-40-52z" ${F("#D9583B")}/><path d="M100 26v80M66 56h68" ${L} stroke="#F3E6CC" stroke-width="5"/>`,
    dieb: `<path d="M48 54q52-34 104 0-52 30-104 0z" ${F("#8E7CF0")}/><circle cx="80" cy="54" r="7" fill="#F3E6CC" stroke="${T}" stroke-width="3"/><circle cx="120" cy="54" r="7" fill="#F3E6CC" stroke="${T}" stroke-width="3"/><path d="M90 92l40-40M124 52l10-4-4 10" ${L} stroke-width="4"/>`,
    heilerin: `<path d="M100 112V38" ${L} stroke-width="5"/><path d="M100 40q-30-6-30-28 26-2 30 22 4-24 30-22 0 22-30 28z" ${F("#4FB98A")}/><circle cx="100" cy="40" r="8" ${F("#F5CF4A")}/>`
  };

  window.VB = {
    bild(k, cls) { const s = B[k]; return s ? `<svg class="${cls || "bild"}" viewBox="0 0 200 120" role="img" aria-hidden="true">${s}</svg>` : ""; },
    held(rolle) { return `<svg class="heldbild" viewBox="40 8 120 108" aria-hidden="true">${B[rolle] || ""}</svg>`; }
  };
})();
