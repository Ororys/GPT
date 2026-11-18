import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,copyFileSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {migrate} from '../scripts/migrate.mjs';
import {createTestDatabase} from './helpers/pg.mjs';

test('migration : DDL et reçu atomiques, reprise, idempotence, détection de modification',async()=>{
 const db=await createTestDatabase({seed:false});const dir=mkdtempSync(join(tmpdir(),'hc-migration-'));
 const file=join(dir,'900_probe.sql');const run=()=>migrate({adminUrl:db.adminUrl,migrationDir:dir,log:()=>{}});
 try{
  writeFileSync(file,'BEGIN;\nCREATE TABLE public.atomic_probe(id int);\nSELECT missing_function();\nCOMMIT;\n');
  await assert.rejects(run(),/MIGRATION_FAILED/);
  assert.equal((await db.admin.query("SELECT to_regclass('public.atomic_probe') t")).rows[0].t,null);
  assert.equal((await db.admin.query("SELECT count(*)::int n FROM public.hc_schema_migration WHERE filename='900_probe.sql'")).rows[0].n,0);
  writeFileSync(file,'BEGIN;\nCREATE TABLE public.atomic_probe(id int);\nCOMMIT;\n');
  await run();await run();
  assert.equal((await db.admin.query("SELECT count(*)::int n FROM public.hc_schema_migration WHERE filename='900_probe.sql'")).rows[0].n,1);
  writeFileSync(file,'SELECT 1;');await assert.rejects(run(),/MIGRATION_MODIFIED_AFTER_APPLY/);
 }finally{rmSync(dir,{recursive:true});await db.drop();}
});


test('mise à niveau v3.0 vers v3.1 : registre migrations et réimport inchangés',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'hc-upgrade-'));let db;
 try{
  const sql=new URL('../sql/',import.meta.url);
  for(const name of readdirSync(sql).filter(n=>/^00[1-5]_/.test(n)))copyFileSync(new URL(name,sql),join(dir,name));
  db=await createTestDatabase({migrationDir:dir});
  assert.equal((await db.admin.query('SELECT count(*)::int n FROM public.hc_schema_migration')).rows[0].n,5);
  await migrate({adminUrl:db.adminUrl,log:()=>{}});
  const {seedDemo}=await import('../scripts/seed-demo.mjs');
  const summary=await seedDemo({adminUrl:db.adminUrl,apiUrl:db.apiUrl,log:()=>{}});
  assert.equal(Object.values(summary).reduce((n,r)=>n+r.inserted,0),0);
  assert.equal(Object.values(summary).reduce((n,r)=>n+r.duplicates,0),378);
  assert.equal((await db.admin.query('SELECT count(*)::int n FROM public.hc_schema_migration')).rows[0].n,6);
 }finally{await db?.drop();rmSync(dir,{recursive:true});}
});
