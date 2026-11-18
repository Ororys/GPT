// Imports : idempotence, atomicité, déterminisme, concurrence, validation — sur PostgreSQL RÉEL.
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createTestDatabase,P_ALPHA,P_BETA} from './helpers/pg.mjs';
import {PgRepository} from '../src/pg-repository.mjs';
import {readFileSync} from 'node:fs';
import {csvToRecords} from '../src/connectors/csv.mjs';
let db,repo;
before(async()=>{db=await createTestDatabase();repo=new PgRepository(db.api);});
after(async()=>{await db.drop();});
const count=async(p=P_ALPHA)=>(await db.admin.query('SELECT count(*)::int n FROM hc.observation WHERE person_id=$1',[p])).rows[0].n;
const rec=(o={})=>({source_record_id:'t-'+Math.random().toString(36).slice(2),metric_code:'LDL_C',method_code:'lab_reported',value:1.3,unit:'g/L',measured_at:'2026-10-01T08:00:00+02:00',interval_end_at:null,source_device:'Laboratoire fictif',...o});
const lab=(records,o={})=>repo.importBatch({subject:'ide-demo',personId:P_ALPHA,namespace:'demo_lab_csv',version:'1',records,...o});
const watchCsv=()=>csvToRecords(readFileSync(new URL('../fixtures/csv/watch_demo.csv',import.meta.url),'utf8')).records;

test('réimport intégral : aucun doublon (idempotence)',async()=>{
 assert.deepEqual(db.summary,{demo_watch_csv:{inserted:364,duplicates:0},demo_lab_csv:{inserted:6,duplicates:0},demo_center_v1_2:{inserted:8,duplicates:0}});
 const r=await repo.importBatch({subject:'patient-demo',personId:P_ALPHA,namespace:'demo_watch_csv',version:'1',records:watchCsv()});
 assert.deepEqual(r,{status:'ok',inserted:0,duplicates:364});assert.equal(await count(),378);
});

test('conflit de révision : rejet, sans écrasement, et lot atomique',async()=>{
 const a=rec();assert.equal((await lab([a])).inserted,1);const n=await count();
 assert.deepEqual(await lab([{...a,value:1.30}]),{status:'ok',inserted:0,duplicates:1},'1.3 et 1.30 sont la même valeur');
 const r=await lab([rec(),{...a,value:1.9},rec()]);
 assert.equal(r.status,'conflict');assert.equal(r.inserted,0);assert.deepEqual(r.errors.map(e=>[e.index,e.reason]),[[1,'REVISION_CONFLICT']]);
 assert.equal(await count(),n,'les 2 enregistrements valides du lot ne sont PAS insérés');
 const stored=(await db.admin.query("SELECT o.value_canonical::float v FROM hc.observation o JOIN hc.observation_provenance p ON p.observation_id=o.id WHERE p.source_record_id=$1",[a.source_record_id])).rows[0].v;
 assert.equal(stored,1.3);
});

test('validation en base : chaque motif de rejet, lot entièrement refusé',async()=>{
 const n=await count();
 const cases=[[{metric_code:'FIB4_SCORE'},'UNKNOWN_METRIC'],[{method_code:'wearable_spo2'},'UNAPPROVED_METHOD'],[{unit:'mmol/L'},'UNIT_MISMATCH_NO_SILENT_CONVERSION'],
  [{value:'1.3'},'VALUE_NOT_NUMERIC'],[{value:-1},'VALUE_OUT_OF_PLAUSIBLE_RANGE'],[{measured_at:'2026-10-01T08:00:00'},'TIMESTAMP_REQUIRES_EXPLICIT_OFFSET'],
  [{measured_at:'2026-10-01'},'TIMESTAMP_REQUIRES_EXPLICIT_OFFSET'],[{measured_at:'2026-13-45T08:00:00Z'},'UNPARSEABLE_VALUE_OR_TIMESTAMP'],[{measured_at:'2031-01-01T08:00:00Z'},'TIMESTAMP_IN_FUTURE'],
  [{source_device:'  '},'MISSING_DEVICE_PROVENANCE'],[{source_record_id:''},'SOURCE_RECORD_ID'],[{interval_end_at:'2026-09-01T08:00:00Z'},'INTERVAL_END_BEFORE_START']];
 const r=await lab([rec(),...cases.map(c=>rec(c[0]))]);
 assert.equal(r.status,'invalid');assert.deepEqual(r.errors.map(e=>e.reason),cases.map(c=>c[1]));assert.equal(await count(),n);
 const w=o=>repo.importBatch({subject:'patient-demo',personId:P_ALPHA,namespace:'demo_watch_csv',version:'1',records:[rec({metric_code:'HRV',method_code:'RMSSD',unit:'ms',value:40,source_device:'DemoWatch',...o})]});
 assert.equal((await w({method_code:'HRV_GENERIC'})).errors[0].reason,'UNAPPROVED_METHOD');
 assert.equal((await w({unit:'bpm'})).errors[0].reason,'UNIT_MISMATCH_NO_SILENT_CONVERSION');
 assert.equal((await w({metric_code:'SPO2',method_code:'wearable_spo2',unit:'%',value:109})).errors[0].reason,'VALUE_OUT_OF_PLAUSIBLE_RANGE');
 assert.equal((await w({metric_code:'STEPS',method_code:'wearable_step_count',unit:'steps',value:12.5})).errors[0].reason,'INTEGER_REQUIRED');
 const a=rec(),dup=await lab([a,a,{...a,value:9}]);assert.equal(dup.errors[0].reason,'CONFLICTING_DUPLICATE_IN_BATCH');
 assert.equal((await lab([])).status,'invalid');assert.equal((await lab({a:1})).status,'invalid');assert.equal(await count(),n);
});

