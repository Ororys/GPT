// Tests d'intégration HTTP → PostgreSQL RÉEL (aucun faux dépôt) : authentification, isolation, rapport, exports, imports.
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTestDatabase,P_ALPHA,P_BETA} from './helpers/pg.mjs';
import {PgRepository} from '../src/pg-repository.mjs';
import {createApp} from '../src/app.mjs';
import {mintDemoToken} from '../src/token.mjs';
const secret='integration-secret-0123456789-abcdefghij-xyz';let db,app,base;const allowedHosts=[];
const webDir=new URL('../web',import.meta.url).pathname;
before(async()=>{db=await createTestDatabase();app=createApp({repo:new PgRepository(db.api),secret,demoLogin:true,allowedHosts,webDir});await new Promise(r=>app.listen(0,'127.0.0.1',r));allowedHosts.push('127.0.0.1:'+app.address().port);base='http://127.0.0.1:'+app.address().port;});
after(async()=>{await new Promise(r=>app.close(r));await db.drop();});
async function call(path,{who='patient-demo',method='GET',body,type,token}={}){
 const headers={};const t=token??(who?mintDemoToken(who,{secret}):null);if(t)headers.authorization='Bearer '+t;if(type)headers['content-type']=type;
 const res=await fetch(base+path,{method,headers,body});const text=await res.text();let data=text;try{data=JSON.parse(text);}catch{}
 return {status:res.status,data,headers:res.headers,text};
}
const A='/api/v1/patients/'+P_ALPHA,B='/api/v1/patients/'+P_BETA;

