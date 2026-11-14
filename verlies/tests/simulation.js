const path = require('path'), os = require('os');
const LOGIK = path.join(__dirname, '..', 'verlies-logic.js');
const AUS = path.join(os.tmpdir(), 'verlies-tests'); require('fs').mkdirSync(AUS, { recursive: true });
const URL_BASIS = process.env.VERLIES_URL || 'http://localhost:8765';
const fs=require('fs'),vm=require('vm');const ctx={window:{},console};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(LOGIK,'utf8'),ctx);const V=ctx.window.VL;
function waehle(S,p,klug){
  const h=S.helden[p]; if(!klug) return V.standardWahl(S,p);
  const akt=V.aktionenVon(h).filter(a=>!(a.cd&&(h.cd[a.id]||0)>0));
  const g=V.gegnerLebend(S), tot=S.teilnehmer.find(q=>S.helden[q].hp<=0), schwach=S.teilnehmer.filter(q=>S.helden[q].hp>0&&S.helden[q].hp<S.helden[q].max*0.45);
  const hat=id=>akt.find(a=>a.id===id);
  if(h.hp<h.max*0.35&&hat('trank')) return {a:'trank'};
  if(tot){ for(const id of ['auferstehung','erloesung','wiedergeburt','gnadenlicht']) if(hat(id)) return {a:id}; for(const id of ['heilen','handauflegen','kraeuter']) if(hat(id)) return {a:id,ziel:tot}; }
  if(schwach.length>=2) for(const id of ['erloesung','heiligtum','wall','bollwerk','schlachtruf','gnadenlicht','laeutern','segen','licht','wiedergeburt','frost']) if(hat(id)) return {a:id};
  if(schwach.length) { for(const id of ['heilen','handauflegen','kraeuter']) if(hat(id)) return {a:id,ziel:schwach[0]};
    if(hat('schild')&&!schwach.includes(p)) return {a:'schild'}; if(hat('fels')) return {a:'fels'};
    if(hat('arkan')) return {a:'arkan',ziel:schwach[0]}; if(hat('obhut')) return {a:'obhut',ziel:schwach[0]}; if(hat('beschuetzen')&&schwach[0]!==p) return {a:'beschuetzen',ziel:schwach[0]}; if(hat('rauch')) return {a:'rauch'}; }
  if(g.length>=2) for(const id of ['inferno','durchschuss','seuche','winter','sonnenzorn','treibjagd','raserei','wolfsrudel','meteor','giftwolke','hagel','sonnenstrahl','feuerball','wirbel','licht','doppel']) if(hat(id)) return {a:id};
  const gross=g.slice().sort((a,b)=>b.hp-a.hp)[0];
  for(const id of ['gottesurteil','todesstoss','meisterdieb','vernichten','kopfschuss','eis','ranken','markieren','gift','kriegsschrei','spott','taschendieb']) if(hat(id)) { const a=hat(id); return {a:id,ziel:a.ziel==='gegner'?gross.id:null}; }
  if(h.rolle==='dieb'&&hat('verstecken')&&h.hp<h.max*0.5) return {a:'verstecken'};
  return {a:V.AKTIONEN[h.rolle][0].id, ziel:g.sort((a,b)=>a.hp-b.hp)[0].id};
}
const STATS={ast:{},stufe:0,n:0,raenge:0,raeume:{},elite:0,kammer:0,spiele:0};
// Talentpunkte: jeder Held folgt einem zufällig gewählten Ast (fest für die Partie), danach dem nächsten
function punkte(S,klug){
  if(!klug) return S;
  for(const p of S.teilnehmer){ for(let n=0;n<20;n++){ const h=S.helden[p]; if(h.punkte<1)break;
    if(!h.__ast){ const ae=V.AESTE[h.rolle].map(a=>a.id); for(let i=ae.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[ae[i],ae[j]]=[ae[j],ae[i]];} h.__ast=ae; }
    let id=null; for(const ast of h.__ast){ const a=V.AESTE[h.rolle].find(x=>x.id===ast); id=a.knoten.find(k=>V.talentWaehlbar(h,k)); if(id)break; }
    if(!id)break; const vor=S; const reihe=h.__ast; S=V.aktion(S,p,{t:'talent',id,nr:S.spielNr}); if(S===vor) throw new Error('Talent abgelehnt '+id); S.helden[p].__ast=reihe; } }
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
  S=V.aktion(S,'p0',{t:'start',mindestens:1}); if(S.phase!=='erkunden') throw new Error('Start');
  let schritte=0, lager=0, gold=0;
  while(S.phase!=='ende' && schritte++<3000){
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
    for(const p of S.teilnehmer){const h=S.helden[p]; if(!(h.hp>=0&&h.hp<=h.max)||isNaN(h.hp)||h.gold<0||isNaN(h.gold)) throw new Error('Held kaputt '+JSON.stringify(h));}
    for(const g of S.gegner) if(isNaN(g.hp)||g.hp>g.max||g.hp<0) throw new Error('Gegner kaputt '+JSON.stringify(g));
  }
  if(S.phase!=='ende') throw new Error('endet nicht');
  if(klug){ STATS.spiele++; for(const id of S.karte.weg){ const t=S.karte.knoten[id].typ; STATS.raeume[t]=(STATS.raeume[t]||0)+1; } }
  if(klug){ for(const p of S.teilnehmer){ STATS.stufe+=S.helden[p].stufe; STATS.n++; STATS.raenge+=S.helden[p].talente.length; const ast=S.helden[p].rolle+'/'+S.helden[p].__ast[0]; const z=STATS.ast[ast]=STATS.ast[ast]||[0,0]; z[0]++; if(S.ergebnis==='sieg')z[1]++;} }
  return {sieg:S.ergebnis==='sieg', lager, goldVorLager:gold/Math.max(1,lager)};
}
const R=['kaempfer','dieb','heilerin','magierin','waldlaeufer','paladin'];
const trios=[]; for(let a=0;a<6;a++)for(let b=a+1;b<6;b++)for(let c=b+1;c<6;c++) trios.push([R[a],R[b],R[c]]);
const N=+process.argv[2]||300; const zeilen=[];
for(const t of trios){ let sk=0,ss=0,lg=0,gl=0; for(let i=1;i<=N;i++){ const r=spiel(i*7919+t.join().length,t,true); if(r.sieg)sk++; lg+=r.lager; gl+=r.goldVorLager; if(spiel(i*104729,t,false).sieg)ss++; }
  zeilen.push([t.join('+'),Math.round(100*sk/N),Math.round(100*ss/N),(lg/N).toFixed(1),Math.round(gl/N)]); }