test('SDNN et RMSSD restent deux séries distinctes (T03)',async()=>{
 const r=await repo.importBatch({subject:'patient-demo',personId:P_ALPHA,namespace:'demo_watch_csv',version:'1',records:[rec({metric_code:'HRV',method_code:'RMSSD',unit:'ms',value:41,source_device:'DemoWatch Y · synthetic'})]});
 assert.equal(r.inserted,1);
 const methods=(await db.admin.query("SELECT method_code,count(*)::int n FROM hc.observation WHERE metric_code='HRV' GROUP BY 1 ORDER BY 1")).rows;
 assert.deepEqual(methods,[{method_code:'RMSSD',n:1},{method_code:'SDNN',n:84}]);
});

test('qui peut importer quoi : espace de noms, rôle, connexion active (T09)',async()=>{
 const n=await count();
 assert.equal((await repo.importBatch({subject:'ide-demo',personId:P_ALPHA,namespace:'demo_watch_csv',version:'1',records:[rec()]})).status,'forbidden');
 assert.equal((await repo.importBatch({subject:'patient-demo',personId:P_ALPHA,namespace:'demo_lab_csv',version:'1',records:[rec()]})).status,'forbidden');
 assert.equal((await lab([rec()],{subject:'founder-demo'})).status,'forbidden');
 assert.equal((await lab([rec()],{personId:P_BETA})).status,'forbidden');
 assert.equal((await lab([rec()],{namespace:'apple_health'})).status,'forbidden');
 assert.equal((await repo.setConnection({subject:'patient-demo',personId:P_ALPHA,provider:'demo_lab',status:'revoked'})).status,'ok');
 assert.deepEqual(await lab([rec()]),{status:'connection_inactive',provider:'demo_lab'});
 assert.equal(await count(),n);
 assert.equal((await repo.setConnection({subject:'patient-demo',personId:P_ALPHA,provider:'demo_lab',status:'active'})).status,'ok');
 assert.equal((await lab([rec()])).inserted,1);
 assert.equal((await repo.setConnection({subject:'patient-demo',personId:P_ALPHA,provider:'inexistant',status:'active'})).status,'invalid');
});

test('même identifiant source chez deux patients : aucune collision (régression du défaut 003)',async()=>{
 await db.admin.query("INSERT INTO hc.care_access_grant(actor_id,person_id,purpose,valid_from,valid_until) VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',$1,'measurements',now()-interval '1 hour',now()+interval '1 hour')",[P_BETA]);
 assert.equal((await repo.setConnection({subject:'patient-beta',personId:P_BETA,provider:'demo_lab',status:'active'})).status,'ok');
 const shared=rec({source_record_id:'shared-id-1'});
 assert.equal((await lab([shared])).inserted,1);
 assert.deepEqual(await lab([{...shared,value:2.2}],{personId:P_BETA}),{status:'ok',inserted:1,duplicates:0});
 const v=async p=>(await db.admin.query("SELECT o.value_canonical::float v FROM hc.observation o JOIN hc.observation_provenance pr ON pr.observation_id=o.id WHERE pr.source_record_id='shared-id-1' AND o.person_id=$1",[p])).rows[0].v;
 assert.equal(await v(P_ALPHA),1.3);assert.equal(await v(P_BETA),2.2);
 assert.equal((await repo.listObservations({subject:'patient-beta',personId:P_BETA})).total,1);
});

