// Tests adversariaux exécutés sur un PostgreSQL RÉEL : frontière SQL, RLS, isolation, audit, immuabilité.
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createTestDatabase,P_ALPHA,P_BETA} from './helpers/pg.mjs';
import {PgRepository} from '../src/pg-repository.mjs';
let db,repo;
before(async()=>{db=await createTestDatabase();repo=new PgRepository(db.api);});
after(async()=>{await db.drop();});
const read=(subject,personId)=>repo.listObservations({subject,personId,limit:5});
const asOwner=async(fn)=>{const c=await db.admin.connect();try{await c.query('BEGIN');await c.query('SET LOCAL ROLE hc_owner');return await fn(c);}finally{await c.query('ROLLBACK');c.release();}};

test('le rôle API ne peut ni lire les tables, ni appeler les fonctions internes, ni changer de rôle',async()=>{
 const tables=(await db.admin.query("SELECT tablename FROM pg_tables WHERE schemaname='hc'")).rows.map(r=>r.tablename);
 assert.ok(tables.length>=18);
 for(const t of tables)await assert.rejects(db.api.query(`SELECT * FROM hc.${t} LIMIT 1`),/permission denied/,t);
 await assert.rejects(db.api.query("INSERT INTO hc.access_audit(actor_ref,event_type) VALUES('x','y')"),/permission denied/);
 for(const f of ["hc.authz('patient-demo',$1,'read')","hc.guard('patient-demo',$1,'read')","hc.audit('x',$1,'y','{}'::jsonb)"])await assert.rejects(db.api.query(`SELECT ${f}`,[P_ALPHA]),/permission denied/,f);
 await assert.rejects(db.api.query('SET ROLE hc_owner'),/permission denied/);
 const me=(await db.api.query('SELECT rolsuper,rolbypassrls,rolcreaterole,rolcreatedb FROM pg_roles WHERE rolname=current_user')).rows[0];
 assert.deepEqual(me,{rolsuper:false,rolbypassrls:false,rolcreaterole:false,rolcreatedb:false});
});

test('propriétaire non privilégié, RLS forcée et politiques présentes sur toutes les tables',async()=>{
 const owner=(await db.admin.query("SELECT rolsuper,rolbypassrls,rolcanlogin FROM pg_roles WHERE rolname='hc_owner'")).rows[0];
 assert.deepEqual(owner,{rolsuper:false,rolbypassrls:false,rolcanlogin:false});
 const fns=(await db.admin.query("SELECT proname,proowner::regrole::text AS owner,prosecdef,proconfig FROM pg_proc WHERE pronamespace='hc'::regnamespace")).rows;
 for(const f of fns){assert.equal(f.owner,'hc_owner',f.proname);if(f.prosecdef)assert.ok(f.proconfig?.some(c=>c.startsWith('search_path=pg_catalog')),`search_path figé : ${f.proname}`);}
 assert.ok(fns.filter(f=>f.prosecdef).every(f=>f.proname.startsWith('api_')),'seules les fonctions api_* sont SECURITY DEFINER');
 const t=(await db.admin.query("SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) AS owner,(SELECT count(*)::int FROM pg_policy p WHERE p.polrelid=c.oid) AS policies FROM pg_class c WHERE c.relnamespace='hc'::regnamespace AND c.relkind='r'")).rows;
 for(const r of t){assert.equal(r.owner,'hc_owner',r.relname);assert.ok(r.relrowsecurity&&r.relforcerowsecurity,`RLS forcée : ${r.relname}`);}
 const noPolicy=t.filter(r=>r.policies===0).map(r=>r.relname).sort();
 assert.deepEqual(noPolicy,[],'aucune table sans politique');
});

test('défense en profondeur : sans portée de personne, même le propriétaire ne voit aucune ligne de dossier',async()=>{
 await asOwner(async c=>{
  assert.equal((await c.query('SELECT count(*)::int n FROM hc.observation')).rows[0].n,0);
  assert.equal((await c.query('SELECT count(*)::int n FROM hc.ingestion_receipt')).rows[0].n,0);
  await c.query("SELECT set_config('hc.person_scope',$1,true)",[P_ALPHA]);
  assert.equal((await c.query('SELECT count(*)::int n FROM hc.observation')).rows[0].n,378);
  assert.equal((await c.query('SELECT count(*)::int n FROM hc.observation_provenance')).rows[0].n,378);
  await c.query("SELECT set_config('hc.person_scope',$1,true)",[P_BETA]);
  assert.equal((await c.query('SELECT count(*)::int n FROM hc.observation')).rows[0].n,0);
  // Écriture hors portée refusée par WITH CHECK.
  await assert.rejects(c.query("INSERT INTO hc.source_connection(person_id,provider) VALUES($1,'demo_lab')",[P_ALPHA]),/row-level security/);
 });
});

