"""Viewer v1.9 integrity checks (synthetic fixtures only)."""
import json, pathlib, re, unittest
from html.parser import HTMLParser
ROOT=pathlib.Path(__file__).resolve().parents[1]

class EmbeddedData(HTMLParser):
    def __init__(self): super().__init__(); self.current=None;self.data={}
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if tag=='script' and attrs.get('id') in ('report-data','obs-data'):
            self.current=attrs['id'];self.data[self.current]=''
    def handle_data(self,data):
        if self.current:self.data[self.current]+=data
    def handle_endtag(self,tag):
        if tag=='script': self.current=None

class ViewerFixtureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.path=ROOT/'viewer/HealthConvergence_v1.9.html'
        cls.source=cls.path.read_text(encoding='utf-8')
        parser=EmbeddedData();parser.feed(cls.source)
        cls.report=json.loads(parser.data['report-data']);cls.obs=json.loads(parser.data['obs-data'])
    def test_demo_only(self):
        self.assertTrue(self.report['synthetic']);self.assertTrue(all(o['synthetic'] for o in self.obs))
        self.assertEqual(len(self.obs),378)
    def test_no_duplicate_ids(self):
        ids=[o['id'] for o in self.obs];self.assertEqual(len(ids),len(set(ids)))
    def test_report_references_resolve(self):
        ids={o['id'] for o in self.obs}
        references={ident for c in self.report['comparisons'] for period in ('before','after') for ident in (c.get(period) or {}).get('ids',[])}
        self.assertEqual(len(references),123)
        self.assertTrue(references<=ids)
    def test_metric_consistency(self):
        self.assertTrue(all(o['person_id']==self.report['person_id'] for o in self.obs))
        self.assertEqual(len(self.report['comparisons']),12)
        self.assertEqual(sum(c['status']=='descriptive_comparison' for c in self.report['comparisons']),11)
    def test_no_external_dependencies(self):
        self.assertNotIn('https://',self.source)
        self.assertNotIn('src="http',self.source)
        self.assertIn('default-src \'none\'',self.source)
    def test_methods_not_mixed(self):
        for c in self.report['comparisons']:
            for period in ('before','after'):
                for oid in (c.get(period) or {}).get('ids',[]):
                    o=next(x for x in self.obs if x['id']==oid)
                    self.assertEqual(o['method_code'],c['method_code'])
                    self.assertEqual(o['unit'],c['unit'])
                    self.assertEqual(o['source_namespace'],c['source_namespace'])
if __name__=='__main__':unittest.main()
