// API HTTP Health Convergence v3 — UN seul serveur, adossé à PostgreSQL via PgRepository.
// V1 DESCRIPTIVE UNIQUEMENT : aucun score, aucune alerte, aucun diagnostic. Données synthétiques uniquement.
import {createServer} from 'node:http';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {verifyDemoToken,mintDemoToken} from './token.mjs';
import {buildLiveReport,verifyReferences,reportToMarkdown} from './live-report.mjs';
import {CONNECTORS,publicConnectors} from './connectors/index.mjs';

export const ALGORITHM_VERSION='3.1-descriptive';
export const DEMO_PERSONAS=Object.freeze([
 {subject:'patient-demo',label:'Patient fictif ALPHA (son propre dossier)'},
 {subject:'patient-beta',label:'Patient fictif BETA (dossier vide)'},
 {subject:'physician-demo',label:'Médecin fictif (prise en charge d\'ALPHA)'},
 {subject:'ide-demo',label:'IDE fictif (mesures pour ALPHA, sans lecture de l\'historique)'},
 {subject:'founder-demo',label:'Fondateur / technique (aucun accès aux dossiers)'},
 {subject:'admin-demo',label:'Administratif (aucun accès aux dossiers)'}]);
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const DAY=/^\d{4}-\d{2}-\d{2}$/;
const SECURITY={'x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY','cross-origin-resource-policy':'same-origin'};
const API_HEADERS={...SECURITY,'content-type':'application/json; charset=utf-8','cache-control':'no-store, private','content-security-policy':"default-src 'none'; frame-ancestors 'none'"};
const PAGE_CSP="default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const STATUS_HTTP={forbidden:[403,'FORBIDDEN'],not_found:[404,'NOT_FOUND'],invalid:[422,'INVALID'],conflict:[409,'REVISION_CONFLICT'],connection_inactive:[409,'CONNECTION_INACTIVE']};
class HttpError extends Error{constructor(status,code,extra){super(code);this.status=status;this.code=code;this.extra=extra;}}
const bad=(code='INVALID_PARAMETERS')=>new HttpError(400,code);