test('isolation entre patients et rôles (T01, T10)',async()=>{
 assert.equal((await read('patient-demo',P_ALPHA)).status,'ok');
 assert.equal((await read('patient-demo',P_ALPHA)).total,378);
 assert.equal((await read('physician-demo',P_ALPHA)).status,'ok');
 for(const [s,p] of [['patient-demo',P_BETA],['patient-beta',P_ALPHA],['founder-demo',P_ALPHA],['admin-demo',P_ALPHA],['ide-demo',P_ALPHA],['physician-demo',P_BETA],['inconnu-123',P_ALPHA],['patient-demo','00000000-0000-4000-8000-000000000000']])
  assert.deepEqual(await read(s,p),{status:'forbidden'},`${s} -> ${p}`);
 assert.equal((await read('patient-beta',P_BETA)).total,0);
 // Une observation d'ALPHA demandée via le dossier de BETA n'existe pas pour BETA.
 const id=(await read('patient-demo',P_ALPHA)).observations[0].id;
 assert.equal((await repo.getObservation({subject:'patient-beta',personId:P_BETA,id})).status,'not_found');
 assert.equal((await repo.getObservation({subject:'patient-beta',personId:P_ALPHA,id})).status,'forbidden');
 assert.equal((await repo.getObservation({subject:'patient-demo',personId:P_ALPHA,id})).observation.provenance.payload_sha256.length,64);
 assert.equal((await repo.recordReport({subject:'patient-beta',personId:P_BETA,algorithm:'t',parameters:{},sha256:'a'.repeat(64),observationIds:[id]})).reason,'UNRESOLVED_REFERENCE');
 assert.equal((await repo.listAudit({subject:'physician-demo',personId:P_ALPHA})).status,'forbidden');
 assert.equal((await repo.setConnection({subject:'physician-demo',personId:P_ALPHA,provider:'demo_watch',status:'revoked'})).status,'forbidden');
 assert.deepEqual((await repo.whoami({subject:'founder-demo'})).patients,[]);
 assert.equal((await repo.whoami({subject:'inconnu-123'})).status,'forbidden');
});

test('les refus sont journalisés durablement (ils étaient annulés par le RAISE en v1.5)',async()=>{
 const count=async()=>(await db.admin.query("SELECT count(*)::int n FROM hc.access_audit WHERE event_type='denied_read' AND actor_ref='founder-demo'")).rows[0].n;
 const before=await count();await read('founder-demo',P_ALPHA);await read('founder-demo',P_ALPHA);
 assert.equal(await count(),before+2);
 const ev=(await repo.listAudit({subject:'patient-demo',personId:P_ALPHA,limit:200})).events;
 assert.ok(ev.some(e=>e.event==='denied_read'&&e.actor==='founder-demo'),'le patient voit les tentatives refusées sur son dossier');
 const details=(await db.admin.query('SELECT details::text d FROM hc.access_audit')).rows.map(r=>r.d).join(' ');
 assert.doesNotMatch(details,/"value"|bpm|g\/L/,'aucune valeur médicale dans le journal');
});

test('révocation et expiration des habilitations prises en compte immédiatement',async()=>{
 const g="'ffffffff-ffff-4fff-8fff-ffffffffffff'";
 try{
  await db.admin.query(`UPDATE hc.care_access_grant SET revoked_at=now() WHERE id=${g}`);
  assert.equal((await read('physician-demo',P_ALPHA)).status,'forbidden');
  await db.admin.query(`UPDATE hc.care_access_grant SET revoked_at=NULL,valid_from=now()-interval '3 days',valid_until=now()-interval '1 day' WHERE id=${g}`);
  assert.equal((await read('physician-demo',P_ALPHA)).status,'forbidden');
  await db.admin.query(`UPDATE hc.care_access_grant SET valid_until=now()+interval '1 day' WHERE id=${g}`);
  assert.equal((await read('physician-demo',P_ALPHA)).status,'ok');
  await db.admin.query("UPDATE hc.actor SET active=false WHERE external_subject='physician-demo'");
  assert.equal((await read('physician-demo',P_ALPHA)).status,'forbidden');
 }finally{await db.admin.query("UPDATE hc.actor SET active=true WHERE external_subject='physician-demo'");}
});