test('authentification : absence, jeton malformé, signature altérée, jeton expiré → 401',async()=>{
 assert.equal((await call('/api/v1/me',{who:null})).status,401);
 for(const token of ['a.b.c','x','e30.e30.e30','..',Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')+'.'+Buffer.from('{"sub":"patient-demo"}').toString('base64url')+'.'])assert.equal((await call('/api/v1/me',{token})).status,401,token);
 const good=mintDemoToken('patient-demo',{secret});assert.equal((await call('/api/v1/me',{token:good.slice(0,-3)+'AAA'})).status,401);
 assert.equal((await call('/api/v1/me',{token:mintDemoToken('patient-demo',{secret,now:Math.floor(Date.now()/1000)-7200})})).status,401);
 assert.equal((await call('/api/v1/me',{token:mintDemoToken('patient-demo',{secret:'another-secret-of-at-least-32-bytes-long!'})})).status,401);
});

test('session de démonstration : profils connus uniquement ; hôte inattendu refusé',async()=>{
 const post=b=>call('/api/v1/demo/session',{who:null,method:'POST',type:'application/json',body:JSON.stringify(b)});
 assert.equal((await post({subject:'root'})).status,422);assert.equal((await post({subject:'patient-demo'})).status,200);
 assert.equal((await call('/api/v1/demo/session',{who:null,method:'POST',type:'application/json',body:'{'})).status,400);
 assert.equal((await call('/api/v1/demo/personas',{who:null})).data.personas.length,6);
 const off=createApp({repo:new PgRepository(db.api),secret,demoLogin:false});await new Promise(r=>off.listen(0,'127.0.0.1',r));
 try{assert.equal((await fetch(`http://127.0.0.1:${off.address().port}/api/v1/demo/session`,{method:'POST',headers:{'content-type':'application/json'},body:'{"subject":"patient-demo"}'})).status,404);}finally{await new Promise(r=>off.close(r));}
 const rebinding=await fetch(base+'/api/v1/demo/personas',{headers:{host:'evil.example:80'}}).catch(()=>null);
 // fetch interdit de forger Host : on vérifie le contrôle par une requête brute.
 const {request}=await import('node:http');
 const status=await new Promise((ok,ko)=>{const r=request({host:'127.0.0.1',port:app.address().port,path:'/api/v1/demo/personas',headers:{host:'evil.example'}},res=>{res.resume();ok(res.statusCode);});r.on('error',ko);r.end();});
 assert.equal(status,421);void rebinding;
});

test('profil : chaque rôle ne voit que ses dossiers',async()=>{
 const me=async who=>(await call('/api/v1/me',{who})).data;
 assert.deepEqual((await me('patient-demo')).patients.map(p=>p.id),[P_ALPHA]);
 assert.deepEqual((await me('patient-beta')).patients.map(p=>p.id),[P_BETA]);
 assert.deepEqual((await me('founder-demo')).patients,[]);assert.deepEqual((await me('admin-demo')).patients,[]);
 assert.deepEqual((await me('ide-demo')).patients[0].permissions,['write_measurement']);
 assert.deepEqual((await me('physician-demo')).patients[0].permissions,['read','export','write_measurement']);
 assert.equal((await call('/api/v1/me',{who:'inconnu-999'})).status,403);
});

test('observations : pagination, filtres, validation des paramètres, isolation',async()=>{
 let r=await call(A+'/observations?limit=2');assert.equal(r.status,200);assert.equal(r.data.total,378);assert.equal(r.data.observations.length,2);
 assert.equal(r.headers.get('cache-control'),'no-store, private');
 assert.equal((await call(A+'/observations?metric=HRV')).data.total,84);
 assert.equal((await call(A+'/observations?source=demo_lab_csv')).data.total,6);
 assert.equal((await call(A+'/observations?start=2026-11-12&end=2026-11-12&metric=LDL_C')).data.total,1);
 assert.equal((await call(A+'/observations?offset=376&limit=500')).data.observations.length,2);
 for(const bad of ['limit=0','limit=501','limit=abc','offset=-1','metric=hrv','metric=HRV%27--','start=2026-02-31','start=2026-11-10&end=2026-11-01','surprise=1','source=DROP%20TABLE'])assert.equal((await call(A+'/observations?'+bad)).status,400,bad);
 for(const [path,who] of [[B,'patient-demo'],[A,'patient-beta'],[A,'founder-demo'],[A,'admin-demo'],[A,'ide-demo'],[B,'physician-demo']])assert.equal((await call(path+'/observations',{who})).status,403,`${who} ${path}`);
 assert.equal((await call('/api/v1/patients/not-a-uuid/observations')).status,404);
 const id=r.data.observations[0].id;const one=await call(`${A}/observations/${id}`);
 assert.equal(one.data.observation.id,id);assert.match(one.data.observation.provenance.payload_sha256,/^[a-f0-9]{64}$/);assert.equal(one.data.observation.source_record_id.length>0,true);
 assert.equal((await call(`${B}/observations/${id}`,{who:'patient-beta'})).status,404);
 assert.equal((await call(`${A}/observations/${id}`,{who:'patient-beta'})).status,403);
 assert.equal((await call(`${A}/observations/1234`)).status,400);
 assert.equal((await call(A+'/observations',{method:'DELETE'})).status,405);
});

test('rapport à la demande : contenu, déterminisme, traçabilité, absence de sortie clinique (T08)',async()=>{
 const r=await call(A+'/report');assert.equal(r.status,200);const rep=r.data.report;
 assert.equal(rep.observations_considered,378);assert.equal(rep.comparisons.length,12);assert.equal(rep.comparisons.filter(c=>c.status==='descriptive_comparison').length,11);
 assert.equal(rep.comparisons.find(c=>c.metric_code==='SPO2').status,'insufficient_coverage');
 const again=await call(A+'/report');assert.equal(again.data.sha256,r.data.sha256);assert.equal(again.data.report_id,r.data.report_id);
 const asDoctor=await call(A+'/report',{who:'physician-demo'});assert.equal(asDoctor.data.sha256,r.data.sha256,'même données, même empreinte, quel que soit le lecteur');
 const other=await call(A+'/report?windowDays=21&minDays=10');assert.notEqual(other.data.sha256,r.data.sha256);
 // Chaque identifiant cité se résout dans le dossier, et l'instantané en base référence exactement ces observations.
 const ids=new Set(rep.inventory.flatMap(s=>s.observation_ids));assert.equal(ids.size,378);
 for(const c of rep.comparisons)for(const side of ['before','after'])for(const id of c[side]?.ids||[])assert.ok(ids.has(id));
 const snap=(await db.admin.query('SELECT r.algorithm_version,r.requested_by,r.parameters,(SELECT count(*)::int FROM hc.report_observation ro WHERE ro.report_id=r.id) n FROM hc.report r WHERE r.id=$1',[r.data.report_id])).rows[0];
 assert.deepEqual([snap.algorithm_version,snap.requested_by,snap.n,snap.parameters.windowDays],['3.1-descriptive','patient-demo',378,14]);
 // Recoupement avec le rapport Python historique v1.8 : mêmes écarts pour les séries de montre.
 const v18=JSON.parse(readFileSync(new URL('../fixtures/report_v1.8.json',import.meta.url),'utf8'));
 for(const old of v18.comparisons.filter(c=>c.delta!==undefined&&['RHR','HRV','SLEEP','STEPS'].includes(c.metric_code))){const cur=rep.comparisons.find(c=>c.metric_code===old.metric_code&&c.method_code===old.method_code);assert.ok(Math.abs(cur.delta-old.delta)<0.0015,`${old.metric_code} ${cur.delta} vs ${old.delta}`);}
 // Aucune clé de sortie clinique.
 const keys=new Set();(function walk(v){if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')for(const [k,x] of Object.entries(v)){keys.add(k);walk(x);}})(rep);
 assert.doesNotMatch([...keys].join(' '),/risk|score|diagnos|alert|triage|recommend|severity|threshold/i);
 const md=await call(A+'/report?format=md');assert.equal(md.status,200);assert.match(md.text,/Synthèse longitudinale descriptive/);assert.match(md.text,new RegExp(r.data.sha256));assert.match(md.headers.get('content-disposition'),/attachment/);
 const empty=await call(B+'/report',{who:'patient-beta'});assert.equal(empty.status,200);assert.equal(empty.data.report.observations_considered,0);assert.deepEqual(empty.data.report.comparisons,[]);
 const window=await call(A+'/report?start=2026-10-01&end=2026-11-15');assert.ok(window.data.report.observations_considered<378);
 for(const bad of ['start=2026-02-31','start=2026-11-01&end=2026-02-01','windowDays=100','windowDays=6','minDays=20&windowDays=14','format=pdf','x=1'])assert.equal((await call(A+'/report?'+bad)).status,400,bad);
 assert.equal((await call(A+'/report',{who:'ide-demo'})).status,403);assert.equal((await call(A+'/report',{who:'patient-beta'})).status,403);
});

test('exports CSV et JSON : contenu complet, protégés, journalisés',async()=>{
 const csv=await call(A+'/export?format=csv');assert.equal(csv.status,200);const lines=csv.text.trim().split('\n');
 assert.equal(lines.length,379);assert.equal(lines[0],'id,metric_code,method_code,value,unit,measured_at,interval_end_at,source_namespace,source_record_id,source_device,quality_state,synthetic');
 const j=await call(A+'/export?format=json');assert.equal(j.data.observations.length,378);assert.equal(j.data.synthetic,true);
 assert.equal((await call(A+'/export',{who:'ide-demo'})).status,403);assert.equal((await call(A+'/export?format=xml')).status,400);
 const n=(await db.admin.query("SELECT count(*)::int n FROM hc.access_audit WHERE event_type='export_observations' AND actor_ref='patient-demo'")).rows[0].n;assert.equal(n,2);
});

test('import par connecteur simulé : création, idempotence, erreurs par ligne, conflits, droits',async()=>{
 const post=(connector,body,o={})=>call(`${A}/imports/${connector}`,{who:'ide-demo',method:'POST',type:'text/csv',body,...o});
 const head='record_id,timestamp,metric_code,method_code,value,unit,source_device\n';
 const csv=head+'http-1,2026-11-14T08:00:00+01:00,CREATININE,lab_reported,9.1,mg/L,"Laboratoire fictif, site B"\nhttp-2,2026-11-14T08:00:00+01:00,HBA1C,lab_reported,5.6,%,Laboratoire fictif\n';
 let r=await post('demo_lab_csv',csv);assert.equal(r.status,201);assert.deepEqual([r.data.inserted,r.data.duplicates],[2,0]);
 r=await post('demo_lab_csv',csv);assert.equal(r.status,200);assert.deepEqual([r.data.inserted,r.data.duplicates],[0,2]);
 r=await post('demo_lab_csv',readFileSync(new URL('../fixtures/csv/lab_demo.csv',import.meta.url),'utf8'));assert.deepEqual([r.status,r.data.inserted,r.data.duplicates],[200,0,6],'réimporter le fichier de démonstration ne double rien');
 r=await post('demo_lab_csv',csv.replace('9.1','9.9'));assert.equal(r.status,409);assert.deepEqual(r.data.errors,[{row:2,source_record_id:'http-1',reason:'REVISION_CONFLICT'}]);
 r=await post('demo_lab_csv',head+'ok-1,2026-11-14T08:00:00Z,TG,lab_reported,1.1,g/L,Labo\nbad-1,2026-11-14T08:00:00Z,TG,lab_reported,1.1,mmol/L,Labo\nbad-2,2026-11-14,TG,lab_reported,1.1,g/L,Labo\n');
 assert.equal(r.status,422);assert.deepEqual(r.data.errors.map(e=>[e.row,e.reason]),[[3,'UNIT_MISMATCH_NO_SILENT_CONVERSION'],[4,'TIMESTAMP_REQUIRES_EXPLICIT_OFFSET']]);assert.equal(r.data.inserted,0);
 assert.equal((await call(A+'/observations?metric=TG')).data.total,2,'la ligne valide du lot rejeté n\'a pas été insérée');
 r=await post('demo_lab_csv','record_id,timestamp\nx,y\n');assert.equal(r.status,422);assert.match(r.data.errors[0].reason,/MISSING_COLUMNS/);
 r=await post('demo_lab_csv',head+'v-1,2026-11-14T08:00:00Z,TG,lab_reported,=1+1,g/L,Labo\n');assert.equal(r.data.errors[0].reason,'VALUE_NOT_NUMERIC');
 assert.equal((await post('demo_lab_csv',head)).status,422);
 assert.equal((await post('demo_lab_csv',csv,{type:'application/json'})).status,415);
 assert.equal((await post('demo_lab_csv','x'.repeat(1_100_000))).status,413);
 assert.equal((await post('demo_watch_csv',csv)).status,403,'un IDE ne peut pas importer la montre du patient');
 assert.equal((await post('demo_lab_csv',csv,{who:'patient-demo'})).status,403);assert.equal((await post('demo_lab_csv',csv,{who:'founder-demo'})).status,403);
 assert.equal((await call(`${B}/imports/demo_lab_csv`,{who:'ide-demo',method:'POST',type:'text/csv',body:csv})).status,403);
 assert.equal((await post('apple_healthkit',csv)).status,501);assert.equal((await post('constructor',csv)).status,404);assert.equal((await post('__proto__',csv)).status,404);
 // Export : une cellule texte commençant par un caractère de formule est neutralisée.
 await post('demo_lab_csv',head+'inj-1,2026-11-13T08:00:00Z,TG,lab_reported,1.2,g/L,"=HYPERLINK(""http://x"")"\n');
 assert.match((await call(A+'/export?format=csv')).text,/,"'=HYPERLINK\(""http:\/\/x""\)",/);
});

test('consentement : le patient révoque une source, les imports cessent ; journal visible du patient seul',async()=>{
 const put=(status,who='patient-demo')=>call(`${A}/connections/demo_lab`,{who,method:'PUT',type:'application/json',body:JSON.stringify({status})});
 assert.equal((await put('revoked','physician-demo')).status,403);assert.equal((await put('paused')).status,422);
 assert.equal((await put('revoked')).status,200);
 const r=await call(`${A}/imports/demo_lab_csv`,{who:'ide-demo',method:'POST',type:'text/csv',body:'record_id,timestamp,metric_code,method_code,value,unit,source_device\nrev-1,2026-11-14T08:00:00Z,TG,lab_reported,1.1,g/L,Labo\n'});
 assert.equal(r.status,409);assert.equal(r.data.error,'CONNECTION_INACTIVE');
 assert.equal((await call(A+'/connections',{who:'ide-demo'})).data.connections.find(c=>c.provider==='demo_lab').status,'revoked');
 assert.equal((await put('active')).status,200);
 assert.equal((await call(A+'/connections',{who:'founder-demo'})).status,403);
 const audit=await call(A+'/audit?limit=200');assert.equal(audit.status,200);const events=audit.data.events.map(e=>e.actor+':'+e.event);
 for(const e of ['founder-demo:denied_read','patient-demo:connection_revoked','ide-demo:import_batch','patient-demo:generate_report'])assert.ok(events.includes(e),e);
 for(const who of ['physician-demo','ide-demo','founder-demo','patient-beta'])assert.equal((await call(A+'/audit',{who})).status,403,who);
});

test('référentiels, documentation, page et en-têtes de sécurité',async()=>{
 const m=await call('/api/v1/metrics');assert.equal(m.data.metrics.length,13);assert.deepEqual(m.data.metrics.find(x=>x.metric_code==='HRV').methods,['RMSSD','SDNN']);
 const c=await call('/api/v1/connectors');assert.deepEqual(c.data.connectors.filter(x=>x.status==='not_configured').map(x=>x.id),['apple_healthkit','android_health_connect','lab_hl7_fhir']);
 assert.equal((await call('/api/v1/metrics',{who:null})).status,401);
 const page=await call('/',{who:null});assert.equal(page.status,200);const csp=page.headers.get('content-security-policy');
 assert.match(csp,/default-src 'none'/);assert.doesNotMatch(csp,/unsafe-inline|unsafe-eval/);assert.equal(page.headers.get('x-frame-options'),'DENY');
 assert.doesNotMatch(page.text,/<script(?![^>]*src=)|\son[a-z]+=|style=/i,'aucun script, gestionnaire ou style en ligne');
 assert.match((await call('/app.js',{who:null})).headers.get('content-type'),/javascript/);
 assert.doesNotMatch((await call('/app.js',{who:null})).text,/innerHTML|localStorage|sessionStorage|eval\(/);
 const api=await call('/api/v1/openapi.yaml',{who:null});assert.equal(api.status,200);assert.match(api.text,/openapi: 3\./);
 assert.equal((await call('/healthz',{who:null})).data.mode,'SYNTHETIC_ONLY');
 assert.equal((await call('/api/v1/unknown')).status,404);assert.equal((await call('/../../etc/passwd',{who:null})).status,404);
 const err=await call(A+'/observations?limit=abc');assert.deepEqual(Object.keys(err.data).sort(),['error','requestId']);
});
