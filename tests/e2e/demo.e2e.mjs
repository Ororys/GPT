// Tests E2E navigateur (Chromium via Playwright) : interface réelle → API réelle → PostgreSQL réel.
// HC_E2E_CHANNEL=chrome utilise le Chrome installé ; sinon le Chromium de Playwright (npx playwright install chromium).
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {createTestDatabase} from '../helpers/pg.mjs';
import {PgRepository} from '../../src/pg-repository.mjs';
import {createApp} from '../../src/app.mjs';
let db,app,base,browser;const allowedHosts=[];const problems=[];
const shots=new URL('../../test-results/',import.meta.url).pathname;
before(async()=>{
 mkdirSync(shots,{recursive:true});db=await createTestDatabase();
 app=createApp({repo:new PgRepository(db.api),secret:'e2e-secret-0123456789-abcdefghijklmnop',demoLogin:true,allowedHosts,webDir:new URL('../../web',import.meta.url).pathname});
 await new Promise(r=>app.listen(0,'127.0.0.1',r));allowedHosts.push('127.0.0.1:'+app.address().port);base='http://127.0.0.1:'+app.address().port;
 browser=await chromium.launch({channel:process.env.HC_E2E_CHANNEL||undefined,args:['--no-sandbox']});
});
after(async()=>{await browser?.close();await new Promise(r=>app.close(r));await db.drop();});
async function open(persona,viewport={width:1280,height:900}){
 const page=await browser.newPage({viewport});
 page.on('console',m=>{if(m.type()==='error'&&!/status of 4\d\d/.test(m.text()))problems.push(m.text());});page.on('pageerror',e=>problems.push(String(e)));
 await page.goto(base+'/');await page.getByRole('heading',{name:'Connexion de démonstration'}).waitFor();
 if(persona){await page.getByRole('button',{name:new RegExp('^'+persona)}).click();await page.getByRole('button',{name:'Changer de profil'}).waitFor();}
 return page;
}
const tab=(page,name)=>page.getByRole('tab',{name}).click();

test('connexion : six profils fictifs, bandeau « données fictives » permanent',async()=>{
 const page=await open(null);
 assert.equal(await page.locator('button.persona').count(),6);
 assert.match(await page.locator('.banner').textContent(),/données 100 % fictives/);
 await page.screenshot({path:shots+'01-connexion.png'});await page.close();
});

test('patient : synthèse, graphique, historique filtré, source d\'origine',async()=>{
 const page=await open('patient-demo');
 await page.locator('button.series').first().waitFor();
 assert.equal(await page.locator('button.series').count(),12);
 assert.ok(await page.locator('svg.chart circle').count()>=2);
 await page.locator('button.series',{hasText:'VFC'}).click();
 await page.getByRole('heading',{name:/VFC — mesures brutes/}).waitFor();
 assert.equal(await page.locator('svg.chart circle').count(),84);
 assert.match(await page.locator('.legend').textContent(),/SDNN/);
 assert.equal(await page.locator('svg.chart polyline').first().evaluate(e=>getComputedStyle(e).fill),'none','courbe non remplie');
 assert.doesNotMatch(await page.locator('body').innerText(),/\bnull\b|undefined|NaN/);
 await page.screenshot({path:shots+'02-synthese.png',fullPage:true});
 await tab(page,'Observations');await page.getByText('sur 378 observations').waitFor();
 await page.locator('#f-metric').selectOption('HRV');await page.getByText('sur 84 observations').waitFor();
 await page.locator('#f-start').fill('2026-11-10');await page.locator('#f-start').dispatchEvent('change');await page.getByText(/sur 5 observations/).waitFor();
 await page.getByRole('button',{name:'Source'}).first().click();await page.locator('#obs-detail').waitFor();
 const detail=await page.locator('#obs-detail').textContent();assert.match(detail,/Empreinte SHA-256[a-f0-9]{64}/);assert.match(detail,/demo_watch_csv/);assert.match(detail,/Identifiant source2026-11-1\d_hrv_ms/);
 await page.screenshot({path:shots+'03-observations.png',fullPage:true});
 // État vide : filtres sans résultat.
 await page.locator('#f-start').fill('2027-01-01');await page.locator('#f-start').dispatchEvent('change');await page.getByText('Aucune mesure ne correspond à ces filtres').waitFor();
 const dl=page.waitForEvent('download');await page.getByRole('button',{name:'Exporter CSV'}).click();assert.equal((await dl).suggestedFilename(),'observations-synthetiques.csv');
 await page.close();
});

