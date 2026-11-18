import {PDF_FIXTURES,fixturePdf,identifyFixture,type FixtureId} from '../src/modules/extraction/corpus';
import {extractSyntheticPdf,selectedObservations,PdfSelectionSchema,type PdfProposal} from '../src/modules/extraction/native';
import {baseRecord} from '../src/modules/health-records/fixtures';
import {PERSON_ALPHA,PERSON_BETA} from '../src/modules/health-records/model';
import {importTemplate,TEMPLATE_TEXT} from '../src/modules/documents/import-contract';
import {documentPdf} from '../src/modules/documents/pdf';
const HTML='<!doctype html><html lang="fr" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><meta name="color-scheme" content="dark light"><title>Convergence — démo mobile privée</title><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>';
const ORIGIN='https://convergence-mobile-demo.waxyphlox4.chatgpt.site';
const HEADERS={'x-content-type-options':'nosniff','referrer-policy':'no-referrer','cache-control':'no-store','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'"};
const json=(data:unknown,status=200,headers:Record<string,string>={})=>new Response(JSON.stringify(data),{status,headers:{...HEADERS,'content-type':'application/json; charset=utf-8',...headers}});
const cookie=(request:Request,name:string)=>request.headers.get('cookie')?.split(';').map(p=>p.trim()).find(p=>p.startsWith(name+'='))?.slice(name.length+1);
const persona=(r:Request)=>cookie(r,'hc_mobile_person');
const validPerson=(id:string|undefined)=>id===PERSON_ALPHA||id===PERSON_BETA;
const cookieHeader=(name:string,value:string)=>`${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax`;
const hash=async(text:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
async function record(request:Request,id:string){const value=baseRecord(id);value.storage='mobile-demo-session';if(id===PERSON_ALPHA&&cookie(request,'hc_mobile_import')==='1'){value.observations.push(...structuredClone(importTemplate.observations));value.documents.push({id:'lab-2026-11-18',personId:PERSON_ALPHA,synthetic:true,title:'Bilan biologique · novembre 2026 (import)',date:'2026-11-18T08:15:00Z',knownAt:'2026-11-18T10:00:00Z',laboratory:'Laboratoire Atlas · fictif',pages:1,kind:'biology',status:'needs-review'});}for(const state of pdfStates(request)){if(id!=='demo-alpha')break;const p=await proposalFor(state.fixtureId);const observations=selectedObservations(p,state.selectedIds);value.documents.push(p.document);value.observations.push(...observations.map(o=>({...o,evidence:{...o.evidence,processedAt:state.processedAt}})));}return value;}
async function body(request:Request,max:number){if(Number(request.headers.get('content-length')||0)>max)throw Error('PAYLOAD_TOO_LARGE');const reader=request.body?.getReader();if(!reader)return '';const chunks:Uint8Array[]=[];let n=0;for(;;){const part=await reader.read();if(part.done)break;n+=part.value.length;if(n>max){await reader.cancel();throw Error('PAYLOAD_TOO_LARGE');}chunks.push(part.value);}const bytes=new Uint8Array(n);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
export async function handle(request:Request){
 try{
  const url=new URL(request.url),path=url.pathname;
  if(request.method==='POST'){const origin=request.headers.get('origin');if(origin!==url.origin&&origin!==ORIGIN)return json({error:'FORBIDDEN'},403);}
  if(path==='/healthz')return json({status:'ok',mode:'PRIVATE_SYNTHETIC_MOBILE_DEMO',storage:'browser-session'});
  if(path==='/api/session'&&request.method==='POST'){
   let data;try{data=JSON.parse(await body(request,200));}catch(e){if(e instanceof Error&&e.message==='PAYLOAD_TOO_LARGE')throw e;return json({error:'INVALID_JSON'},422);}
   if(!data||Object.keys(data).length!==1||!validPerson(data.personId))return json({error:'INVALID_PERSONA'},422);
   return json({personId:data.personId,mode:'mobile-demo-session'},200,{'set-cookie':cookieHeader('hc_mobile_person',data.personId)});
  }
  if(path.startsWith('/api/')){
   const id=persona(request);if(!validPerson(id))return json({error:'UNAUTHENTICATED'},401);
   if(path.startsWith('/api/records/')&&request.method==='GET'){const requested=decodeURIComponent(path.slice('/api/records/'.length));if(requested!==id)return json({error:'FORBIDDEN'},403);return json(await record(request,id!));}
   if(path==='/api/pdf/fixtures'&&request.method==='GET'){
    if(id!=='demo-alpha')return json({error:'FORBIDDEN'},403);const f=url.searchParams.get('id');if(!f)return json(PDF_FIXTURES);if(!PDF_FIXTURES.some(x=>x.id===f))return json({error:'NOT_FOUND'},404);return new Response((await fixturePdf(f as FixtureId)) as Uint8Array<ArrayBuffer>,{headers:{...HEADERS,'content-type':'application/pdf','content-disposition':`inline; filename="bilan-synthetique-${f}.pdf"`}});
   }
   if(path==='/api/pdf/analyze'&&request.method==='POST'){
    if(!request.headers.get('content-type')?.startsWith('application/pdf'))return json({error:'INVALID_FILE_TYPE'},422);
    const bytes=await binaryBody(request,500000);const fixtureId=await identifyFixture(bytes);const p=await extractSyntheticPdf(bytes,id!);proposals.set(fixtureId,Promise.resolve(p));pids.set(fixtureId,p.id);return json({status:'ok',proposal:p,reviewed:pdfStates(request).some(s=>s.fixtureId===fixtureId)});
   }
   if(path==='/api/pdf/confirm'&&request.method==='POST'){
    if(id!=='demo-alpha')return json({error:'FORBIDDEN'},403);let selection;try{selection=PdfSelectionSchema.parse(JSON.parse(await body(request,10000)));}catch{return json({error:'INVALID_SELECTION'},422);}
    let p:PdfProposal|undefined;for(const f of PDF_FIXTURES){const candidate=await proposalFor(f.id);if(candidate.sha256===selection.sha256){p=candidate;break;}}if(!p)return json({error:'NOT_FOUND'},404);
    let rows;try{rows=selectedObservations(p,selection.selectedIds);}catch{return json({error:'INVALID_SELECTION'},422);}
    const states=pdfStates(request),existing=states.find(s=>s.fixtureId===p!.fixtureId);if(existing){const same=[...existing.selectedIds].sort().join('|')===[...selection.selectedIds].sort().join('|');return json({inserted:0,duplicates:1,...(!same?{error:'REVIEW_CONFLICT'}:{})},same?200:409);}
    states.push({fixtureId:p.fixtureId,selectedIds:selection.selectedIds,processedAt:rows[0].evidence.processedAt});return json({inserted:rows.length,duplicates:0},200,{'set-cookie':cookieHeader('hc_mobile_pdf',encodeURIComponent(JSON.stringify(states)))});
   }
   if(path==='/api/imports'&&request.method==='GET')return new Response(TEMPLATE_TEXT,{headers:{...HEADERS,'content-type':'application/json','content-disposition':'attachment; filename="bilan-synthetique-demo.json"'}});
   if(path==='/api/imports'&&request.method==='POST'){
    if(id!==PERSON_ALPHA)return json({error:'FORBIDDEN'},403);
    if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'INVALID_FILE_TYPE'},422);
    const text=await body(request,100000);const sha=await hash(text);if(sha!==await hash(TEMPLATE_TEXT))return json({error:'INVALID_DEMO_FILE'},422);
    const duplicate=cookie(request,'hc_mobile_import')==='1';return json({inserted:duplicate?0:1,duplicates:duplicate?1:0,sha256:sha},duplicate?200:201,{'set-cookie':cookieHeader('hc_mobile_import','1')});
   }
   if(path==='/api/export'&&request.method==='GET')return new Response(JSON.stringify(await record(request,id!),null,2),{headers:{...HEADERS,'content-type':'application/json','content-disposition':'attachment; filename="convergence-demo-mobile.json"'}});
   if(path.startsWith('/api/documents/')&&request.method==='GET'){
    const value=await record(request,id!);const doc=value.documents.find(d=>d.id===decodeURIComponent(path.slice('/api/documents/'.length)));if(!doc)return json({error:'NOT_FOUND'},404);
    const state=pdfStates(request).find(s=>pids.get(s.fixtureId)===doc.id);const pdf=state?await fixturePdf(state.fixtureId):await documentPdf(value,doc);const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',pdf as Uint8Array<ArrayBuffer>)),b=>b.toString(16).padStart(2,'0')).join('');return new Response(pdf as Uint8Array<ArrayBuffer>,{headers:{...HEADERS,'content-type':'application/pdf','content-disposition':`inline; filename="${doc.id}.pdf"`,'x-document-sha256':sha}});
   }
   return json({error:'NOT_FOUND'},404);
  }
  if(request.method!=='GET'&&request.method!=='HEAD')return json({error:'METHOD_NOT_ALLOWED'},405);
  return new Response(HTML,{headers:{...HEADERS,'content-type':'text/html; charset=utf-8'}});
 }catch(e){const code=e instanceof Error?e.message:'INTERNAL_ERROR';const status=code==='PAYLOAD_TOO_LARGE'?413:code==='FORBIDDEN'?403:code.startsWith('INVALID')?422:500;return json({error:status===500?'INTERNAL_ERROR':code},status);}
}

interface PdfState{fixtureId:FixtureId;selectedIds:string[];processedAt:string;}
const proposals=new Map<FixtureId,Promise<PdfProposal>>();const pids=new Map<FixtureId,string>();
function pdfStates(request:Request):PdfState[]{try{const states=JSON.parse(decodeURIComponent(cookie(request,'hc_mobile_pdf')||'%5B%5D')) as PdfState[];if(!Array.isArray(states)||states.length>4||new Set(states.map(s=>s.fixtureId)).size!==states.length||states.some(s=>!PDF_FIXTURES.some(f=>f.id===s.fixtureId)||!Array.isArray(s.selectedIds)))return [];return states;}catch{return [];}}
function proposalFor(id:FixtureId){let p=proposals.get(id);if(!p){p=fixturePdf(id).then(bytes=>extractSyntheticPdf(bytes,'demo-alpha')).then(result=>{pids.set(id,result.id);return result;});proposals.set(id,p);}return p;}
async function binaryBody(request:Request,max:number){if(Number(request.headers.get('content-length')||0)>max)throw Error('PAYLOAD_TOO_LARGE');const reader=request.body?.getReader();if(!reader)return new Uint8Array();const chunks:Uint8Array[]=[];let n=0;for(;;){const part=await reader.read();if(part.done)break;n+=part.value.length;if(n>max){await reader.cancel();throw Error('PAYLOAD_TOO_LARGE');}chunks.push(part.value);}const bytes=new Uint8Array(n);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return bytes;}