function validDay(s){if(!DAY.test(s))return false;const t=Date.parse(s+'T00:00:00Z');return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===s;}
function intParam(q,name,def,min,max){const s=q.get(name);if(s===null)return def;if(!/^\d{1,7}$/.test(s))throw bad();const n=Number(s);if(n<min||n>max)throw bad();return n;}
function onlyParams(q,allowed){for(const k of q.keys())if(!allowed.includes(k))throw bad();}
function rangeParams(q){const start=q.get('start'),end=q.get('end');if((start!==null&&!validDay(start))||(end!==null&&!validDay(end))||(start&&end&&start>end))throw bad('INVALID_RANGE');return {start,end};}
// Au-delà de la limite, le corps est lu sans être conservé (réponse 413 propre), puis la connexion est coupée s'il est démesuré.
async function readBody(req,max){let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>max*8){req.destroy();break;}if(size<=max)chunks.push(c);}if(size>max)throw new HttpError(413,'PAYLOAD_TOO_LARGE');return Buffer.concat(chunks).toString('utf8');}
function unwrap(r){if(r?.status==='ok')return r;const m=STATUS_HTTP[r?.status];if(!m)throw new HttpError(500,'INTERNAL_ERROR');throw new HttpError(m[0],m[1],r);}
// Neutralise l'interprétation de formules par un tableur à l'ouverture d'un export.
const csvCell=v=>{let s=v===null||v===undefined?'':String(v);if(typeof v==='string'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return /[",\n\r]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;};
const EXPORT_COLUMNS=['id','metric_code','method_code','value','unit','measured_at','interval_end_at','source_namespace','source_record_id','source_device','quality_state','synthetic'];

export function createApp({repo,secret,demoLogin=false,allowedHosts=null,webDir=null}){
 if(!repo)throw Error('BAD_REPOSITORY');
 if(typeof secret!=='string'||Buffer.byteLength(secret)<32)throw Error('BAD_SECRET');
 const statics=webDir?new Map([['/',['index.html','text/html; charset=utf-8']],['/app.js',['app.js','text/javascript; charset=utf-8']],['/styles.css',['styles.css','text/css; charset=utf-8']]]):new Map();
 const openapiPath=webDir?resolve(webDir,'../docs/openapi.yaml'):null;
 let registryCache=null;
 async function registry(){if(!registryCache||Date.now()-registryCache.at>60000){const r=unwrap(await repo.registry());registryCache={at:Date.now(),value:r,labels:Object.fromEntries(r.metrics.map(m=>[m.metric_code,m.label])),daily:r.metrics.filter(m=>m.series_kind==='daily_series').map(m=>m.metric_code)};}return registryCache;}
 const json=(res,status,payload)=>{res.writeHead(status,API_HEADERS);res.end(JSON.stringify(payload));};

 async function handle(req,res,requestId){
  const url=new URL(req.url,'http://localhost');const path=url.pathname,q=url.searchParams,method=req.method;
  // Anti DNS-rebinding : le serveur n'accepte que les noms d'hôte explicitement prévus.
  if(allowedHosts&&!allowedHosts.includes(String(req.headers.host||'').toLowerCase()))throw new HttpError(421,'MISDIRECTED_REQUEST');
  if(path==='/healthz'&&method==='GET'){await repo.ping();return json(res,200,{status:'ok',mode:'SYNTHETIC_ONLY'});}
  if(statics.has(path)){if(method!=='GET')throw new HttpError(405,'METHOD_NOT_ALLOWED');const [file,type]=statics.get(path);res.writeHead(200,{...SECURITY,'content-type':type,'cache-control':'no-store','content-security-policy':PAGE_CSP});return res.end(readFileSync(resolve(webDir,file)));}
  if(path==='/api/v1/openapi.yaml'&&method==='GET'&&openapiPath){res.writeHead(200,{...SECURITY,'content-type':'application/yaml; charset=utf-8','cache-control':'no-store'});return res.end(readFileSync(openapiPath));}
  if(!path.startsWith('/api/v1/'))throw new HttpError(404,'NOT_FOUND');

  if(path==='/api/v1/demo/personas'&&method==='GET'){if(!demoLogin)throw new HttpError(404,'NOT_FOUND');return json(res,200,{personas:DEMO_PERSONAS,notice:'Connexion de démonstration : aucune authentification réelle.'});}
  if(path==='/api/v1/demo/session'&&method==='POST'){
   // Substitut de fournisseur d'identité, STRICTEMENT pour la démonstration synthétique (voir BLOCKERS.md).
   if(!demoLogin)throw new HttpError(404,'NOT_FOUND');
   if(!String(req.headers['content-type']||'').startsWith('application/json'))throw new HttpError(415,'UNSUPPORTED_MEDIA_TYPE');
   let body;try{body=JSON.parse(await readBody(req,2000));}catch(e){if(e instanceof HttpError)throw e;throw bad('INVALID_JSON');}
   if(!DEMO_PERSONAS.some(p=>p.subject===body?.subject))throw new HttpError(422,'UNKNOWN_PERSONA');
   return json(res,200,{token:mintDemoToken(body.subject,{secret}),expires_in:900,requestId});
  }

  const bearer=String(req.headers.authorization||'');
  if(!bearer.startsWith('Bearer '))throw new HttpError(401,'UNAUTHENTICATED');
  const {subject}=verifyDemoToken(bearer.slice(7),{secret}); // seule l'identité vient du jeton ; les droits viennent de la base

  if(path==='/api/v1/me'&&method==='GET'){const me=unwrap(await repo.whoami({subject}));return json(res,200,{subject:me.subject,actor_kind:me.actor_kind,patients:me.patients,requestId});}
  if(path==='/api/v1/metrics'&&method==='GET'){const r=(await registry()).value;return json(res,200,{metrics:r.metrics,namespaces:r.namespaces,requestId});}
  if(path==='/api/v1/connectors'&&method==='GET')return json(res,200,{connectors:publicConnectors(),requestId});

  const m=/^\/api\/v1\/patients\/([^/]+)\/([a-z]+)(?:\/([^/]+))?$/.exec(path);
  if(!m||!UUID.test(m[1]))throw new HttpError(404,'NOT_FOUND');
  const personId=m[1].toLowerCase(),resource=m[2],item=m[3]??null;

  if(resource==='observations'&&item===null&&method==='GET'){
   onlyParams(q,['metric','source','start','end','limit','offset']);
   const metric=q.get('metric'),namespace=q.get('source');
   if((metric!==null&&!/^[A-Z][A-Z0-9_]{0,31}$/.test(metric))||(namespace!==null&&!/^[a-z][a-z0-9_]{2,47}$/.test(namespace)))throw bad();
   const {start,end}=rangeParams(q);
   const r=unwrap(await repo.listObservations({subject,personId,metric,namespace,from:start?start+'T00:00:00Z':null,to:end?new Date(Date.parse(end+'T00:00:00Z')+86400000).toISOString():null,limit:intParam(q,'limit',50,1,500),offset:intParam(q,'offset',0,0,1000000)}));
   return json(res,200,{total:r.total,limit:r.limit,offset:r.offset,observations:r.observations,requestId});
  }
  if(resource==='observations'&&item!==null&&method==='GET'){
   if(!UUID.test(item)||url.search)throw bad();
   return json(res,200,{observation:unwrap(await repo.getObservation({subject,personId,id:item})).observation,requestId});
  }
  if(resource==='report'&&item===null&&method==='GET'){
   onlyParams(q,['start','end','windowDays','minDays','format']);
   const {start,end}=rangeParams(q);const windowDays=intParam(q,'windowDays',14,7,45),minWatchDays=intParam(q,'minDays',7,1,45);
   const format=q.get('format')??'json';if(!['json','md'].includes(format)||minWatchDays>windowDays)throw bad();
   const inputs=unwrap(await repo.listObservations({subject,personId,limit:100000}));
   if(inputs.total>inputs.observations.length)throw new HttpError(422,'TOO_MANY_OBSERVATIONS');
   const reg=await registry();
   const report=buildLiveReport(inputs.observations,{start,end,windowDays,minWatchDays,labels:reg.labels,dailySeries:reg.daily,personId});
   verifyReferences(report,inputs.observations);
   const sha256=createHash('sha256').update(JSON.stringify(report)).digest('hex');
   const observationIds=[...new Set(report.inventory.flatMap(s=>s.observation_ids))];
   const saved=unwrap(await repo.recordReport({subject,personId,algorithm:ALGORITHM_VERSION,parameters:report.filters,sha256,observationIds}));
   if(format==='md'){res.writeHead(200,{...API_HEADERS,'content-type':'text/markdown; charset=utf-8','content-disposition':'attachment; filename="rapport-descriptif-synthetique.md"'});return res.end(reportToMarkdown(report)+`\n---\nRapport ${saved.report_id} · algorithme ${ALGORITHM_VERSION} · empreinte SHA-256 ${sha256}\n`);}
   return json(res,200,{report,report_id:saved.report_id,sha256,algorithm_version:ALGORITHM_VERSION,requestId});
  }
  if(resource==='export'&&item===null&&method==='GET'){
   onlyParams(q,['format']);const format=q.get('format')??'json';if(!['json','csv'].includes(format))throw bad();
   const r=unwrap(await repo.listObservations({subject,personId,limit:100000,action:'export'}));
   if(r.total>r.observations.length)throw new HttpError(422,'TOO_MANY_OBSERVATIONS');
   if(format==='csv'){res.writeHead(200,{...API_HEADERS,'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="observations-synthetiques.csv"'});return res.end([EXPORT_COLUMNS.join(','),...r.observations.map(o=>EXPORT_COLUMNS.map(c=>csvCell(o[c])).join(','))].join('\n')+'\n');}
   res.writeHead(200,{...API_HEADERS,'content-disposition':'attachment; filename="observations-synthetiques.json"'});return res.end(JSON.stringify({synthetic:true,person_id:personId,total:r.total,observations:r.observations}));
  }
  if(resource==='imports'&&item!==null&&method==='POST'){
   onlyParams(q,['version']);const version=q.get('version')??'1';if(!/^[A-Za-z0-9._-]{1,40}$/.test(version))throw bad();
   const connector=Object.hasOwn(CONNECTORS,item)?CONNECTORS[item]:null;
   if(!connector)throw new HttpError(404,'UNKNOWN_CONNECTOR');
   if(connector.status!=='simulated')throw new HttpError(501,'CONNECTOR_NOT_CONFIGURED',{requires:connector.requires});
   if(!String(req.headers['content-type']||'').startsWith(connector.contentType))throw new HttpError(415,'UNSUPPORTED_MEDIA_TYPE');
   const {records,errors}=connector.parse(await readBody(req,1_000_000));
   if(errors.length)throw new HttpError(422,'INVALID_FILE',{errors:errors.slice(0,200),inserted:0});
   if(records.length===0)throw new HttpError(422,'INVALID_FILE',{errors:[{row:1,reason:'NO_DATA_ROWS'}],inserted:0});
   if(records.length>5000)throw new HttpError(413,'PAYLOAD_TOO_LARGE');
   const r=await repo.importBatch({subject,personId,namespace:connector.id,version,records});
   if(r.status==='invalid'||r.status==='conflict')throw new HttpError(r.status==='conflict'?409:422,r.status==='conflict'?'REVISION_CONFLICT':'INVALID_RECORDS',{inserted:0,errors:(r.errors||[]).slice(0,200).map(e=>({row:e.index===null?null:e.index+2,source_record_id:e.source_record_id,reason:e.reason}))});
   unwrap(r);return json(res,r.inserted>0?201:200,{inserted:r.inserted,duplicates:r.duplicates,connector:connector.id,version,requestId});
  }
  if(resource==='connections'&&item===null&&method==='GET')return json(res,200,{connections:unwrap(await repo.listConnections({subject,personId})).connections,requestId});
  if(resource==='connections'&&item!==null&&method==='PUT'){
   if(!/^[a-z][a-z0-9_]{2,47}$/.test(item))throw bad();
   if(!String(req.headers['content-type']||'').startsWith('application/json'))throw new HttpError(415,'UNSUPPORTED_MEDIA_TYPE');
   let body;try{body=JSON.parse(await readBody(req,2000));}catch(e){if(e instanceof HttpError)throw e;throw bad('INVALID_JSON');}
   if(!['active','revoked'].includes(body?.status))throw new HttpError(422,'INVALID');
   const r=unwrap(await repo.setConnection({subject,personId,provider:item,status:body.status}));
   return json(res,200,{provider:r.provider,status:r.connection_status,requestId});
  }
  if(resource==='audit'&&item===null&&method==='GET'){onlyParams(q,['limit']);return json(res,200,{events:unwrap(await repo.listAudit({subject,personId,limit:intParam(q,'limit',50,1,200)})).events,requestId});}
  if(['observations','report','export','imports','connections','audit'].includes(resource))throw new HttpError(405,'METHOD_NOT_ALLOWED');
  throw new HttpError(404,'NOT_FOUND');
 }

 return createServer(async(req,res)=>{
  const requestId=randomUUID();
  try{await handle(req,res,requestId);}
  catch(e){
   if(res.headersSent){res.destroy();return;}
   let status=500,code='INTERNAL_ERROR',extra;
   if(e instanceof HttpError){status=e.status;code=e.code;
    // Ne renvoie que des champs explicitement prévus ; jamais le détail d'une exception interne.
    if(e.extra?.errors)extra={errors:e.extra.errors,inserted:0};else if(e.extra?.requires)extra={requires:e.extra.requires};else if(e.extra?.provider)extra={provider:e.extra.provider};}
   else if(e?.message==='UNAUTHENTICATED'){status=401;code='UNAUTHENTICATED';}
   else if(['INVALID_RANGE','INVALID_WINDOW'].includes(e?.message)){status=400;code=e.message;}
   else console.error(JSON.stringify({level:'error',requestId,error:String(e?.message||e).slice(0,300)})); // message technique, sans valeur médicale ni jeton
   json(res,status,{error:code,...extra,requestId});
  }
 });
}
