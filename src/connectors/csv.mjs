// Connecteurs SIMULÉS (CSV synthétique). Le connecteur ne fait que la validation STRUCTURELLE ;
// la validation sémantique (métrique, méthode, unité, bornes, horodatage) est faite en base, à un seul endroit.
const COLUMNS=['record_id','timestamp','metric_code','method_code','value','unit','source_device'];
export function parseCsv(text){
 if(text.charCodeAt(0)===0xFEFF)text=text.slice(1);
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else quoted=false;}else field+=c;}
  else if(c==='"'&&field==='')quoted=true;
  else if(c===','){row.push(field);field='';}
  else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);field='';if(row.length>1||row[0]!=='')rows.push(row);row=[];}
  else field+=c;}
 if(quoted)throw Error('CSV_UNTERMINATED_QUOTE');
 if(field!==''||row.length){row.push(field);rows.push(row);}
 return rows;
}
/** @returns {{records:object[],errors:{row:number,reason:string}[]}} */
export function csvToRecords(text){
 if(typeof text!=='string'||text.length===0)return {records:[],errors:[{row:1,reason:'EMPTY_FILE'}]};
 let rows;try{rows=parseCsv(text);}catch(e){return {records:[],errors:[{row:1,reason:e.message}]};}
 if(!rows.length)return {records:[],errors:[{row:1,reason:'EMPTY_FILE'}]};
 const header=rows[0].map(h=>h.trim());const missing=COLUMNS.filter(c=>!header.includes(c));
 if(missing.length)return {records:[],errors:[{row:1,reason:'MISSING_COLUMNS: '+missing.join(',')}]};
 const idx=Object.fromEntries(COLUMNS.map(c=>[c,header.indexOf(c)]));const records=[],errors=[];
 rows.slice(1).forEach((r,n)=>{const line=n+2;const get=c=>(r[idx[c]]??'').trim();
  if(r.length!==header.length)return errors.push({row:line,reason:'COLUMN_COUNT'});
  const raw=get('value');
  if(!/^-?\d+(\.\d+)?$/.test(raw))return errors.push({row:line,reason:'VALUE_NOT_NUMERIC'});
  records.push({source_record_id:get('record_id'),metric_code:get('metric_code'),method_code:get('method_code'),value:Number(raw),unit:get('unit'),measured_at:get('timestamp'),interval_end_at:null,source_device:get('source_device')});});
 return {records,errors};
}
