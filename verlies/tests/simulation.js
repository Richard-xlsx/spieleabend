const path = require('path'), os = require('os');
const LOGIK = path.join(__dirname, '..', 'verlies-logic.js');
const AUS = path.join(os.tmpdir(), 'verlies-tests'); require('fs').mkdirSync(AUS, { recursive: true });
const URL_BASIS = process.env.VERLIES_URL || 'http://localhost:8765';
const fs=require('fs'),vm=require('vm');const ctx={window:{},console};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(LOGIK,'utf8'),ctx);const V=ctx.window.VL;
function waehle(S,p,klug){
  const h=S.helden[p]; if(!klug) return V.standardWahl(S,p);
  const akt=V.aktionenVon(h).filter(a=>!((a.cd||a.meister)&&(h.cd[a.id]||0)>0));
  const g=V.gegnerLebend(S), tot=S.teilnehmer.find(q=>S.helden[q].hp<=0), schwach=S.teilnehmer.filter(q=>S.helden[q].hp>0&&S.helden[q].hp<S.helden[q].max*0.45);
  const hat=id=>akt.find(a=>a.id===id);
  if(h.hp<h.max*0.35&&hat('trank')) return {a:'trank'};
  if(tot){ for(const id of ['gnade','lebensquell','auferstehung','erloesung','wiedergeburt','gnadenlicht']) if(hat(id)) return {a:id}; for(const id of ['heilen','handauflegen','kraeuter']) if(hat(id)) return {a:id,ziel:tot}; }
  // Ankündigungen kontern wie echte Spieler: Spezialzüge (Verstärkung, Beben, Netz) durch Erstarren verhindern,
  // wenn noch niemand anderes dieses Ziel diese Runde erstarren lässt
  const ab=S.kampf.absicht||{}, gew=Object.values(S.kampf.wahl||{});
  const gefahr=g.filter(x=>ab[x.id]&&['ruf','beben','netz'].includes(ab[x.id].a)&&!(x.starr>0)&&!gew.some(w=>['eis','ranken'].includes(w.a)&&w.ziel===x.id)).sort((x,y)=>(V.GEGNER[y.art].boss?1:0)-(V.GEGNER[x.art].boss?1:0));
  if(gefahr.length){ if(gefahr.length>=2&&!gew.some(w=>['winter','zeitstillstand'].includes(w.a))) for(const id of ['zeitstillstand','winter']) if(hat(id)) return {a:id};
    for(const id of ['eis','ranken']) if(hat(id)) return {a:id,ziel:gefahr[0].id}; }
  if(schwach.length>=2) for(const id of ['gnade','lebensquell','ewigschild','erloesung','heiligtum','wall','bollwerk','schlachtruf','gnadenlicht','laeutern','segen','licht','wiedergeburt','frost']) if(hat(id)) return {a:id};
  if(schwach.length) { for(const id of ['heilen','handauflegen','kraeuter']) if(hat(id)) return {a:id,ziel:schwach[0]};
    if(hat('schild')&&!schwach.includes(p)) return {a:'schild'}; if(hat('fels')) return {a:'fels'};
    if(hat('arkan')) return {a:'arkan',ziel:schwach[0]}; if(hat('obhut')) return {a:'obhut',ziel:schwach[0]}; if(hat('beschuetzen')&&schwach[0]!==p) return {a:'beschuetzen',ziel:schwach[0]}; if(hat('rauch')) return {a:'rauch'}; }
  if(g.length>=2) for(const id of ['sternenfall','feuerweihe','schwarztod','ansturm','zeitstillstand','wildnis','klingensturm','schattentanz','inferno','durchschuss','seuche','winter','sonnenzorn','treibjagd','raserei','wolfsrudel','meteor','giftwolke','hagel','sonnenstrahl','feuerball','wirbel','licht','doppel']) if(hat(id)) return {a:id};
  // kluge Spieler: erst Langfinger, Heiler, Beschwörer; steht der Knochenschild, erst die Skelette
  const prio=g.find(x=>V.GEGNER[x.art].langfinger)||g.find(x=>V.GEGNER[x.art].heiler||V.GEGNER[x.art].beschwoerer||V.GEGNER[x.art].schildtraeger)||(g.some(x=>V.knochenschild(S,x))?g.find(x=>!V.GEGNER[x.art].boss):null);
  const gross=prio||g.slice().sort((a,b)=>b.hp-a.hp)[0];
  for(const id of ['sternschuss','gottesurteil','todesstoss','meisterdieb','vernichten','kopfschuss','eis','ranken','markieren','gift','kriegsschrei','spott','taschendieb']) if(hat(id)) { const a=hat(id); return {a:id,ziel:a.ziel==='gegner'?gross.id:null}; }
  if(h.rolle==='dieb'&&hat('verstecken')&&h.hp<h.max*0.5) return {a:'verstecken'};
  return {a:V.AKTIONEN[h.rolle][0].id, ziel:(prio||g.sort((a,b)=>a.hp-b.hp)[0]).id};
}
const FLUECHE=(process.env.FLUECHE||'').split(',').filter(Boolean);
const LAENGE=+(process.env.EBENEN||2), SCHWERE=+(process.env.SCHWERE||2), GROESSE=+(process.env.GRUPPE||3);
const KAEMPFE=[]; let DUO=false; const STATS={tod:{},ast:{},stufe:0,n:0,raenge:0,raeume:{},elite:0,kammer:0,spiele:0};
// Talentpunkte: jeder Held folgt einem zufällig gewählten Ast (fest für die Partie), danach dem nächsten
function punkte(S,klug){
  if(!klug) return S;
  for(const p of S.teilnehmer){ for(let n=0;n<20;n++){ const h=S.helden[p]; if(h.punkte<1)break;
    if(!h.__ast){ const ae=V.AESTE[h.rolle].map(a=>a.id); for(let i=ae.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[ae[i],ae[j]]=[ae[j],ae[i]];} h.__ast=ae; }
    let id=null; for(const ast of h.__ast){ const a=V.AESTE[h.rolle].find(x=>x.id===ast); id=a.knoten.map(k=>V.TALENT[k].alt&&V.talentWaehlbar(h,k)&&Math.random()<(+process.env.WAHL_B||.5)?V.TALENT[k].alt:k).find(k=>V.talentWaehlbar(h,k)); if(id)break; }
    if(!id)break; const vor=S; const reihe=h.__ast; S=V.aktion(S,p,{t:'talent',id,nr:S.spielNr}); if(S===vor) throw new Error('Talent abgelehnt '+id); S.helden[p].__ast=reihe; }
    // Ruhmespunkte: erst die Spezialisierung (zufällig, fest), dann Kraft, Hornhaut, Leben im Wechsel
    for(let n=0;n<40;n++){ const h=S.helden[p]; if(!(h.ruhm>0))break; const reihe=h.__ast, spez=h.__spez;
      if(!h.__spez) h.__spez=V.AUFSTIEG_AESTE[h.rolle][Math.random()<.5?0:1].id;
      const a=V.AUFSTIEG_AESTE[h.rolle].find(x=>x.id===h.__spez), id=a.knoten.find(k=>V.talentWaehlbar(h,k)); const vor=S, sp=h.__spez;
      if(id) S=V.aktion(S,p,{t:'talent',id,nr:S.spielNr});
      else { const b=['kraft','haut','leben','trank','heil'].find(x=>V.ruhmVon(h,x)<Math.min(V.RUHM[x].max,x==='leben'?99:x==='heil'?(['heilerin','paladin'].includes(h.rolle)?5:0):99)&&(x!=='kraft'||V.ruhmVon(h,'kraft')<=V.ruhmVon(h,'haut')+1)) || 'leben'; S=V.aktion(S,p,{t:'ruhm',id:b,nr:S.spielNr}); }
      if(S===vor) break; S.helden[p].__ast=reihe; S.helden[p].__spez=sp; } }
  return S;
}
function einkaufen(S,p,klug){
  for(let n=0;n<10;n++){ const h=S.helden[p]; const ang=V.angebot(h).filter(w=>!w.aus&&w.preis<=h.gold);
    if(!ang.length) break;
    const pr=klug?['waffe','ruestung','leben','trank']:['trank','waffe'];
    let w=null; for(const k of pr){ w=ang.find(x=>x.id.startsWith(k)); if(w) break; } if(!w) break;
    const vor=S; S=V.aktion(S,p,{t:'kaufen',id:w.id,nr:S.spielNr}); if(S===vor) throw new Error('Kauf abgelehnt');
  }
  return V.aktion(S,p,{t:'fertig',nr:S.spielNr});
}
function spiel(seed, rollen, klug){
  let S=V.neu('ABCD','p0','A',seed); const pids=rollen.map((_,i)=>'p'+i);
  for(let i=1;i<pids.length;i++) S=V.aktion(S,pids[i],{t:'join',name:'S'+i});
  pids.forEach((p,i)=>S=V.aktion(S,p,{t:'rolle',rolle:rollen[i]}));
  S=V.aktion(S,'p0',{t:'laenge',n:LAENGE}); S=V.aktion(S,'p0',{t:'schwere',n:SCHWERE}); for(const f of FLUECHE) S=V.aktion(S,'p0',{t:'fluch',id:f}); S=V.aktion(S,'p0',{t:'start',mindestens:1}); if(S.phase!=='erkunden') throw new Error('Start');
  let schritte=0, lager=0, gold=0, F=null;
  while(S.phase!=='ende' && schritte++<(+process.env.SCHRITTE||(LAENGE===4?60000:3000)) && !(LAENGE===4 && S.ebene>(+process.env.BIS||14))){
    if(S.phase==='erkunden'){ S=punkte(S,klug); const e=S.entscheidung; const q=S.teilnehmer.reduce((a,x)=>a+S.helden[x].hp/S.helden[x].max,0)/S.teilnehmer.length;
      const frei=e.optionen.map((o,i)=>i).filter(i=>!e.optionen[i].gesperrt);
      for(const p of S.teilnehmer){ let i=frei[Math.floor(Math.random()*frei.length)];
        if(e.art==='karte'&&klug){ const ohne=frei.filter(j=>!e.optionen[j].geheim); i=ohne[Math.floor(Math.random()*ohne.length)]; const f=t=>ohne.find(j=>e.optionen[j].typ===t);
          if(f('kammer')!==undefined)i=f('kammer'); else if(q<0.6&&f('rast')!==undefined)i=f('rast'); else if(V.goldSumme(S)/S.teilnehmer.length>=45&&f('haendler')!==undefined)i=f('haendler'); }
        if(e.art==='rast'&&klug) i=q<0.75?0:1;
        if(e.art==='truhe')i=0; S=V.aktion(S,p,{t:'stimme',i,nr:S.spielNr}); if(S.entscheidung!==e && !(S.entscheidung&&S.entscheidung.stimmen[p]!==undefined)) break; } }
    else if(S.phase==='lager'){ lager++; gold+=V.goldSumme(S)/S.teilnehmer.length; for(const p of S.teilnehmer) { if(S.phase!=='lager')break; S=einkaufen(S,p,klug);} }
    else if(S.phase==='kampf'){ const r=S.kampf.runde;
      for(const p of V.lebend(S)){ if(S.phase!=='kampf'||S.kampf.runde!==r)break;
        const w=waehle(S,p,klug); const vor=S; S=V.aktion(S,p,Object.assign({t:'wahl',runde:r},w));
        if(S===vor){ S=V.aktion(S,p,Object.assign({t:'wahl',runde:r},V.standardWahl(S,p))); if(S===vor) throw new Error('Wahl abgelehnt '+JSON.stringify(w)); } } }
    if(schritte>(+process.env.SCHRITTE||3000)-4&&S.kampf) console.log('HÄNGER', S.kampf.runde, JSON.stringify(S.teilnehmer.map(p=>[S.helden[p].rolle,S.helden[p].hp,S.helden[p].cd,S.helden[p].netz])), JSON.stringify(S.gegner.map(g=>[g.art,g.hp,g.max,g.schutz])), JSON.stringify(S.kampf.absicht), S.log.join(' / '));
    // Kampfwerte: Runden und K.o. je Kampf (nur kluge Partien)
    if(klug&&!DUO){ const ko=S.teilnehmer.reduce((x,q)=>x+S.helden[q].stats.umgefallen,0);
      if(S.kampf){ if(!F) F={e:S.ebene,typ:(S.karte.knoten[S.karte.pos]||{}).typ,ko0:ko}; F.r=S.kampf.runde; F.ko=ko-F.ko0; }
      else if(F){ F.ko=ko-F.ko0; KAEMPFE.push(F); F=null; } }
    for(const p of S.teilnehmer){const h=S.helden[p]; if(!(h.hp>=0&&h.hp<=h.max)||isNaN(h.hp)||h.gold<0||isNaN(h.gold)) throw new Error('Held kaputt '+JSON.stringify(h));}
    for(const g of S.gegner) if(isNaN(g.hp)||g.hp>g.max||g.hp<0) throw new Error('Gegner kaputt '+JSON.stringify(g));
  }
  if(LAENGE===4){ STATS.tiefe=STATS.tiefe||[]; if(klug) STATS.tiefe.push(S.ebene); STATS.stufeMax=Math.max(STATS.stufeMax||0,...S.teilnehmer.map(p=>S.helden[p].stufe)); }
  if(S.phase!=='ende' && LAENGE!==4) throw new Error('endet nicht '+rollen+' '+S.phase+' Raum '+S.raumNr+' Runde '+(S.kampf&&S.kampf.runde)+' '+JSON.stringify(S.gegner.map(g=>[g.art,g.hp,g.max])));
  if(klug&&S.ergebnis!=='sieg'){ const k=S.karte.knoten[S.karte.pos]; const wo='E'+S.ebene+' '+(k.typ==='boss'?'Endgegner':k.typ+' '+[...new Set(S.gegner.map(g=>g.art))].sort().join('+')); STATS.tod[wo]=(STATS.tod[wo]||0)+1; }
  if(klug){ STATS.spiele++; for(const id of S.karte.weg){ const t=S.karte.knoten[id].typ; STATS.raeume[t]=(STATS.raeume[t]||0)+1; } }
  if(klug){ for(const p of S.teilnehmer){ STATS.stufe+=S.helden[p].stufe; STATS.gold=(STATS.gold||0)+S.helden[p].gold; STATS.n++; STATS.raenge+=S.helden[p].talente.length; const ast=S.helden[p].rolle+'/'+(S.helden[p].__ast||['-'])[0]; const z=STATS.ast[ast]=STATS.ast[ast]||[0,0]; z[0]++; if(S.ergebnis==='sieg')z[1]++;} }
  return {sieg:S.ergebnis==='sieg', lager, goldVorLager:gold/Math.max(1,lager)};
}
const R=['kaempfer','dieb','heilerin','magierin','waldlaeufer','paladin'];
const trios=[]; (function k(ab,l){ if(l.length===GROESSE){trios.push(l);return;} for(let i=ab;i<6;i++)k(i+1,l.concat(R[i])); })(0,[]);   // alle Gruppen der gewählten Größe
const N=+process.argv[2]||300; const zeilen=[];
for(const t of trios){ let sk=0,ss=0,lg=0,gl=0; for(let i=1;i<=N;i++){ const r=spiel(i*7919+t.join().length,t,true); if(r.sieg)sk++; lg+=r.lager; gl+=r.goldVorLager; if(spiel(i*104729,t,false).sieg)ss++; }
  zeilen.push([t.join('+'),Math.round(100*sk/N),Math.round(100*ss/N),(lg/N).toFixed(1),Math.round(gl/N)]); }