test('immuabilité : ni UPDATE, ni DELETE, ni TRUNCATE, même pour le rôle de migration',async()=>{
 for(const sql of ['UPDATE hc.observation SET value_canonical=0','DELETE FROM hc.observation','TRUNCATE hc.observation CASCADE','DELETE FROM hc.observation_provenance','UPDATE hc.ingestion_receipt SET payload_sha256=payload_sha256','UPDATE hc.access_audit SET actor_ref=\'x\'','DELETE FROM hc.access_audit','TRUNCATE hc.access_audit'])
  await assert.rejects(db.admin.query(sql),/IMMUTABLE_RECORD|append-only/,sql);
 assert.equal((await read('patient-demo',P_ALPHA)).total,378);
});

test('verrou synthétique en base et module clinique V2 non exécutable',async()=>{
 await assert.rejects(db.admin.query("INSERT INTO hc.person(alias,synthetic) VALUES('réel',false)"),/person_synthetic_only/);
 await assert.rejects(db.admin.query("INSERT INTO hc.clinical_module(module_code,intended_purpose,executable_in_v1) VALUES('X','y',true)"),/check constraint/);
 const fn=(await db.admin.query("SELECT proname FROM pg_proc WHERE pronamespace='hc'::regnamespace")).rows.map(r=>r.proname).join(' ');
 assert.doesNotMatch(fn,/risk|score|alert|diagnos/i);
});

test('limite documentée : le rôle API choisit le sujet et peut annuler son audit',async()=>{
 const before=(await db.admin.query("SELECT count(*)::int n FROM hc.access_audit WHERE actor_ref='rollback-probe'")).rows[0].n;
 const c=await db.api.connect();
 try{
  await c.query('BEGIN');
  const result=await c.query("SELECT hc.api_list_observations('rollback-probe',$1,NULL,NULL,NULL,NULL,1,0,'read') r",[P_ALPHA]);
  assert.equal(result.rows[0].r.status,'forbidden');await c.query('ROLLBACK');
 }finally{c.release();}
 const after=(await db.admin.query("SELECT count(*)::int n FROM hc.access_audit WHERE actor_ref='rollback-probe'")).rows[0].n;
 assert.equal(after,before,'un journal externe est nécessaire pour résister au rôle API compromis');
 assert.equal((await read('patient-demo',P_ALPHA)).status,'ok','aucun jeton vérifié par PostgreSQL : sujet fourni par le rôle API');
});

test('v3.1 : rapports identiques concurrents = un instantané sans violation unicité',async()=>{
 const args={subject:'patient-demo',personId:P_ALPHA,algorithm:'concurrent-test',parameters:{},sha256:'c'.repeat(64),observationIds:[]};
 const c=await db.admin.connect();let settled;
 try{
  await c.query('BEGIN');await c.query('LOCK TABLE hc.report IN SHARE MODE');
  const pending=Promise.allSettled(Array.from({length:6},()=>repo.recordReport(args)));
  for(let i=0;i<200;i++){
   const r=await db.admin.query("SELECT count(*)::int n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%api_record_report%'");
   if(r.rows[0].n===6)break;await new Promise(r=>setTimeout(r,10));
  }
  await c.query('COMMIT');settled=await pending;
 }finally{await c.query('ROLLBACK');c.release();}
 assert.ok(settled.every(r=>r.status==='fulfilled'),settled.map(r=>r.reason?.message).join(';'));
 const results=settled.map(r=>r.value);
 assert.ok(results.every(r=>r.status==='ok'));assert.equal(new Set(results.map(r=>r.report_id)).size,1);
 assert.equal((await db.admin.query('SELECT count(*)::int n FROM hc.report WHERE document_sha256=$1',[args.sha256])).rows[0].n,1);
});
