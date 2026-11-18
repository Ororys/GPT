import copy
import importlib.util
import unittest
from pathlib import Path

MODULE=Path(__file__).resolve().parents[1]/"longitudinal"/"report.py"
spec=importlib.util.spec_from_file_location("longreport",MODULE)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)


def ob(code, method, value, day, ident, *, patient="p", device="Demo X", unit="ms"):
    return {"id":ident,"person_id":patient,"metric_code":code,"method_code":method,"value":value,
            "unit":unit,"measured_at":f"2026-01-{day:02d}T12:00:00Z","source_namespace":"watch-demo",
            "source_device":device,"synthetic":True}

class TestLongitudinal(unittest.TestCase):
    def test_trend_windows_separated(self):
        r=[ob("HRV","SDNN",float(20+i),i,"id"+str(i)) for i in range(1,32)]
        c=m.create_report(r)["comparisons"][0]
        self.assertEqual(c["status"],"descriptive_comparison")
        self.assertEqual(c["before"]["observed_days"],14)
        self.assertEqual(c["after"]["observed_days"],14)
        self.assertEqual(len(set(c["before"]["ids"]) & set(c["after"]["ids"])),0)
    def test_sdnn_rmssd_separate(self):
        r=[ob("HRV","SDNN",20,i,"sdnn"+str(i)) for i in range(1,32)]
        r += [ob("HRV","RMSSD",30,i,"rmssd"+str(i)) for i in range(1,32)]
        self.assertEqual(len(m.create_report(r)["comparisons"]),2)
    def test_device_split(self):
        a=ob("HRV","SDNN",20,1,"a");b=ob("HRV","SDNN",20,2,"b",device="Other X")
        self.assertEqual(len(m.create_report([a,b])["comparisons"]),2)
    def test_lack_of_coverage(self):
        r=[ob("HRV","SDNN",20,1,"a"),ob("HRV","SDNN",30,31,"b")]
        self.assertEqual(m.create_report(r)["comparisons"][0]["status"],"insufficient_coverage")
    def test_cross_patient_forbidden(self):
        with self.assertRaisesRegex(ValueError,"Cross-patient"):
            m.create_report([ob("HRV","SDNN",20,1,"a"),ob("HRV","SDNN",20,2,"b",patient="other")])
    def test_real_data_forbidden(self):
        r=ob("HRV","SDNN",20,1,"a");r["synthetic"]=False
        with self.assertRaisesRegex(ValueError,"Real personal"):
            m.create_report([r])
    def test_duplicate_ids_forbidden(self):
        r=ob("HRV","SDNN",20,1,"a")
        with self.assertRaisesRegex(ValueError,"Duplicate observation"):
            m.create_report([r,copy.deepcopy(r)])
    def test_same_code_different_unit_not_merged(self):
        a=ob("HRV","SDNN",20,1,"a");b=ob("HRV","SDNN",20,2,"b",unit="beats")
        self.assertEqual(len(m.create_report([a,b])["comparisons"]),2)
    def test_single_biology(self):
        r=ob("HBA1C","lab_hplc",5.6,1,"a",unit="%")
        self.assertEqual(m.create_report([r])["comparisons"][0]["status"],"single_observation")
    def test_biology_two_dates(self):
        r=[ob("HBA1C","lab_hplc",5.6,1,"a",unit="%"),ob("HBA1C","lab_hplc",5.5,31,"b",unit="%")]
        self.assertAlmostEqual(m.create_report(r)["comparisons"][0]["delta"],-0.1)
    def test_provenance_in_markdown(self):
        r=[ob("HBA1C","lab_hplc",5.6,1,"sourceA",unit="%"),ob("HBA1C","lab_hplc",5.5,31,"sourceB",unit="%")]
        md=m.render_markdown(m.create_report(r))
        self.assertIn("sourceA",md);self.assertIn("sourceB",md)

if __name__=="__main__": unittest.main()