test('rapport à la demande : 12 séries, empreinte, paramètres, erreur de saisie expliquée',async()=>{
 const page=await open('patient-demo');await tab(page,'Rapport');
 await page.locator('#report-table tbody tr').first().waitFor();assert.equal(await page.locator('#report-table tbody tr').count(),12);
 const meta=await page.locator('#report-meta').textContent();assert.match(meta,/378 observations/);const sha=meta.match(/[a-f0-9]{64}/)[0];
 assert.equal(await page.locator('#report-table tbody tr',{hasText:'Non comparé : couverture insuffisante'}).count(),1);
 assert.doesNotMatch(await page.locator('#view').textContent(),/risque (élevé|faible)|anormal|pathologi|consultez/i);
 await page.locator('#r-windowDays').fill('21');await page.locator('#r-windowDays').dispatchEvent('change');await page.locator('#r-run').click();
 await page.waitForFunction(old=>{const m=document.querySelector('#report-meta');return m&&!m.textContent.includes(old);},sha);
 assert.equal(await page.locator('#report-table tbody tr').count(),12);
 await page.screenshot({path:shots+'04-rapport.png',fullPage:true});
 await page.locator('#r-start').fill('2026-11-10');await page.locator('#r-start').dispatchEvent('change');await page.locator('#r-end').fill('2026-11-01');await page.locator('#r-end').dispatchEvent('change');await page.locator('#r-run').click();
 await page.getByText('Période invalide').waitFor();
 await page.close();
});

test('IDE : pas de lecture du dossier, import idempotent, erreurs par ligne ; patient : révocation',async()=>{
 const page=await open('ide-demo');
 assert.equal(await page.getByRole('tab').count(),1,'un IDE « mesures » ne voit que l\'onglet d\'import');
 const card=page.locator('[data-connector=demo_lab_csv]');await card.waitFor();
 await card.locator('input[type=file]').setInputFiles(new URL('../../fixtures/csv/lab_demo.csv',import.meta.url).pathname);await card.getByRole('button',{name:'Importer'}).click();
 await card.getByText('0 observation(s) ajoutée(s), 6 doublon(s) ignoré(s)').waitFor();
 await card.locator('input[type=file]').setInputFiles({name:'bad.csv',mimeType:'text/csv',buffer:Buffer.from('record_id,timestamp,metric_code,method_code,value,unit,source_device\nx1,2026-11-14T08:00:00Z,TG,lab_reported,1.1,mmol/L,Labo\n')});await card.getByRole('button',{name:'Importer'}).click();
 await card.getByText('Ligne 2 : UNIT_MISMATCH_NO_SILENT_CONVERSION').waitFor();
 assert.match(await page.locator('[data-connector=demo_watch_csv]').textContent(),/n'est pas habilité/);
 assert.match(await page.locator('#view').textContent(),/Apple HealthKit.*non configuré/s);
 await page.screenshot({path:shots+'05-imports.png',fullPage:true});await page.close();
 const patient=await open('patient-demo');await tab(patient,'Sources et imports');
 const lab=patient.locator('[data-connector=demo_lab_csv]');await lab.getByRole('button',{name:'Révoquer l\'autorisation'}).click();await lab.getByText('révoquée').waitFor();
 await lab.getByRole('button',{name:'Autoriser cette source'}).click();await lab.getByText('active',{exact:true}).waitFor();
 await tab(patient,'Journal d\'accès');await patient.locator('#audit-table').waitFor();
 const journal=await patient.locator('#audit-table').textContent();assert.match(journal,/ide-demo.*import_rejected/s);assert.match(journal,/connection_revoked/);
 await patient.close();
});

test('rôles sans accès et dossier vide : états explicites',async()=>{
 const founder=await open('founder-demo');await founder.getByRole('heading',{name:'Aucun dossier accessible'}).waitFor();assert.equal(await founder.getByRole('tab').count(),0);await founder.close();
 const beta=await open('patient-beta');await beta.getByText('Aucune observation dans ce dossier').waitFor();
 await tab(beta,'Rapport');await beta.getByText('Aucune observation sur cette période').waitFor();
 await beta.screenshot({path:shots+'06-dossier-vide.png'});await beta.close();
});

test('mobile 390 px : pas de débordement horizontal ; aucun message d\'erreur console ni violation CSP',async()=>{
 const page=await open('physician-demo',{width:390,height:800});await page.locator('button.series').first().waitFor();
 for(const name of ['Synthèse','Observations','Rapport','Sources et imports']){await tab(page,name);await page.waitForTimeout(400);
  const o=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);assert.ok(o<=1,`débordement horizontal ${o}px sur ${name}`);}
 assert.equal(await page.getByRole('tab',{name:'Journal d\'accès'}).count(),0,'le journal est réservé au patient');
 await tab(page,'Synthèse');await page.locator('button.series').first().waitFor();await page.screenshot({path:shots+'07-mobile.png',fullPage:true});await page.close();
 assert.deepEqual(problems,[]);
});

test('capacité UI (réponses interceptées) : aucun dossier partiel présenté comme complet',async()=>{
 const page=await open(null);let pages=0;
 await page.route('**/observations?limit=500&offset=*',route=>{
  pages++;return route.fulfill({json:{total:25000,observations:Array.from({length:500},()=>({id:'capacity-fixture'}))}});
 });
 await page.getByRole('button',{name:/^patient-demo/}).click();
 await page.getByText('Impossible de charger la synthèse').waitFor();
 await page.getByText('Dossier trop volumineux pour cette vue.',{exact:false}).waitFor();
 assert.equal(pages,41);assert.equal(await page.locator('button.series').count(),0);
 await page.close();
});
