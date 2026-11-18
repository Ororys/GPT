// Tests unitaires sans base : jetons, connecteur CSV, moteur descriptif.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mintDemoToken,verifyDemoToken} from '../src/token.mjs';
import {parseCsv,csvToRecords} from '../src/connectors/csv.mjs';
import {CONNECTORS,publicConnectors} from '../src/connectors/index.mjs';
import {buildLiveReport} from '../src/live-report.mjs';
const secret='unit-test-secret-of-at-least-32-bytes-long';
test('jeton : seul le sujet est retenu ; entrées hostiles → UNAUTHENTICATED (jamais une autre erreur)',()=>{
 const t=mintDemoToken('patient-demo',{secret,now:1000});assert.deepEqual(verifyDemoToken(t,{secret,now:1001}),{subject:'patient-demo'});
 const forged=[Buffer.from('{"typ":"JWT","alg":"HS256"}').toString('base64url'),Buffer.from(JSON.stringify({sub:'founder-demo',role:'physician',person:'x',iss:'hc-demo',aud:'hc-synthetic-api',iat:1000,exp:1900})).toString('base64url'),'AAAA'].join('.');
 for(const bad of [forged,'a.b.c','e30.e30.e30','bnVsbA.bnVsbA.bnVsbA','W10.W10.W10',t+'.x',t.replace(/\.[^.]+$/,'.'),'',null,undefined,42,'é.é.é'])assert.throws(()=>verifyDemoToken(bad,{secret,now:1001}),{message:'UNAUTHENTICATED'},String(bad));
 assert.throws(()=>verifyDemoToken(t,{secret,now:1901}),{message:'UNAUTHENTICATED'});
 assert.throws(()=>verifyDemoToken(t,{secret:'short'}),{message:'SERVER_MISCONFIGURED'});
});
test('CSV : guillemets, virgules, BOM, CRLF, lignes vides, colonnes manquantes',()=>{
 assert.deepEqual(parseCsv('﻿a,b\r\n"x, ""y""",2\r\n\r\n3,4'),[['a','b'],['x, "y"','2'],['3','4']]);
 assert.throws(()=>parseCsv('a,b\n"open,2'),/CSV_UNTERMINATED_QUOTE/);
 const head='record_id,timestamp,metric_code,method_code,value,unit,source_device\n';
 const ok=csvToRecords(head+' r1 ,2026-01-01T00:00:00Z,RHR,wearable_resting_hr,60.5,bpm,Montre\n');
 assert.deepEqual(ok,{records:[{source_record_id:'r1',metric_code:'RHR',method_code:'wearable_resting_hr',value:60.5,unit:'bpm',measured_at:'2026-01-01T00:00:00Z',interval_end_at:null,source_device:'Montre'}],errors:[]});
 assert.deepEqual(csvToRecords(head+'r1,t,RHR,m,1e3,bpm,d\nr2,t,RHR,m,,bpm,d\nr3,t\n').errors.map(e=>[e.row,e.reason]),[[2,'VALUE_NOT_NUMERIC'],[3,'VALUE_NOT_NUMERIC'],[4,'COLUMN_COUNT']]);
 assert.equal(csvToRecords('').errors[0].reason,'EMPTY_FILE');assert.match(csvToRecords('a,b\n1,2').errors[0].reason,/MISSING_COLUMNS/);
 const demo=csvToRecords(readFileSync(new URL('../fixtures/csv/watch_demo.csv',import.meta.url),'utf8'));assert.equal(demo.records.length,364);assert.equal(demo.errors.length,0);
});
test('connecteurs réels : interfaces déclarées, jamais exécutables ; SDNN (HealthKit) ≠ RMSSD (Health Connect)',()=>{
 for(const id of ['apple_healthkit','android_health_connect','lab_hl7_fhir']){assert.equal(CONNECTORS[id].status,'not_configured');assert.throws(()=>CONNECTORS[id].parse('x'),/CONNECTOR_NOT_CONFIGURED/);assert.ok(CONNECTORS[id].requires.length>=3);}
 assert.equal(CONNECTORS.apple_healthkit.mapping.find(m=>m.metric==='HRV').method,'SDNN');assert.equal(CONNECTORS.android_health_connect.mapping.find(m=>m.metric==='HRV').method,'RMSSD');
 assert.ok(publicConnectors().every(c=>!('parse' in c)));
});
test('moteur : dates calendaires invalides refusées, dossier vide accepté avec personne explicite',()=>{
 const data=JSON.parse(readFileSync(new URL('../fixtures/report_api_observations_v2.0.json',import.meta.url))).observations;
 assert.throws(()=>buildLiveReport(data,{start:'2026-02-31'}),/INVALID_RANGE/);assert.throws(()=>buildLiveReport(data,{end:'2026-13-01'}),/INVALID_RANGE/);
 assert.throws(()=>buildLiveReport([]),/INVALID_OBSERVATIONS/);
 const empty=buildLiveReport([],{personId:'p'});assert.equal(empty.observations_considered,0);assert.equal(empty.person_id,'p');
 assert.throws(()=>buildLiveReport(data,{personId:'someone-else'}),/CROSS_PATIENT/);
 assert.equal(JSON.stringify(buildLiveReport(data)),JSON.stringify(buildLiveReport([...data].reverse())),'résultat indépendant de l\'ordre d\'entrée');
 // Une lacune au milieu de la série ne produit ni valeur ni comparaison inventée (T06).
 const sparse=data.filter(o=>o.metric_code==='RHR').filter((_,i)=>i<3||i>80);
 assert.equal(buildLiveReport(sparse).comparisons[0].status,'insufficient_coverage');
});
