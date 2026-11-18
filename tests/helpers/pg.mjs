// Base PostgreSQL JETABLE par fichier de test : créée, migrée (001→005), peuplée du jeu fictif, puis supprimée.
import {randomBytes} from 'node:crypto';
import pg from 'pg';
import {migrate} from '../../scripts/migrate.mjs';
import {seedDemo} from '../../scripts/seed-demo.mjs';
export const ADMIN_URL=process.env.HC_TEST_ADMIN_URL||'postgresql://hc_migration_owner:synthetic-owner-only@127.0.0.1:55432/postgres';
export const API_PASSWORD='synthetic-test-api-password-0123';
export const P_ALPHA='5a73bb9c-742f-5663-afba-549d057ff4a6',P_BETA='22222222-2222-4222-8222-222222222222';
const withDb=(url,db)=>{const u=new URL(url);u.pathname='/'+db;return u.toString();};
export async function createTestDatabase({seed=true,migrationDir}={}){
 process.env.HC_SYNTHETIC_ONLY='true';
 const name='hc_test_'+randomBytes(6).toString('hex');
 const root=new pg.Client({connectionString:ADMIN_URL});await root.connect();
 await root.query(`CREATE DATABASE ${name}`);await root.end();
 const adminUrl=withDb(ADMIN_URL,name);const u=new URL(adminUrl);u.username='hc_api_test_login';u.password=API_PASSWORD;const apiUrl=u.toString();
 await migrate({adminUrl,apiPassword:API_PASSWORD,apiLogin:'hc_api_test_login',log:()=>{},migrationDir});
 const summary=seed?await seedDemo({adminUrl,apiUrl,log:()=>{}}):null;
 const admin=new pg.Pool({connectionString:adminUrl,max:2});const api=new pg.Pool({connectionString:apiUrl,max:6});
 return {name,adminUrl,apiUrl,admin,api,summary,async drop(){await admin.end();await api.end();const r=new pg.Client({connectionString:ADMIN_URL});await r.connect();await r.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);await r.end();}};
}
