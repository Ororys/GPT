import csv,importlib.util,json,subprocess,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('csv_pipeline',ROOT/'importers'/'csv_pipeline.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
P='synthetic-patient'
ROW={'record_id':'r1','timestamp':'2026-11-15T12:00:00+04:00','metric_code':'HRV',
     'method_code':'SDNN','value':'45','unit':'ms','source_device':'DemoWatch synthetic'}
class TestCSV(unittest.TestCase):
 def test_normalized_utc(self):
  result,errors,_=m.convert([ROW],'demo_watch_csv',P,allowed_source={'demo_watch_csv'})
  self.assertFalse(errors);self.assertEqual(result[0]['measured_at'],'2026-11-15T08:00:00Z')
 def test_unit_reject(self):
  _,errors,_=m.convert([{**ROW,'unit':'bpm'}],'demo_watch_csv',P,allowed_source={'demo_watch_csv'})
  self.assertEqual(len(errors),1)
 def test_method_reject(self):
  _,errors,_=m.convert([{**ROW,'method_code':'unknown'}],'demo_watch_csv',P,allowed_source={'demo_watch_csv'})
  self.assertEqual(len(errors),1)
 def test_hrv_not_merged(self):
  b={**ROW,'record_id':'r2','method_code':'RMSSD'}
  data,_,_=m.convert([ROW,b],'demo_watch_csv',P,allowed_source={'demo_watch_csv'})
  self.assertEqual(len(data),2)
  self.assertEqual(len(m.quality_report(data,[])['by_metric_method_and_source']),2)
 def test_duplicate_idempotent(self):
  data,_,counts=m.convert([ROW,ROW],'demo_watch_csv',P,allowed_source={'demo_watch_csv'})
  self.assertEqual(len(data),1);self.assertEqual(counts['duplicate_input'],1)
 def test_deterministic_id(self):
  a,_,_=m.convert([ROW],'demo_watch_csv',P,allowed_source={'demo_watch_csv'})
  b,_,_=m.convert([ROW],'demo_watch_csv',P,allowed_source={'demo_watch_csv'})
  self.assertEqual(a[0]['id'],b[0]['id'])
 def test_invalid_values(self):
  for value in ['NaN','inf','-1','999999']:
   _,errors,_=m.convert([{**ROW,'value':value}],'demo_watch_csv',P,allowed_source={'demo_watch_csv'})
   self.assertEqual(len(errors),1)
 def test_missing_timezone(self):
  _,errors,_=m.convert([{**ROW,'timestamp':'2026-11-15T12:00:00'}],'demo_watch_csv',P,allowed_source={'demo_watch_csv'})
  self.assertEqual(len(errors),1)
 def test_unknown_metric(self):
  _,errors,_=m.convert([{**ROW,'metric_code':'CANCER_RISK'}],'demo_watch_csv',P,allowed_source={'demo_watch_csv'})
  self.assertEqual(len(errors),1)
 def test_source_whitelist(self):
  with self.assertRaises(ValueError):m.convert([ROW],'external_live',P,allowed_source={'demo_watch_csv'})
 def test_real_fixture(self):
  watch=m.load_csv(ROOT/'fixtures'/'csv'/'watch_demo.csv')
  lab=m.load_csv(ROOT/'fixtures'/'csv'/'lab_demo.csv')
  a,ae,_=m.convert(watch,'demo_watch_csv',P,allowed_source={'demo_watch_csv'})
  b,be,_=m.convert(lab,'demo_lab_csv',P,allowed_source={'demo_lab_csv'})
  self.assertFalse(ae+be);self.assertGreater(len(a),300);self.assertGreater(len(b),0)
  self.assertEqual(m.quality_report(a+b,[])['rejected_rows'],0)
if __name__=='__main__':unittest.main()
