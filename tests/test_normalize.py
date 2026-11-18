import copy,json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from normalize_demo import convert
ROOT=Path(__file__).resolve().parents[1]
FIXTURE=json.loads((ROOT/'fixtures/demo_v1.2.json').read_text(encoding='utf-8'))
class TestContract(unittest.TestCase):
 def test_refuses_nonsynthetic(self):
  p=copy.deepcopy(FIXTURE);p['synthetic']=False
  with self.assertRaisesRegex(ValueError,'Refusing'):convert(p)
 def test_hrv_method_explicit(self):
  rows=convert(FIXTURE)
  h=[x for x in rows if x['metric_code']=='HRV']
  self.assertEqual(len(h),84) # six deliberately missing days
  self.assertEqual({x['method_code'] for x in h},{'SDNN'})
 def test_no_mix_if_rmssd_is_added(self):
  p=copy.deepcopy(FIXTURE);p['watch'][0]['hrv_metric']='RMSSD'
  rows=convert(p);h={x['method_code'] for x in rows if x['metric_code']=='HRV'}
  self.assertEqual(h,{'SDNN','RMSSD'})
 def test_unknown_hrv_refused(self):
  p=copy.deepcopy(FIXTURE);p['watch'][0]['hrv_metric']='HRV'
  with self.assertRaisesRegex(ValueError,'HRV method ambiguous'):convert(p)
 def test_duplicate_source_prevented(self):
  p=copy.deepcopy(FIXTURE);p['watch'].append(copy.deepcopy(p['watch'][0]))
  with self.assertRaisesRegex(ValueError,'duplicate'):convert(p)
 def test_nonmapped_lab_refused(self):
  p=copy.deepcopy(FIXTURE);p['lab'][0]['code']='UNKNOWN'
  with self.assertRaisesRegex(ValueError,'Unmapped'):convert(p)
 def test_deterministic_ids(self):
  a=convert(FIXTURE);b=convert(FIXTURE)
  self.assertEqual(a,b)
 def test_expected_count(self):
  rows=convert(FIXTURE)
  self.assertEqual(len(rows),379) # 4 x 84 plus 28 SpO2, 7 lab, 8 center
 def test_spo2_out_of_range(self):
  p=copy.deepcopy(FIXTURE);p['watch'][0]['spo2_percent']=110
  with self.assertRaisesRegex(ValueError,'SpO2'):convert(p)
if __name__=='__main__':unittest.main()