zeilen.sort((a,b)=>b[1]-a[1]); for(const z of zeilen) console.log(z[0].padEnd(30),'klug',String(z[1]).padStart(3)+'%','simpel',String(z[2]).padStart(3)+'%','Lager',z[3],'Ø Gold je Lager',z[4]);
console.log('Räume je Partie (klug):', Object.entries(STATS.raeume).map(([t,n])=>t+' '+(n/STATS.spiele).toFixed(2)).join(', '));
console.log('Ebenen',LAENGE,'Stufe',V.SCHWERE[SCHWERE].name,'Gruppe',GROESSE,'Flüche',FLUECHE.join('+')||'-','Ø Gold am Ende',Math.round(STATS.gold/STATS.n));console.log('Ø Stufe am Ende', (STATS.stufe/STATS.n).toFixed(1), 'Ø Talente', (STATS.raenge/STATS.n).toFixed(1));
if(STATS.tiefe){ const t=STATS.tiefe.slice().sort((a,b)=>a-b); const v={}; for(const e of t) v[e]=(v[e]||0)+1; console.log('Tiefe erreicht (Ebene: Partien):', JSON.stringify(v), 'Median', t[Math.floor(t.length/2)], 'höchste Stufe', STATS.stufeMax); }
const k=zeilen.map(z=>z[1]); console.log('klug: min',Math.min(...k),'max',Math.max(...k),'Schnitt',Math.round(k.reduce((a,b)=>a+b)/k.length));
const s2=zeilen.map(z=>z[2]); console.log('simpel Schnitt',Math.round(s2.reduce((a,b)=>a+b)/s2.length));
{ const gr={}; for(const f of KAEMPFE){ const k='Ebene '+f.e+' '+(f.typ==='boss'?'Endgegner':f.typ==='elite'?'Elite':'normal'); (gr[k]=gr[k]||[]).push(f); }
  console.log('Kampfwerte (klug):'); for(const k of Object.keys(gr).sort()){ const a=gr[k], n=a.length;
    console.log('  '+k.padEnd(20),'Runden Ø',(a.reduce((x,f)=>x+f.r,0)/n).toFixed(1).padStart(5),' K.o. Ø',(a.reduce((x,f)=>x+f.ko,0)/n).toFixed(2).padStart(5),' Kämpfe mit K.o.',(Math.round(100*a.filter(f=>f.ko>0).length/n)+'%').padStart(4),' ('+n+')'); } }
DUO=true;
if(GROESSE===3) for(const d of [['kaempfer','heilerin'],['paladin','magierin'],['dieb','waldlaeufer']]){ let w=0; for(let i=1;i<=N;i++) if(spiel(i*31,d,true).sieg)w++; console.log('zu zweit',d.join('+'),Math.round(100*w/N)+'%'); }

console.log('Siegquote nach Hauptast (klug, Dreiergruppen):');for(const [k,[n,w]] of Object.entries(STATS.ast).sort()) console.log('  '+k.padEnd(30), Math.round(100*w/n)+'%', '('+n+')');
console.log('Niederlagen (klug) nach Ort:'); for(const [k,n] of Object.entries(STATS.tod).sort((a,b)=>b[1]-a[1]).slice(0,14)) console.log('  '+k.padEnd(40), n);
