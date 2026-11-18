// Génère .env avec des secrets ALÉATOIRES LOCAUX (jamais versionnés). N'écrase pas un .env existant.
import {existsSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
if(existsSync('.env')){console.log('.env existe déjà : inchangé');process.exit(0);}
const r=n=>randomBytes(n).toString('hex');const admin=r(18),api=r(18);
writeFileSync('.env',[`# Généré localement le ${new Date().toISOString().slice(0,10)} — données synthétiques uniquement — NE PAS VERSIONNER`,
 'HC_SYNTHETIC_ONLY=true','HC_DEMO_LOGIN=true',`HC_ADMIN_DB_PASSWORD=${admin}`,`HC_API_DB_PASSWORD=${api}`,`HC_TOKEN_SECRET=${r(32)}`,
 '# Utilisés hors Docker (npm run db:migrate / db:seed / start / test:pg) :',
 `HC_ADMIN_DATABASE_URL=postgresql://hc_admin:${admin}@127.0.0.1:55432/health_convergence_demo`,
 `DATABASE_URL=postgresql://hc_api_login:${api}@127.0.0.1:55432/health_convergence_demo`,
 `HC_TEST_ADMIN_URL=postgresql://hc_admin:${admin}@127.0.0.1:55432/postgres`,''].join('\n'),{mode:0o600});
console.log('.env créé (secrets aléatoires locaux)');
