#!/usr/bin/env python3
"""Normalize bundled synthetic V1.2 data into V1.3 descriptive observations.
This CLI intentionally refuses any dataset other than the packaged fixture.
No network, DB access, clinical scoring, or personal data processing.
"""
from __future__ import annotations
import argparse,hashlib,json,uuid
from datetime import date,datetime,time,timezone
from pathlib import Path

PATIENT_ID = str(uuid.uuid5(uuid.NAMESPACE_URL,'hc-demo-patient-001'))
NAMESPACE=uuid.UUID('00000000-0000-5000-8000-000000000013')
FIELDS={'heart_rate_rest_bpm':('RHR','wearable_resting_hr','bpm'),
        'hrv_ms':('HRV',None,'ms'),
        'sleep_hours':('SLEEP_DURATION','daily_total','h'),
        'steps':('STEPS','daily_total','count'),
        'spo2_percent':('SPO2','wearable_spot','%')}
LAB={'LDL_C':('LDL','g/L'), 'TG':('TRIGLYCERIDES','g/L'),
     'HBA1C':('HBA1C','%'), 'EGFR':('EGFR','mL/min/1,73 m²')}
CENTER={'WAIST':('WAIST','cm'),'BFP':('BODY_FAT','%'),
        'GRIP':('GRIP','kg'),'SBP':('BP_SYSTOLIC','mmHg')}

def utc_midnight(d:str)->str:
    date.fromisoformat(d)
    return d+'T00:00:00Z'

def datum(metric, method, value, unit, day, namespace, rid,device=None):
    if value is None: return None
    if isinstance(value,bool) or not isinstance(value,(int,float)): raise ValueError('numeric value required')
    if metric == 'HRV' and method not in ('RMSSD','SDNN'): raise ValueError('HRV method ambiguous')
    if metric=='SPO2' and not (0<=value<=100):raise ValueError('invalid SpO2 range')
    if metric=='STEPS' and value<0:raise ValueError('negative steps')
    unique=f'{namespace}|{rid}|{metric}|{method}'
    return {'id':str(uuid.uuid5(NAMESPACE,unique)),'person_id':PATIENT_ID,
      'metric_code':metric,'method_code':method,'value':value,'unit':unit,
      'measured_at':utc_midnight(day),'interval_end_at':None,
      'source_namespace':namespace,'source_record_id':unique,
      'source_device':device,'synthetic':True,'quality_state':'unreviewed'}

def convert(payload):
    if payload.get('synthetic') is not True or payload.get('dataset_id') != 'DEMO-SYNTH-001':
        raise ValueError('Refusing non-bundled/real dataset')
    rows=[]
    for day in payload['watch']:
        for field,(code,method,unit) in FIELDS.items():
            if field not in day or day[field] is None:continue
            if field=='hrv_ms':method=day.get('hrv_metric')
            r=datum(code,method,day[field],unit,day['date'],'demo_watch',f"{day['date']}:{field}",day.get('source'))
            rows.append(r)
    for scope,map_,namespace in [('lab',LAB,'demo_lab'),('center',CENTER,'demo_center')]:
        for entry in payload[scope]:
            key=entry['code']
            if key not in map_:
                # We refuse silent loss of unknown codes; extend the registry first.
                raise ValueError(f'Unmapped metric {scope}:{key}')
            code,expected=map_[key]
            if entry['unit'] != expected:raise ValueError(f'Unknown unit {key}:{entry["unit"]}')
            r=datum(code,entry.get('method','unspecified'),entry['value'],expected,entry['date'],namespace,entry['id'],entry.get('source'))
            rows.append(r)
    ids=[(r['source_namespace'],r['source_record_id']) for r in rows]
    if len(ids)!=len(set(ids)):raise ValueError('duplicate source IDs')
    return sorted(rows,key=lambda r:(r['measured_at'],r['source_namespace'],r['source_record_id']))

def main():
    ap=argparse.ArgumentParser();ap.add_argument('fixture',type=Path);ap.add_argument('output',type=Path);args=ap.parse_args()
    payload=json.loads(args.fixture.read_text(encoding='utf-8'))
    rows=convert(payload)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps({'schema_version':'1.3','synthetic':True,'person_id':PATIENT_ID,
      'observations':rows},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'Normalized {len(rows)} synthetic observations into {args.output}')
if __name__=='__main__':main()