zeilen.sort((a,b)=>b[1]-a[1]); for(const z of zeilen) console.log(z[0].padEnd(30),'klug',String(z[1]).padStart(3)+'%','simpel',String(z[2]).padStart(3)+'%','Lager',z[3],'Ø Gold je Lager',z[4]);
console.log('Räume je Partie (klug):', Object.entries(STATS.raeume).map(([t,n])=>t+' '+(n/STATS.spiele).toFixed(2)).join(', '));
console.log('Ø Stufe am Ende', (STATS.stufe/STATS.n).toFixed(1), 'Ø Talente', (STATS.raenge/STATS.n).toFixed(1));
const k=zeilen.map(z=>z[1]); console.log('klug: min',Math.min(...k),'max',Math.max(...k),'Schnitt',Math.round(k.reduce((a,b)=>a+b)/k.length));
const s2=zeilen.map(z=>z[2]); console.log('simpel Schnitt',Math.round(s2.reduce((a,b)=>a+b)/s2.length));
for(const d of [['kaempfer','heilerin'],['paladin','magierin'],['dieb','waldlaeufer']]){ let w=0; for(let i=1;i<=N;i++) if(spiel(i*31,d,true).sieg)w++; console.log('zu zweit',d.join('+'),Math.round(100*w/N)+'%'); }

console.log('Siegquote nach Hauptast (klug, Dreiergruppen):');for(const [k,[n,w]] of Object.entries(STATS.ast).sort()) console.log('  '+k.padEnd(30), Math.round(100*w/n)+'%', '('+n+')');
