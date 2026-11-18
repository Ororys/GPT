import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildLiveReport,verifyReferences,reportToMarkdown} from '../src/live-report.mjs';
const d=JSON.parse(readFileSync(new URL('../fixtures/report_api_observations_v2.0.json',import.meta.url)));
const data=d.observations;
test('live report rebuilds from 378 synthetic observations with provenance',()=>{
 const r=buildLiveReport(data);assert.equal(r.observations_considered,378);assert.equal(r.comparisons.length,12);assert.equal(r.comparisons.filter(c=>c.status==='descriptive_comparison').length,11);assert.equal(verifyReferences(r,data),true);
 const spo=r.comparisons.find(c=>c.metric_code==='SPO2');assert.equal(spo.status,'insufficient_coverage');
 assert.match(reportToMarkdown(r),/Synthèse longitudinale/);assert.ok(r.cross_domain_panels.some(x=>x.id==='R07'));
});
test('date filtering, bounded ranges, and missing reference behavior',()=>{
 const r=buildLiveReport(data,{start:'2026-10-01',end:'2026-11-15'});
 assert.ok(r.observations_considered<378);assert.equal(r.filters.start,'2026-10-01');
 assert.throws(()=>buildLiveReport(data,{start:'2026-12-01',end:'2026-01-01'}),/INVALID_RANGE/);
 assert.throws(()=>buildLiveReport(data,{windowDays:100}),/INVALID_WINDOW/);
 assert.throws(()=>verifyReferences({comparisons:[{before:{ids:['not-found']}}]},data),/UNRESOLVED_REFERENCE/);
});
test('person isolation, duplicate ids, unknown metrics, non synthetic, timestamp sanity',()=>{
 const copy=structuredClone(data);copy[0].person_id='other';assert.throws(()=>buildLiveReport(copy),/CROSS_PATIENT/);
 assert.throws(()=>buildLiveReport([...data,data[0]]),/DUPLICATE_OBSERVATION/);
 const bad=structuredClone(data);bad[0].metric_code='FAKE';assert.throws(()=>buildLiveReport(bad),/INVALID_OBSERVATION/);
 const raw=structuredClone(data);raw[0].synthetic=false;assert.throws(()=>buildLiveReport(raw),/INVALID_OBSERVATION/);
 const d2=structuredClone(data);d2[0].measured_at='bad';assert.throws(()=>buildLiveReport(d2),/INVALID_TIMESTAMP/);
});
test('does not group HRV methods or sources',()=>{
 const h=data.filter(x=>x.metric_code==='HRV');const add=structuredClone(h[0]);add.id='demo-alternative-method';add.method_code='wearable_hrv_rmssd';
 const r=buildLiveReport([...data,add]);assert.equal(r.inventory.filter(x=>x.metric_code==='HRV').length,2);
});
