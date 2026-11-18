// Charge le jeu fictif : identités par SQL d'amorçage, observations PAR LA VRAIE FONCTION D'IMPORT
// (rôle API, autorisations réelles) — le seed emprunte donc le même chemin qu'un import utilisateur.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import pg from 'pg';
import {PgRepository} from '../src/pg-repository.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const DEMO_PERSON='5a73bb9c-742f-5663-afba-549d057ff4a6';
import {csvToRecords} from '../src/connectors/csv.mjs';
// Montre et laboratoire : chargés depuis les CSV fictifs PAR LES CONNECTEURS SIMULÉS (réimporter ces fichiers = doublons ignorés).
const CSV_SOURCES={demo_watch_csv:['patient-demo','fixtures/csv/watch_demo.csv'],demo_lab_csv:['ide-demo','fixtures/csv/lab_demo.csv']};
export async function seedDemo({adminUrl,apiUrl,log=console.log}){
 if(process.env.HC_SYNTHETIC_ONLY!=='true')throw Error('Refus : HC_SYNTHETIC_ONLY=true est obligatoire pour charger le jeu de démonstration');
 const admin=new pg.Client({connectionString:adminUrl});await admin.connect();
 try{await admin.query(readFileSync(resolve(root,'seeds/demo_seed.sql'),'utf8'));}finally{await admin.end();}
 const data=JSON.parse(readFileSync(resolve(root,'fixtures/report_api_observations_v2.0.json'),'utf8'));
 if(data.synthetic!==true||data.person_id!==DEMO_PERSON||data.observations.some(o=>o.synthetic!==true||o.person_id!==DEMO_PERSON))throw Error('UNSAFE_FIXTURE');
 const pool=new pg.Pool({connectionString:apiUrl,max:2});const repo=new PgRepository(pool);const summary={};
 try{
  const run=async(namespace,subject,records)=>{const r=await repo.importBatch({subject,personId:DEMO_PERSON,namespace,version:'1',records});
   if(r.status!=='ok')throw Error(`SEED_IMPORT_FAILED ${namespace}: ${JSON.stringify(r).slice(0,300)}`);summary[namespace]={inserted:r.inserted,duplicates:r.duplicates};};
  for(const [namespace,[subject,file]] of Object.entries(CSV_SOURCES)){
   const {records,errors}=csvToRecords(readFileSync(resolve(root,file),'utf8'));if(errors.length)throw Error('SEED_CSV_INVALID '+file);
   await run(namespace,subject,records);}
  // Mesures du centre : 8 observations du jeu v1.2 (elles n'avaient PAS d'identifiant source ; on utilise leur id historique).
  await run('demo_center_v1_2','ide-demo',data.observations.filter(o=>o.source_namespace==='demo_center_v1_2').map(o=>({source_record_id:o.id,metric_code:o.metric_code,method_code:o.method_code,value:o.value,unit:o.unit,measured_at:o.measured_at,interval_end_at:null,source_device:o.source_device})));
 }finally{await pool.end();}
 log('seed '+JSON.stringify(summary));return summary;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(!process.env.HC_ADMIN_DATABASE_URL||!process.env.DATABASE_URL)throw Error('HC_ADMIN_DATABASE_URL and DATABASE_URL required');
 await seedDemo({adminUrl:process.env.HC_ADMIN_DATABASE_URL,apiUrl:process.env.DATABASE_URL});
}
