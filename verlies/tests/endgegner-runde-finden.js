const path = require('path'), os = require('os');
const LOGIK = path.join(__dirname, '..', 'verlies-logic.js');
const AUS = path.join(os.tmpdir(), 'verlies-tests'); require('fs').mkdirSync(AUS, { recursive: true });
const URL_BASIS = process.env.VERLIES_URL || 'http://localhost:8765';
const fs=require('fs'),vm=require('vm');const ctx={window:{},console};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(LOGIK,'utf8'),ctx);const V=ctx.window.VL;
for(let seed=1;seed<300;seed++){ let S=V.neu('X','p0','A',seed*31); for(let i=1;i<3;i++) S=V.aktion(S,'p'+i,{t:'join',name:['Lena','Jens'][i-1]});
 ['kaempfer','magierin','waldlaeufer'].forEach((r,i)=>S=V.aktion(S,'p'+i,{t:'rolle',rolle:r})); S=V.aktion(S,'p0',{t:'start',mindestens:1});
 let n=0; while(S.phase!=='ende'&&n++<3000){ if(S.phase==='erkunden'){for(const p of S.teilnehmer){if(S.phase!=='erkunden')break;S=V.aktion(S,p,{t:'stimme',i:0,nr:S.spielNr});}}
  else if(S.phase==='lager'){for(const p of S.teilnehmer)if(S.phase==='lager')S=V.aktion(S,p,{t:'fertig',nr:S.spielNr});}
  else { const r=S.kampf.runde; for(const p of V.lebend(S)){ if(S.phase!=='kampf'||S.kampf.runde!==r)break; S=V.aktion(S,p,Object.assign({t:'wahl',runde:r},V.standardWahl(S,p))); }
   if(S.letzte&&S.letzte.ev.some(e=>e.a==='ruf')){ fs.writeFileSync(path.join(AUS, 'ruf.json'),JSON.stringify({L:S.letzte,helden:Object.fromEntries(S.teilnehmer.map(p=>[p,S.helden[p].rolle])),namen:{p0:'Richard',p1:'Lena',p2:'Jens'}})); console.log('gefunden', seed, S.letzte.ev.map(e=>e.a).join(',')); process.exit(0);} } } }