test('imports concurrents du même lot : insérés exactement une fois',async()=>{
 const batch=Array.from({length:60},(_,i)=>rec({source_record_id:'conc-'+i,value:1+i/100}));const n=await count();
 const results=await Promise.all(Array.from({length:6},()=>lab(batch)));
 assert.ok(results.every(r=>r.status==='ok'));
 assert.equal(results.reduce((a,r)=>a+r.inserted,0),60);assert.equal(results.reduce((a,r)=>a+r.duplicates,0),300);
 assert.equal(await count(),n+60);
});

test('fuseaux et heure d\'été : instant UTC exact et décalage d\'origine conservés (T05)',async()=>{
 await lab([rec({source_record_id:'dst-1',measured_at:'2026-03-29T03:30:00+02:00'}),rec({source_record_id:'dst-2',measured_at:'2026-10-25T02:30:00+01:00',interval_end_at:'2026-10-25T03:30:00+01:00'})]);
 const rows=(await db.admin.query("SELECT pr.source_record_id s,hc.iso_utc(o.measured_at) t,o.original_timezone z,hc.iso_utc(o.interval_end_at) e FROM hc.observation o JOIN hc.observation_provenance pr ON pr.observation_id=o.id WHERE pr.source_record_id LIKE 'dst-%' ORDER BY 1")).rows;
 assert.deepEqual(rows,[{s:'dst-1',t:'2026-03-29T01:30:00Z',z:'+02:00',e:null},{s:'dst-2',t:'2026-10-25T01:30:00Z',z:'+01:00',e:'2026-10-25T02:30:00Z'}]);
});

test('déterminisme : une seconde installation produit les mêmes identifiants d\'observation',async()=>{
 const other=await createTestDatabase();
 try{
  const q="SELECT o.id FROM hc.observation o JOIN hc.observation_provenance p ON p.observation_id=o.id WHERE p.source_namespace IN ('demo_watch_csv','demo_center_v1_2') ORDER BY 1";
  const a=(await db.admin.query(q)).rows.map(r=>r.id),b=(await other.admin.query(q)).rows.map(r=>r.id);
  assert.equal(b.length,372);assert.ok(b.every(id=>a.includes(id)));
 }finally{await other.drop();}
});

test('v3.1 : valeurs absentes ou nulles rejetées sans exception et lot atomique',async()=>{
 const n=await count();const missing=rec();delete missing.value;
 for(const value of [missing,rec({value:null})]){
  const r=await lab([rec(),value]);assert.equal(r.status,'invalid');
  assert.equal(r.errors[0].reason,'VALUE_NOT_NUMERIC');assert.equal(await count(),n);
 }
 assert.equal((await lab(null)).status,'invalid');
});

test('v3.1 : microsecondes conservées et conflit détecté entre instants distincts',async()=>{
 const a=rec({source_record_id:'precision',measured_at:'2026-10-01T08:00:00.123456Z'});
 assert.equal((await lab([a])).inserted,1);
 const row=(await db.admin.query("SELECT hc.iso_utc(measured_at) t FROM hc.observation o JOIN hc.observation_provenance p ON p.observation_id=o.id WHERE p.source_record_id='precision'")).rows[0];
 assert.equal(row.t,a.measured_at);
 assert.equal((await lab([{...a,measured_at:'2026-10-01T08:00:00.654321Z'}])).status,'conflict');
});

test('v3.1 : révocation concurrente validée avant import = import refusé',async()=>{
 const c=await db.admin.connect();
 try{
  await c.query('BEGIN');await c.query("UPDATE hc.source_connection SET status='revoked',revoked_at=now() WHERE person_id=$1 AND provider='demo_lab'",[P_ALPHA]);
  const pending=lab([rec()]);
  // Synchronisation explicite : attendre que la requête importe se bloque sur le verrou de connexion.
  let waiting=false;
  for(let i=0;i<100;i++){
   const r=await db.admin.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%api_import_batch%'");
   if(r.rowCount){waiting=true;break;}await new Promise(r=>setTimeout(r,10));
  }
  await c.query('COMMIT');const result=await pending;
  assert.ok(waiting,'import doit attendre la transaction de révocation');assert.equal(result.status,'connection_inactive');
 }finally{await c.query('ROLLBACK');c.release();await repo.setConnection({subject:'patient-demo',personId:P_ALPHA,provider:'demo_lab',status:'active'});}
});

test('v3.1 : une autre version ne doit pas compter deux fois la même mesure',async()=>{
 const a=rec({source_record_id:'revision-guard'});assert.equal((await lab([a])).inserted,1);
 const n=await count();const r=await lab([{...a,value:1.7}],{version:'2'});
 assert.equal(r.status,'conflict');assert.equal(r.errors[0].reason,'REVISION_NOT_SUPPORTED');assert.equal(await count(),n);
});
