// Synthetic-only, deterministic, non-clinical longitudinal aggregation.
// Deliberately excludes risk scoring, diagnosis, triage, or clinical alerts.
export const LABELS=Object.freeze({RHR:'Fréquence cardiaque au repos',HRV:'VFC',SLEEP:'Durée de sommeil',STEPS:'Nombre de pas',SPO2:'SpO₂ mesurée par montre',LDL_C:'LDL-cholestérol',HBA1C:'HbA1c',TG:'Triglycérides',CREATININE:'Créatinine',WAIST:'Tour de taille',BFP:'Masse grasse estimée',SBP:'Pression systolique',GRIP:'Force de préhension'});
export const PANELS=Object.freeze([
 {id:'R01',name:'Morphologie, biologie et activité',metrics:['WAIST','BFP','LDL_C','TG','HBA1C','STEPS']},
 {id:'R05',name:'Fonction et activité',metrics:['GRIP','BFP','STEPS']},
 {id:'R07',name:'Sommeil et montre',metrics:['HRV','RHR','SLEEP','STEPS']},
 {id:'R10',name:'Trajectoire multi-source',metrics:['WAIST','SBP','HBA1C','RHR','SLEEP']}
]);
const dateString=/^\d{4}-\d{2}-\d{2}$/;
const ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
function parseTime(s){if(typeof s!=='string'||!ISO.test(s))throw Error('INVALID_TIMESTAMP');const time=Date.parse(s);if(!Number.isFinite(time))throw Error('INVALID_TIMESTAMP');return time;}
const day=t=>new Date(t).toISOString().slice(0,10);
const msDay=86400000;
export const DAILY_SERIES=Object.freeze(['RHR','HRV','SLEEP','STEPS','SPO2']);
function validDate(s){if(!dateString.test(s))return false;const t=Date.parse(s+'T00:00:00Z');return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===s;}
const cleanKey=o=>JSON.stringify([o.metric_code,o.method_code,o.unit,o.source_namespace,o.source_device]);
export function validateInput(records,{labels=LABELS,allowEmpty=false}={}){
 if(!Array.isArray(records)||(records.length===0&&!allowEmpty)||records.length>100000)throw Error('INVALID_OBSERVATIONS');
 let person=null;const ids=new Set();
 for(const o of records){
  if(!o||o.synthetic!==true||typeof o.id!=='string'||!o.id||typeof o.person_id!=='string'||!o.person_id||typeof o.metric_code!=='string'||!Object.hasOwn(labels,o.metric_code)||typeof o.method_code!=='string'||!o.method_code||typeof o.unit!=='string'||!o.unit||typeof o.source_namespace!=='string'||!o.source_namespace||typeof o.source_device!=='string'||!o.source_device||typeof o.value!=='number'||!Number.isFinite(o.value))throw Error('INVALID_OBSERVATION');
  parseTime(o.measured_at);
  if(person===null)person=o.person_id;else if(person!==o.person_id)throw Error('CROSS_PATIENT');
  if(ids.has(o.id))throw Error('DUPLICATE_OBSERVATION');ids.add(o.id);
 }
 return person;
}
function round(n){return Math.round((n+Number.EPSILON)*1000)/1000;}
function windowSummary(rows,start,end,minDays){
 const sample=rows.filter(x=>x.time>=start&&x.time<=end).sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id));
 const count=new Set(sample.map(x=>day(x.time))).size;
 const span=Math.floor((end-start)/msDay)+1;
 return {n:sample.length,observed_days:count,coverage_pct:round(100*count/span),mean:count>=minDays?round(sample.reduce((a,x)=>a+x.value,0)/sample.length):null,ids:sample.map(x=>x.id)};
}
export function buildLiveReport(observations,{start=null,end=null,windowDays=14,minWatchDays=7,labels=LABELS,dailySeries=DAILY_SERIES,personId:expectedPerson=null}={}){
 const found=validateInput(observations,{labels,allowEmpty:expectedPerson!==null});
 if(expectedPerson!==null&&found!==null&&found!==expectedPerson)throw Error('CROSS_PATIENT');
 const personId=found??expectedPerson;
 if(!Number.isInteger(windowDays)||windowDays<7||windowDays>45||!Number.isInteger(minWatchDays)||minWatchDays<1||minWatchDays>windowDays)throw Error('INVALID_WINDOW');
 if(start!==null&&!validDate(start))throw Error('INVALID_RANGE');
 if(end!==null&&!validDate(end))throw Error('INVALID_RANGE');
 if(start!==null&&end!==null&&start>end)throw Error('INVALID_RANGE');
 const selected=observations.filter(o=>{const d=day(parseTime(o.measured_at));return (start===null||d>=start)&&(end===null||d<=end);});
 const cohorts=new Map();
 for(const o of selected){const key=cleanKey(o);if(!cohorts.has(key))cohorts.set(key,[]);cohorts.get(key).push({...o,time:parseTime(o.measured_at)});}
 const comparisons=[],inventory=[];
 for(const key of [...cohorts.keys()].sort()){
  const rows=cohorts.get(key).sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id));
  const [metric_code,method_code,unit,source_namespace,source_device]=JSON.parse(key);
  const first=day(rows[0].time),last=day(rows.at(-1).time);
  const common={metric_code,label:labels[metric_code],method_code,unit,source_namespace,source_device,n:rows.length,first_date:first,last_date:last};
  inventory.push({...common,observation_ids:rows.map(o=>o.id)});
  if(dailySeries.includes(metric_code)){
   const start0=Date.parse(first+'T00:00:00Z'),end0=Date.parse(last+'T00:00:00Z');
   if(end0-start0<(2*windowDays-1)*msDay){comparisons.push({...common,status:'insufficient_separation',reason:'Two non-overlapping windows unavailable'});continue;}
   const before=windowSummary(rows,start0,start0+(windowDays-1)*msDay+msDay-1,minWatchDays);
   const after=windowSummary(rows,end0-(windowDays-1)*msDay,end0+msDay-1,minWatchDays);
   if(before.mean===null||after.mean===null){comparisons.push({...common,status:'insufficient_coverage',before,after,reason:'Insufficient distinct days of measurements'});continue;}
   comparisons.push({...common,status:'descriptive_comparison',statistic:'arithmetic_mean',before,after,delta:round(after.mean-before.mean)});
  }else if(rows.length>=2&&first!==last){
   const a=rows[0],b=rows.at(-1);
   comparisons.push({...common,status:'descriptive_comparison',statistic:'first_last_single_measurements',before:{value:a.value,date:a.measured_at,ids:[a.id]},after:{value:b.value,date:b.measured_at,ids:[b.id]},delta:round(b.value-a.value),limitation:'Two punctual observations do not establish a clinical trend.'});
  }else comparisons.push({...common,status:'single_observation',reason:'No comparable observations at distinct dates'});
 }
 const present=new Set(inventory.map(x=>x.metric_code));
 const panels=PANELS.map(p=>({...p,available_metrics:p.metrics.filter(m=>present.has(m)),missing_metrics:p.metrics.filter(m=>!present.has(m))}));
 return {schema_version:'3.0',synthetic:true,person_id:personId,generated_at:null,filters:{start,end,windowDays,minWatchDays},observations_considered:selected.length,inventory,comparisons,cross_domain_panels:panels,limitations:['Descriptive display only; no diagnosis, automated alert, triage or risk score.','No causal inference from coincident changes.','Device, source, unit and method remain separate.','No interpolation for missing dates.','Calendar days use UTC, not the patient timezone.','Window means weight each sample equally, not each day.','Consumer wearable data are not clinical-grade measurements.']};
}
export function verifyReferences(report,records){const ids=new Set(records.map(o=>o.id));for(const c of report.comparisons)for(const field of ['before','after'])for(const id of c[field]?.ids||[])if(!ids.has(id))throw Error('UNRESOLVED_REFERENCE');return true;}
export function reportToMarkdown(report){const esc=v=>String(v).replaceAll('|','\\|').replaceAll('\n',' ');const out=['# Synthèse longitudinale descriptive — démonstration','', '> Données entièrement fictives. Aucune interprétation médicale.','',`Observations examinées : ${report.observations_considered}`, '', '| Mesure | Première | Dernière | Différence | Provenance |','|---|---:|---:|---:|---|'];for(const c of report.comparisons){if(c.status!=='descriptive_comparison')continue;const a=c.before.mean??c.before.value,b=c.after.mean??c.after.value;out.push(`| ${esc(c.label)} | ${a} ${esc(c.unit)} | ${b} ${esc(c.unit)} | ${c.delta>=0?'+':''}${c.delta} ${esc(c.unit)} | ${esc(c.source_namespace)} / ${esc(c.method_code)} |`);}out.push('','## Références');for(const c of report.comparisons){if(c.status==='descriptive_comparison')out.push(`- ${c.metric_code}: ${[...c.before.ids,...c.after.ids].join(', ')}`);}out.push('','## Limites',...report.limitations.map(x=>'- '+x));return out.join('\n')+'\n';}
