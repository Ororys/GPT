// Applique sql/NNN_*.sql dans l'ordre, une seule fois, avec contrôle d'empreinte.
// À exécuter avec le rôle d'amorçage (HC_ADMIN_DATABASE_URL) — JAMAIS avec le rôle de l'API.
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import pg from 'pg';
const sqlDir=resolve(dirname(fileURLToPath(import.meta.url)),'../sql');
// apiLogin : rôle de connexion de l'API. Les tests utilisent un rôle DISTINCT pour ne jamais modifier celui d'une instance en service.
export async function migrate({adminUrl,apiPassword,apiLogin='hc_api_login',log=console.log,migrationDir=sqlDir}){
 if(!/^hc_api_[a-z_]{1,40}$/.test(apiLogin))throw Error('BAD_API_LOGIN');
 const client=new pg.Client({connectionString:adminUrl});await client.connect();
 try{
  await client.query('SELECT pg_advisory_lock(727001)');
  await client.query('CREATE TABLE IF NOT EXISTS public.hc_schema_migration(filename text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
  const done=new Map((await client.query('SELECT filename,sha256 FROM public.hc_schema_migration')).rows.map(r=>[r.filename,r.sha256]));
  for(const file of readdirSync(migrationDir).filter(f=>/^\d{3}_.+\.sql$/.test(f)).sort()){
   const text=readFileSync(resolve(migrationDir,file),'utf8');const sha=createHash('sha256').update(text).digest('hex');
   if(done.has(file)){if(done.get(file)!==sha)throw Error(`MIGRATION_MODIFIED_AFTER_APPLY: ${file}`);continue;}
   try{
    await client.query('BEGIN');
    await client.query(text.replace(/^BEGIN;\s*/m,'').replace(/^COMMIT;\s*$/m,''));
    await client.query('INSERT INTO public.hc_schema_migration(filename,sha256) VALUES($1,$2)',[file,sha]);
    await client.query('COMMIT');
   }catch(e){await client.query('ROLLBACK').catch(()=>{});throw Error(`MIGRATION_FAILED ${file}: ${e.message}`);}
   log(`applied ${file}`);
  }
  if(apiPassword){
   if(apiPassword.length<16)throw Error('HC_API_DB_PASSWORD must be 16+ characters');
   const exists=(await client.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[apiLogin])).rowCount>0;
   const {rows}=await client.query(`SELECT format('${exists?'ALTER':'CREATE'} ROLE ${apiLogin} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT PASSWORD %L',$1::text) AS q`,[apiPassword]);
   await client.query(rows[0].q);
   await client.query(`ALTER ROLE ${apiLogin} INHERIT`);await client.query(`GRANT hc_api TO ${apiLogin}`);
   const db=(await client.query('SELECT current_database() AS d')).rows[0].d;
   await client.query(`GRANT CONNECT ON DATABASE ${pg.escapeIdentifier(db)} TO ${apiLogin}`);
  }
 }finally{await client.query('SELECT pg_advisory_unlock(727001)').catch(()=>{});await client.end();}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(!process.env.HC_ADMIN_DATABASE_URL)throw Error('HC_ADMIN_DATABASE_URL required');
 await migrate({adminUrl:process.env.HC_ADMIN_DATABASE_URL,apiPassword:process.env.HC_API_DB_PASSWORD});
 console.log('migrations up to date');
}
