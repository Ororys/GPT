// Point d'entrée. Refuse de démarrer hors mode synthétique ou sans secret fourni par l'environnement.
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import pg from 'pg';
import {createApp} from './app.mjs';
import {PgRepository} from './pg-repository.mjs';
const env=process.env;
if(env.HC_SYNTHETIC_ONLY!=='true')throw Error('HC_SYNTHETIC_ONLY=true obligatoire : données réelles strictement interdites (voir BLOCKERS.md)');
if(!env.DATABASE_URL)throw Error('DATABASE_URL requis (rôle hc_api_login, jamais le rôle de migration)');
if(!env.HC_TOKEN_SECRET||Buffer.byteLength(env.HC_TOKEN_SECRET)<32)throw Error('HC_TOKEN_SECRET requis (32 octets minimum, généré localement, jamais versionné)');
const port=Number(env.PORT||8080),host=env.HOST||'127.0.0.1';
const pool=new pg.Pool({connectionString:env.DATABASE_URL,max:8,statement_timeout:8000,query_timeout:10000,application_name:'hc-api'});
const who=(await pool.query('SELECT current_user AS u,(SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user) AS privileged')).rows[0];
if(who.privileged)throw Error(`Refus de démarrer : le rôle SQL "${who.u}" est superutilisateur ou BYPASSRLS`);
const allowedHosts=(env.HC_ALLOWED_HOSTS||`127.0.0.1:${port},localhost:${port}`).split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
const app=createApp({repo:new PgRepository(pool),secret:env.HC_TOKEN_SECRET,demoLogin:env.HC_DEMO_LOGIN==='true',allowedHosts,webDir:resolve(dirname(fileURLToPath(import.meta.url)),'../web')});
app.listen(port,host,()=>console.log(`Health Convergence (synthétique) : http://127.0.0.1:${port}/  [écoute ${host}:${port}]`));
const stop=async()=>{app.close();await pool.end();process.exit(0);};process.on('SIGTERM',stop);process.on('SIGINT',stop);
