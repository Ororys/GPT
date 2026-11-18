"""Only for synthetic demonstration datasets, not production health data.
CLI: python importers/csv_pipeline.py --wearable ... --lab ... --out ...
Validation fail-closed; unknown metrics or units rejected; no medical interpretation.
"""
import argparse,csv,datetime,hashlib,json,math,uuid
from collections import Counter,defaultdict
from pathlib import Path

NAMESPACE=uuid.UUID('bd9d6072-73f2-4348-ac4d-f3d8ec26cba8')
# Canonical internal codes/methods. No inferred unit conversion or medical thresholds.
METRICS={
 'RHR': {'unit':'bpm','methods':{'wearable_resting_hr'},'min':1,'max':250},
 'HRV': {'unit':'ms','methods':{'SDNN','RMSSD'},'min':0.01,'max':1000},
 'SLEEP': {'unit':'h','methods':{'wearable_sleep_duration'},'min':0,'max':24},
 'STEPS': {'unit':'steps','methods':{'wearable_step_count'},'min':0,'max':150000},
 'SPO2': {'unit':'%','methods':{'wearable_spo2'},'min':1,'max':100},
 'LDL_C': {'unit':'g/L','methods':{'lab_reported','calculated_friedewald'},'min':0,'max':20},
 'HBA1C': {'unit':'%','methods':{'lab_hplc','lab_reported'},'min':0,'max':25},
 'TG': {'unit':'g/L','methods':{'lab_reported'},'min':0,'max':50},
 'CREATININE': {'unit':'mg/L','methods':{'lab_reported'},'min':0,'max':1000},
}
FIELDS={'record_id','timestamp','metric_code','method_code','value','unit','source_device'}

def parse_iso(value):
    try:
        parsed=datetime.datetime.fromisoformat(value.replace('Z','+00:00'))
        if parsed.tzinfo is None: raise ValueError('timezone required')
        return parsed.astimezone(datetime.timezone.utc).isoformat().replace('+00:00','Z')
    except (ValueError,AttributeError): raise ValueError('timestamp must be ISO-8601 with offset')

def convert(rows, source_namespace, person_id, *, allowed_source):
    if source_namespace not in allowed_source: raise ValueError('unapproved source namespace')
    items=[];errors=[];seen=set();counts=Counter()
    for n,row in enumerate(rows, start=2):
        try:
            missing=FIELDS-set(row)
            if missing:raise ValueError('columns missing: '+','.join(sorted(missing)))
            record_id=row['record_id'].strip()
            if not record_id:raise ValueError('empty record_id')
            code=row['metric_code'].strip()
            if code not in METRICS:raise ValueError('unknown metric: '+code)
            spec=METRICS[code];method=row['method_code'].strip();unit=row['unit'].strip()
            if method not in spec['methods']:raise ValueError('unapproved measurement method')
            if unit!=spec['unit']:raise ValueError('unit mismatch; no silent conversion')
            stamp=parse_iso(row['timestamp'].strip())
            val=float(row['value'])
            if not math.isfinite(val) or not spec['min'] <= val <= spec['max']:raise ValueError('invalid numeric value')
            if code=='STEPS' and val!=int(val):raise ValueError('steps must be integer')
            source_device=row['source_device'].strip()
            if not source_device:raise ValueError('missing device provenance')
            key=(source_namespace,record_id,code,method)
            if key in seen:
                counts['duplicate_input']+=1;continue
            seen.add(key)
            stable_id=str(uuid.uuid5(NAMESPACE,'|'.join(key)))
            items.append({'id':stable_id,'person_id':person_id,'metric_code':code,'method_code':method,
                'value':val,'unit':unit,'measured_at':stamp,'interval_end_at':None,
                'source_namespace':source_namespace,'source_record_id':'|'.join(key),'source_device':source_device,
                'synthetic':True,'quality_state':'unreviewed'})
            counts[code]+=1
        except (ValueError,TypeError,OverflowError) as exc:
            errors.append({'row':n,'reason':str(exc)})
    return items,errors,dict(counts)

def load_csv(path):
    with open(path,newline='',encoding='utf-8-sig') as f:return list(csv.DictReader(f))

def quality_report(items,errors):
    # Coverage is a property of the data, not a patient health score.
    by_metric=defaultdict(list)
    for row in items:by_metric[(row['metric_code'],row['method_code'],row['source_namespace'])].append(row)
    metrics=[]
    for (code,method,source),rows in sorted(by_metric.items()):
        days={r['measured_at'][:10] for r in rows}
        start=min(days);end=max(days)
        span=(datetime.date.fromisoformat(end)-datetime.date.fromisoformat(start)).days+1
        metrics.append({'metric_code':code,'method_code':method,'source_namespace':source,
                        'observation_count':len(rows),'observed_days':len(days),
                        'calendar_span_days':span,'coverage_pct':round(100*len(days)/span,1),
                        'start':start,'end':end})
    return {'synthetic':True,'observation_count':len(items),'rejected_rows':len(errors),
            'by_metric_method_and_source':metrics,
            'restrictions':['coverage is not a health score','SDNN and RMSSD must never be merged',
                            'watch SpO2 must not be used to diagnose disease',
                            'no automated medical risk classification']}

def main():
    p=argparse.ArgumentParser();p.add_argument('--wearable',required=True);p.add_argument('--lab',required=True)
    p.add_argument('--out',required=True);a=p.parse_args()
    person_id='5a73bb9c-742f-5663-afba-549d057ff4a6'
    watch,ew,cw=convert(load_csv(a.wearable),'demo_watch_csv',person_id,allowed_source={'demo_watch_csv'})
    lab,el,cl=convert(load_csv(a.lab),'demo_lab_csv',person_id,allowed_source={'demo_lab_csv'})
    observations=watch+lab; errors=[{'source':'watch',**e} for e in ew]+[{'source':'lab',**e} for e in el]
    output={'schema_version':'1.7','synthetic':True,'person_id':person_id,
            'observations':observations,'rejections':errors,'quality_report':quality_report(observations,errors)}
    Path(a.out).parent.mkdir(parents=True,exist_ok=True)
    Path(a.out).write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'accepted':len(observations),'rejected':len(errors),'by_source':{'watch':cw,'lab':cl}},ensure_ascii=False))
    if errors:raise SystemExit(2)
if __name__=='__main__':main()
