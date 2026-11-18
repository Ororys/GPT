// Interface Health Convergence v3 — JavaScript natif, sans dépendance ni build.
// Toute donnée est insérée comme texte (jamais interprétée comme HTML). Le jeton reste en mémoire, jamais en stockage navigateur.
const state={token:null,me:null,personId:null,tab:'synthese',metrics:[],labels:{},connectors:[]};
const main=document.getElementById('main'),sessionBox=document.getElementById('session');
const svgNS='http://www.w3.org/2000/svg';
function h(tag,attrs={},...kids){const e=document.createElement(tag);for(const [k,v] of Object.entries(attrs)){if(v===null||v===undefined||v===false)continue;if(k==='class')e.className=v;else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else if(k==='text')e.textContent=v;else e.setAttribute(k,v===true?'':v);}for(const c of kids.flat()){if(c===null||c===undefined||c===false)continue;e.append(c.nodeType?c:document.createTextNode(String(c)));}return e;}
// replaceChildren convertirait null en texte « null » : on filtre.
const put=(el,...kids)=>el.replaceChildren(...kids.flat().filter(k=>k!==null&&k!==undefined&&k!==false));
function s(tag,attrs={},text){const e=document.createElementNS(svgNS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;}
const ERRORS={TOO_MANY_OBSERVATIONS:'Dossier trop volumineux pour cette vue. Utilisez les filtres de l’historique ou un export complet.',UNAUTHENTICATED:'Session expirée. Reconnectez-vous.',FORBIDDEN:'Accès refusé : ce rôle n\'est pas habilité pour ce dossier ou cette action. La tentative est journalisée.',NOT_FOUND:'Élément introuvable.',INVALID_RANGE:'Période invalide : vérifiez les dates.',INVALID_PARAMETERS:'Paramètres invalides.',INVALID_WINDOW:'Fenêtre de comparaison invalide.',REVISION_CONFLICT:'Conflit : un enregistrement déjà importé porte le même identifiant avec un contenu différent. Rien n\'a été importé.',CONNECTION_INACTIVE:'La connexion à cette source est inactive ou révoquée par le patient. Rien n\'a été importé.',INVALID_FILE:'Fichier illisible ou incomplet. Rien n\'a été importé.',INVALID_RECORDS:'Certaines lignes sont invalides. Rien n\'a été importé.',PAYLOAD_TOO_LARGE:'Fichier trop volumineux.',NETWORK:'Serveur injoignable. Vérifiez que l\'application locale est démarrée.',INTERNAL_ERROR:'Erreur interne du serveur.'};
class ApiError extends Error{constructor(code,body){super(code);this.code=code;this.body=body;}}
async function api(path,{method='GET',body,type,raw=false}={}){
 let res;try{res=await fetch(path,{method,headers:{...(state.token?{authorization:'Bearer '+state.token}:{}),...(type?{'content-type':type}:{})},body});}catch{throw new ApiError('NETWORK');}
 if(res.status===401&&state.token){logout('Session expirée. Reconnectez-vous.');throw new ApiError('UNAUTHENTICATED');}
 if(!res.ok){let b={};try{b=await res.json();}catch{}throw new ApiError(b.error||'INTERNAL_ERROR',b);}
 return raw?res:res.json();
}
const msg=e=>ERRORS[e.code]||('Erreur : '+(e.code||'inconnue'));
const stateBox=(title,text,cls='')=>h('div',{class:'card state '+cls,role:cls?'alert':'status'},h('strong',{text:title}),text);
const loading=()=>h('p',{class:'muted',role:'status',text:'Chargement…'});
const fmtDate=iso=>iso?iso.slice(0,10):'—';
const fmtDateTime=iso=>iso?iso.slice(0,16).replace('T',' ')+' UTC':'—';
const fmtNum=n=>typeof n==='number'?n.toLocaleString('fr-FR',{maximumFractionDigits:3}):'—';
const label=code=>state.labels[code]||code;
const person=()=>state.me?.patients.find(p=>p.id===state.personId);
const can=perm=>person()?.permissions?.includes(perm);
const pBase=()=>'/api/v1/patients/'+state.personId;

// ---------- Connexion de démonstration ----------
async function showLogin(notice){
 state.token=null;state.me=null;put(sessionBox);
 put(main,h('h1',{text:'Connexion de démonstration'}),notice?h('p',{class:'card error',role:'alert',text:notice}):null,loading());
 try{
  const {personas}=await api('/api/v1/demo/personas');
  main.lastChild.replaceWith(h('div',{class:'card'},h('p',{class:'muted',text:'Choisissez un profil fictif. Ce sélecteur remplace, pour la démonstration uniquement, un véritable fournisseur d\'identité : il ne constitue pas une authentification.'}),
   personas.map(p=>h('button',{class:'persona',onclick:()=>login(p.subject)},h('strong',{text:p.subject}),' — ',p.label))));
 }catch(e){main.lastChild.replaceWith(stateBox('Connexion indisponible',e.code==='NOT_FOUND'?'La connexion de démonstration est désactivée sur ce serveur (HC_DEMO_LOGIN).':msg(e),'error'));}
}
async function login(subject){
 try{
  state.token=(await api('/api/v1/demo/session',{method:'POST',type:'application/json',body:JSON.stringify({subject})})).token;
  const [me,reg,con]=await Promise.all([api('/api/v1/me'),api('/api/v1/metrics'),api('/api/v1/connectors')]);
  state.me=me;state.metrics=reg.metrics;state.labels=Object.fromEntries(reg.metrics.map(m=>[m.metric_code,m.label]));state.connectors=con.connectors;
  state.personId=me.patients[0]?.id??null;state.tab=defaultTab();renderShell();
 }catch(e){showLogin(msg(e));}
}
function logout(notice){showLogin(notice);}
function defaultTab(){return can('read')?'synthese':'imports';}

// ---------- Ossature ----------
const TABS=[['synthese','Synthèse','read'],['observations','Observations','read'],['rapport','Rapport','read'],['imports','Sources et imports',null],['journal','Journal d\'accès','read_audit']];
function renderShell(){
 const me=state.me;
 put(sessionBox,h('span',{},h('strong',{text:me.subject}),' ',h('span',{class:'pill',text:me.actor_kind})),
  me.patients.length>1?h('select',{'aria-label':'Dossier',onchange:e=>{state.personId=e.target.value;state.tab=defaultTab();renderShell();}},me.patients.map(p=>h('option',{value:p.id,selected:p.id===state.personId,text:p.alias}))):null,
  h('button',{onclick:()=>logout(),text:'Changer de profil'}));
 if(!me.patients.length){put(main,h('h1',{text:'Aucun dossier accessible'}),stateBox('Ce profil n\'a accès à aucun dossier','Les rôles administratif et technique n\'ont aucun droit de lecture ou d\'écriture sur les données de mesure. Ce contrôle est appliqué en base de données, pas seulement dans l\'interface.'));return;}
 const tabs=TABS.filter(t=>t[2]===null||can(t[2]));if(!tabs.some(t=>t[0]===state.tab))state.tab=tabs[0][0];
 const view=h('section',{id:'view','aria-live':'polite'});
 put(main,h('h1',{text:person().alias}),
  h('div',{class:'tabs',role:'tablist','aria-label':'Sections du dossier'},tabs.map(t=>h('button',{role:'tab','aria-selected':String(t[0]===state.tab),'data-tab':t[0],onclick:()=>{state.tab=t[0];renderShell();},text:t[1]}))),view);
 ({synthese:viewSynthese,observations:viewObservations,rapport:viewRapport,imports:viewImports,journal:viewJournal})[state.tab](view);
}

// ---------- Synthèse et graphique ----------
async function fetchAll(params=''){const out=[];let offset=0;for(;;){const r=await api(`${pBase()}/observations?limit=500&offset=${offset}${params}`);out.push(...r.observations);offset+=500;if(offset>=r.total)return out;if(offset>20000)throw new ApiError('TOO_MANY_OBSERVATIONS');}}
const seriesKey=o=>[o.metric_code,o.method_code,o.unit,o.source_namespace,o.source_device].join(' · ');
async function viewSynthese(view){
 put(view,loading());
 let all;try{all=await fetchAll();}catch(e){return put(view,stateBox('Impossible de charger la synthèse',msg(e),'error'));}
 if(!all.length)return put(view,stateBox('Aucune observation dans ce dossier','Ce dossier fictif est vide. Les mesures apparaîtront ici après un import depuis l\'onglet « Sources et imports ».'));
 const groups=new Map();for(const o of all){const k=seriesKey(o);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(o);}
 const metrics=[...new Set(all.map(o=>o.metric_code))].sort((a,b)=>label(a).localeCompare(label(b),'fr'));
 let selected=metrics[0];const chartBox=h('div',{class:'card'});const cards=h('div',{class:'grid'});
 const draw=()=>{
  put(cards,...[...groups.entries()].sort((a,b)=>label(a[1][0].metric_code).localeCompare(label(b[1][0].metric_code),'fr')).map(([k,rows])=>{const last=rows.at(-1),m=last.metric_code;
   return h('button',{class:'card series','aria-pressed':String(m===selected),onclick:()=>{selected=m;draw();}},h('h3',{text:label(m)}),h('div',{class:'big',text:`${fmtNum(last.value)} ${last.unit}`}),
    h('div',{class:'small muted',text:`dernière mesure le ${fmtDate(last.measured_at)} · ${rows.length} observation${rows.length>1?'s':''}`}),h('div',{class:'small muted',text:`${last.method_code} · ${last.source_device}`}));}));
  const rows=all.filter(o=>o.metric_code===selected);
  put(chartBox,h('h2',{text:`${label(selected)} — mesures brutes`}),chart(rows),
   h('p',{class:'small muted',text:'Chaque méthode, unité, source et appareil forme une série distincte. Les jours sans mesure ne sont pas interpolés : la courbe est interrompue.'}));
 };
 put(view,h('p',{class:'muted',text:`${all.length} observations, ${groups.size} séries distinctes. Sélectionnez une série pour afficher ses mesures.`}),cards,h('div',{},h('h2',{class:'skip',text:'Graphique'})),chartBox);draw();
}
function chart(rows){
 const W=720,H=260,L=48,R=12,T=12,B=28;const groups=new Map();for(const o of rows){const k=[o.method_code,o.unit,o.source_namespace,o.source_device].join(' · ');if(!groups.has(k))groups.set(k,[]);groups.get(k).push({t:Date.parse(o.measured_at),v:o.value});}
 const ts=rows.map(o=>Date.parse(o.measured_at)),vs=rows.map(o=>o.value);let t0=Math.min(...ts),t1=Math.max(...ts),v0=Math.min(...vs),v1=Math.max(...vs);
 if(t0===t1){t0-=864e5;t1+=864e5;}const pad=(v1-v0)*0.1||Math.abs(v1)*0.1||1;v0-=pad;v1+=pad;
 const x=t=>L+(t-t0)/(t1-t0)*(W-L-R),y=v=>T+(v1-v)/(v1-v0)*(H-T-B);
 const svg=s('svg',{viewBox:`0 0 ${W} ${H}`,class:'chart',role:'img','aria-label':`Graphique de ${rows.length} mesures brutes entre le ${fmtDate(new Date(t0).toISOString())} et le ${fmtDate(new Date(t1).toISOString())}`});
 for(let i=0;i<=4;i++){const v=v0+(v1-v0)*i/4;svg.append(s('line',{x1:L,x2:W-R,y1:y(v),y2:y(v),class:'axis'}),s('text',{x:L-6,y:y(v)+4,'text-anchor':'end'},fmtNum(Math.round(v*100)/100)));}
 for(let i=0;i<=3;i++){const t=t0+(t1-t0)*i/3;svg.append(s('text',{x:x(t),y:H-8,'text-anchor':i===0?'start':i===3?'end':'middle'},fmtDate(new Date(t).toISOString())));}
 const legend=h('div',{class:'legend'});let i=0;
 for(const [k,pts] of groups){const cls='s'+(i%4);pts.sort((a,b)=>a.t-b.t);let seg=[];
  const flush=()=>{if(seg.length>1)svg.append(s('polyline',{class:cls,points:seg.map(p=>`${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')}));seg=[];};
  for(const p of pts){if(seg.length&&p.t-seg.at(-1).t>1.5*864e5)flush();seg.push(p);svg.append(s('circle',{class:cls,cx:x(p.t).toFixed(1),cy:y(p.v).toFixed(1),r:pts.length>40?1.6:3.5}));}flush();
  legend.append(h('span',{},h('span',{class:'swatch '+cls}),k+` (${pts.length})`));i++;}
 return h('div',{},h('div',{class:'chartwrap'},svg),legend);
}

// ---------- Observations, sources d'origine, exports ----------
function viewObservations(view){
 const f={metric:'',source:'',start:'',end:'',offset:0};const limit=25;const results=h('div',{});const detail=h('div',{});
 const namespaces=[...new Set(state.connectors.filter(c=>c.status==='simulated').map(c=>c.id)),'demo_center_v1_2'];
 const load=async()=>{
  put(results,loading());put(detail);
  const qs=new URLSearchParams({limit,offset:f.offset});for(const k of ['metric','source','start','end'])if(f[k])qs.set(k,f[k]);
  let r;try{r=await api(`${pBase()}/observations?${qs}`);}catch(e){return put(results,stateBox('Impossible de charger les observations',msg(e),'error'));}
  if(!r.total)return put(results,stateBox('Aucune observation',f.metric||f.source||f.start||f.end?'Aucune mesure ne correspond à ces filtres. Élargissez la période ou retirez un filtre.':'Ce dossier ne contient encore aucune mesure.'));
  put(results,h('p',{class:'small muted',text:`${r.offset+1}–${r.offset+r.observations.length} sur ${r.total} observations`}),
   h('div',{class:'tablewrap'},h('table',{},h('thead',{},h('tr',{},['Date','Mesure','Valeur','Méthode','Source','Appareil',''].map((t,i)=>h('th',{class:i===2?'num':'',scope:'col',text:t})))),
    h('tbody',{},r.observations.map(o=>h('tr',{},h('td',{text:fmtDateTime(o.measured_at)}),h('td',{text:label(o.metric_code)}),h('td',{class:'num',text:`${fmtNum(o.value)} ${o.unit}`}),h('td',{text:o.method_code}),h('td',{text:o.source_namespace}),h('td',{text:o.source_device}),h('td',{},h('button',{class:'link','data-obs':o.id,onclick:()=>showObservation(detail,o.id),text:'Source'}))))))),
   h('div',{class:'row'},h('button',{disabled:r.offset===0,onclick:()=>{f.offset=Math.max(0,f.offset-limit);load();},text:'← Précédent'}),h('button',{disabled:r.offset+limit>=r.total,onclick:()=>{f.offset+=limit;load();},text:'Suivant →'})));
 };
 const field=(text,el)=>h('label',{},text,el);const on=k=>e=>{f[k]=e.target.value;f.offset=0;load();};
 put(view,h('div',{class:'filters'},
  field('Mesure',h('select',{id:'f-metric',onchange:on('metric')},h('option',{value:'',text:'Toutes'}),state.metrics.map(m=>h('option',{value:m.metric_code,text:m.label})))),
  field('Source',h('select',{id:'f-source',onchange:on('source')},h('option',{value:'',text:'Toutes'}),namespaces.map(n=>h('option',{value:n,text:n})))),
  field('Du',h('input',{type:'date',id:'f-start',onchange:on('start')})),field('Au',h('input',{type:'date',id:'f-end',onchange:on('end')})),
  h('span',{class:'spacer'}),can('export')?h('button',{onclick:()=>download('export?format=csv','observations-synthetiques.csv'),text:'Exporter CSV'}):null,can('export')?h('button',{onclick:()=>download('export?format=json','observations-synthetiques.json'),text:'Exporter JSON'}):null),results,detail);
 load();
}
async function showObservation(box,id){
 put(box,loading());
 try{const {observation:o}=await api(`${pBase()}/observations/${id}`);const kv=(k,v)=>[h('dt',{text:k}),h('dd',{class:typeof v==='string'&&v.length>30?'mono':'',text:v??'—'})];
  put(box,h('div',{class:'card',id:'obs-detail',tabindex:'-1'},h('h2',{text:'Enregistrement source'}),h('dl',{class:'kv'},kv('Mesure',`${label(o.metric_code)} (${o.metric_code})`),kv('Valeur canonique',`${fmtNum(o.value)} ${o.unit}`),kv('Valeur d\'origine',`${fmtNum(o.original_value)} ${o.original_unit}`),kv('Méthode',o.method_code),kv('Mesuré le',fmtDateTime(o.measured_at)),kv('Décalage horaire d\'origine',o.original_timezone),kv('Appareil',o.source_device),kv('Espace source',o.source_namespace),kv('Identifiant source',o.source_record_id),kv('Version d\'import',o.provenance.ingestion_version),kv('Importé le',fmtDateTime(o.provenance.imported_at)),kv('Empreinte SHA-256',o.provenance.payload_sha256),kv('Identifiant interne',o.id),kv('État qualité',o.quality_state),kv('Donnée fictive',o.synthetic?'oui':'non'))));
  box.firstChild.focus();box.firstChild.scrollIntoView({block:'nearest'});
 }catch(e){put(box,stateBox('Source indisponible',msg(e),'error'));}
}
async function download(path,filename){try{const res=await api(`${pBase()}/${path}`,{raw:true});const url=URL.createObjectURL(await res.blob());const a=h('a',{href:url,download:filename});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}catch(e){alertBox(msg(e));}}
function alertBox(text){const view=document.getElementById('view');view?.prepend(h('p',{class:'card error',role:'alert',text}));}

// ---------- Rapport longitudinal à la demande ----------
const STATUS={descriptive_comparison:'Comparaison descriptive',insufficient_coverage:'Non comparé : couverture insuffisante',insufficient_separation:'Non comparé : période trop courte pour deux fenêtres distinctes',single_observation:'Non comparé : une seule date de mesure'};
function viewRapport(view){
 const p={start:'',end:'',windowDays:14,minDays:7};const out=h('div',{});
 const qs=()=>{const q=new URLSearchParams({windowDays:p.windowDays,minDays:p.minDays});if(p.start)q.set('start',p.start);if(p.end)q.set('end',p.end);return q;};
 const run=async()=>{
  put(out,loading());let r;try{r=await api(`${pBase()}/report?${qs()}`);}catch(e){return put(out,stateBox('Rapport non généré',msg(e),'error'));}
  const rep=r.report;if(!rep.observations_considered)return put(out,stateBox('Aucune observation sur cette période','Le rapport ne contient aucune mesure. Élargissez la période ou importez des données.'));
  const side=c=>c?c.mean!==undefined?(c.mean===null?`— (${c.observed_days} j mesurés)`:`${fmtNum(c.mean)} (moy. ${c.observed_days} j, couverture ${fmtNum(c.coverage_pct)} %)`):`${fmtNum(c.value)} le ${fmtDate(c.date)}`:'—';
  const detail=h('div',{});
  put(out,
   h('p',{class:'small muted',id:'report-meta'},`Rapport ${r.report_id} · algorithme ${r.algorithm_version} · ${rep.observations_considered} observations · empreinte `,h('span',{class:'mono',text:r.sha256})),
   h('div',{class:'row'},h('button',{onclick:()=>download(`report?${qs()}&format=md`,'rapport-descriptif-synthetique.md'),text:'Télécharger (Markdown)'}),h('button',{onclick:()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(r,null,2)],{type:'application/json'}));const a=h('a',{href:url,download:'rapport-descriptif-synthetique.json'});document.body.append(a);a.click();a.remove();},text:'Télécharger (JSON)'})),
   h('h2',{text:'Ce qui a été mesuré et ce qui a varié'}),
   h('div',{class:'tablewrap'},h('table',{id:'report-table'},h('thead',{},h('tr',{},['Mesure','Méthode · appareil','Début','Fin','Écart','Statut','Sources'].map(t=>h('th',{scope:'col',text:t})))),
    h('tbody',{},rep.comparisons.map(c=>{const ids=[...(c.before?.ids||[]),...(c.after?.ids||[])];return h('tr',{},h('td',{text:`${c.label} (${c.unit})`}),h('td',{class:'small',text:`${c.method_code} · ${c.source_device}`}),h('td',{text:side(c.before)}),h('td',{text:side(c.after)}),h('td',{class:'num',text:c.delta===undefined?'—':`${c.delta>0?'+':''}${fmtNum(c.delta)} ${c.unit}`}),h('td',{class:'small',text:STATUS[c.status]||c.status}),h('td',{},ids.length?h('button',{class:'link',onclick:()=>{put(detail,h('div',{class:'card'},h('h3',{text:`${ids.length} observations utilisées — ${c.label}`}),h('p',{class:'row'},ids.slice(0,60).map(id=>h('button',{class:'link mono',onclick:()=>showObservation(detail,id),text:id.slice(0,8)}))),ids.length>60?h('p',{class:'small muted',text:`… et ${ids.length-60} autres (voir l'export JSON).`}):null));},text:`${ids.length}`}):'—'));})))),
   detail,
   h('h2',{text:'Rapprochements thématiques (regroupements descriptifs)'}),
   h('div',{class:'grid'},rep.cross_domain_panels.map(pn=>h('div',{class:'card'},h('h3',{text:`${pn.id} — ${pn.name}`}),h('p',{class:'small',text:'Disponible : '+(pn.available_metrics.map(label).join(', ')||'aucune mesure')}),pn.missing_metrics.length?h('p',{class:'small muted',text:'Manquant : '+pn.missing_metrics.map(label).join(', ')}):null))),
   h('h2',{text:'Limites'}),h('ul',{class:'plain small muted'},['Affichage descriptif uniquement : ni diagnostic, ni alerte, ni triage, ni score de risque.','Une évolution concomitante n\'établit aucun lien de cause à effet.','Appareils, sources, unités et méthodes ne sont jamais fusionnés.','Aucune interpolation des jours sans mesure.','Les données de montres grand public ne sont pas des mesures de qualité clinique.','Deux mesures ponctuelles n\'établissent pas une tendance.'].map(t=>h('li',{text:t}))));
 };
 const num=(k,min,max)=>h('input',{type:'number',min,max,value:p[k],id:'r-'+k,onchange:e=>{p[k]=e.target.value;}});
 put(view,h('p',{class:'muted',text:'Le rapport est recalculé à la demande à partir des observations autorisées, de façon déterministe : mêmes données et mêmes paramètres donnent la même empreinte.'}),
  h('form',{class:'filters',onsubmit:e=>{e.preventDefault();run();}},h('label',{},'Du',h('input',{type:'date',id:'r-start',onchange:e=>{p.start=e.target.value;}})),h('label',{},'Au',h('input',{type:'date',id:'r-end',onchange:e=>{p.end=e.target.value;}})),
   h('label',{},'Fenêtre (jours, 7–45)',num('windowDays',7,45)),h('label',{},'Jours mesurés minimum',num('minDays',1,45)),h('button',{class:'primary',type:'submit',id:'r-run',text:'Générer le rapport'})),out);
 run();
}

// ---------- Sources, consentements et imports simulés ----------
async function viewImports(view){
 put(view,loading());let connections;
 try{connections=(await api(`${pBase()}/connections`)).connections;}catch(e){return put(view,stateBox('Sources indisponibles',msg(e),'error'));}
 const byProvider=Object.fromEntries(connections.map(c=>[c.provider,c]));const kind=state.me.actor_kind;
 const ns=Object.fromEntries((await api('/api/v1/metrics')).namespaces.map(n=>[n.namespace,n]));
 const sim=state.connectors.filter(c=>c.status==='simulated'),planned=state.connectors.filter(c=>c.status!=='simulated');
 put(view,h('h2',{text:'Connecteurs simulés'}),h('p',{class:'muted',text:'Fichiers CSV fictifs uniquement. Un import est atomique (tout ou rien) et idempotent : réimporter le même fichier ne crée aucun doublon.'}),
  h('div',{class:'grid'},sim.map(c=>{const con=byProvider[c.provider],active=con?.status==='active',allowed=ns[c.id]?.importer_kinds.includes(kind);const result=h('div',{class:'small',role:'status'});
   const file=h('input',{type:'file',accept:'.csv,text/csv','aria-label':'Fichier CSV pour '+c.label,id:'file-'+c.id});
   const send=async()=>{if(!file.files[0])return put(result,h('p',{class:'error',text:'Choisissez un fichier CSV.'}));put(result,loading());
    try{const r=await api(`${pBase()}/imports/${c.id}`,{method:'POST',type:'text/csv',body:await file.files[0].text()});put(result,h('p',{class:'okmsg',text:`Import terminé : ${r.inserted} observation(s) ajoutée(s), ${r.duplicates} doublon(s) ignoré(s).`}));}
    catch(e){put(result,h('p',{class:'error',text:msg(e)}),e.body?.errors?.length?h('ul',{class:'plain'},e.body.errors.slice(0,20).map(x=>h('li',{text:`${x.row?'Ligne '+x.row:'Fichier'} : ${x.reason}`}))):null);}};
   return h('div',{class:'card','data-connector':c.id},h('h3',{text:c.label}),h('p',{class:'small'},'Connexion : ',h('span',{class:'pill',text:active?'active':con?'révoquée':'jamais autorisée'})),
    can('manage_connections')?h('button',{onclick:async()=>{try{await api(`${pBase()}/connections/${c.provider}`,{method:'PUT',type:'application/json',body:JSON.stringify({status:active?'revoked':'active'})});viewImports(view);}catch(e){alertBox(msg(e));}},text:active?'Révoquer l\'autorisation':'Autoriser cette source'}):null,
    allowed?h('div',{},h('p',{},file),h('button',{class:'primary',disabled:!active,onclick:send,text:'Importer'}),!active?h('p',{class:'small muted',text:'Import impossible tant que le patient n\'a pas autorisé cette source.'}):null,result):h('p',{class:'small muted',text:`Ce profil (${kind}) n'est pas habilité à importer depuis cette source.`}));})),
  h('h2',{text:'Connecteurs réels — interfaces préparées, non configurées'}),h('p',{class:'muted',text:'Aucun accès fournisseur n\'existe dans ce prototype. Les éléments ci-dessous décrivent ce qui est requis avant toute intégration.'}),
  h('div',{class:'grid'},planned.map(c=>h('div',{class:'card'},h('h3',{text:c.label}),h('span',{class:'pill',text:'non configuré'}),h('ul',{class:'plain small'},c.requires.map(r=>h('li',{text:r})))))));
}

// ---------- Journal d'accès ----------
async function viewJournal(view){
 put(view,loading());
 try{const {events}=await api(`${pBase()}/audit?limit=100`);
  if(!events.length)return put(view,stateBox('Journal vide','Aucun accès à ce dossier n\'a encore été enregistré.'));
  put(view,h('p',{class:'muted',text:'Accès à ce dossier, autorisés et refusés (100 derniers). Le journal ne contient aucune valeur de mesure.'}),
   h('div',{class:'tablewrap'},h('table',{id:'audit-table'},h('thead',{},h('tr',{},['Date','Acteur','Événement'].map(t=>h('th',{scope:'col',text:t})))),h('tbody',{},events.map(e=>h('tr',{},h('td',{text:fmtDateTime(e.at)}),h('td',{text:e.actor}),h('td',{class:e.event.startsWith('denied')?'error':'',text:e.event})))))));
 }catch(e){put(view,stateBox('Journal indisponible',msg(e),'error'));}
}
showLogin();
