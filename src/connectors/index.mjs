// Registre des connecteurs. Contrat d'un connecteur (SourceConnector) :
//   id            identifiant stable ; pour un connecteur actif = espace de noms hc.source_namespace_def
//   status        'simulated' (données fictives) | 'not_configured' (interface préparée, AUCUN accès réel)
//   parse(input)  -> {records, errors} ; records au format d'import normalisé :
//                 {source_record_id, metric_code, method_code, value, unit, measured_at (ISO-8601 avec décalage),
//                  interval_end_at|null, source_device}
// Un connecteur ne décide jamais des droits : l'import passe par hc.api_import_batch (autorisation + connexion active).
import {csvToRecords} from './csv.mjs';
const notConfigured=()=>{throw Error('CONNECTOR_NOT_CONFIGURED');};
export const CONNECTORS=Object.freeze({
 demo_watch_csv:{id:'demo_watch_csv',status:'simulated',label:'Montre simulée (CSV fictif)',provider:'demo_watch',contentType:'text/csv',parse:csvToRecords},
 demo_lab_csv:{id:'demo_lab_csv',status:'simulated',label:'Laboratoire simulé (CSV fictif)',provider:'demo_lab',contentType:'text/csv',parse:csvToRecords},
 demo_center_csv:{id:'demo_center_csv',status:'simulated',label:'Mesures du centre simulées (CSV fictif)',provider:'demo_center',contentType:'text/csv',parse:csvToRecords},
 // Interfaces préparées. Les correspondances ci-dessous sont des HYPOTHÈSES de conception issues de la documentation
 // publique ; elles doivent être vérifiées sur appareil réel. Aucun identifiant, jeton ou appel fournisseur n'existe ici.
 apple_healthkit:{id:'apple_healthkit',status:'not_configured',label:'Apple HealthKit',provider:'apple_health',parse:notConfigured,
  requires:['Application iOS native (HealthKit est inaccessible depuis un navigateur)','Compte développeur Apple et entitlement HealthKit','Consentement granulaire par type de donnée','Cadre RGPD/HDS validé avant toute donnée réelle'],
  mapping:[{source:'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',metric:'HRV',method:'SDNN'},{source:'HKQuantityTypeIdentifierRestingHeartRate',metric:'RHR',method:'wearable_resting_hr'},{source:'HKQuantityTypeIdentifierStepCount',metric:'STEPS',method:'wearable_step_count',note:'règle d\'agrégation journalière à spécifier'},{source:'HKQuantityTypeIdentifierOxygenSaturation',metric:'SPO2',method:'wearable_spo2'},{source:'HKCategoryTypeIdentifierSleepAnalysis',metric:'SLEEP',method:'wearable_sleep_duration',note:'intervalles à agréger ; règle non définie'}]},
 android_health_connect:{id:'android_health_connect',status:'not_configured',label:'Android Health Connect',provider:'health_connect',parse:notConfigured,
  requires:['Application Android compatible Health Connect','Déclaration des permissions par type d\'enregistrement','Consentement granulaire','Cadre RGPD/HDS validé avant toute donnée réelle'],
  mapping:[{source:'HeartRateVariabilityRmssdRecord',metric:'HRV',method:'RMSSD',note:'JAMAIS fusionné avec le SDNN HealthKit'},{source:'RestingHeartRateRecord',metric:'RHR',method:'wearable_resting_hr'},{source:'StepsRecord',metric:'STEPS',method:'wearable_step_count'},{source:'OxygenSaturationRecord',metric:'SPO2',method:'wearable_spo2'},{source:'SleepSessionRecord',metric:'SLEEP',method:'wearable_sleep_duration',note:'intervalles à agréger ; règle non définie'}]},
 lab_hl7_fhir:{id:'lab_hl7_fhir',status:'not_configured',label:'Laboratoire partenaire (HL7/FHIR)',provider:'lab',parse:notConfigured,
  requires:['Convention avec un laboratoire et format d\'échange contractuel','Rattachement LOINC/UCUM validé par un biologiste','Règles de conversion d\'unités validées sur valeurs de référence','Gestion des comptes rendus corrigés (révisions)'],mapping:[]}
});
export function publicConnectors(){return Object.values(CONNECTORS).map(({parse,...c})=>c);}
