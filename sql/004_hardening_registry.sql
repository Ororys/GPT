-- v3.0 — Durcissement de la frontière SQL et registre des métriques.
-- DONNÉES SYNTHÉTIQUES UNIQUEMENT. Exécuté par le rôle d'amorçage (migrations), jamais par l'API.
-- Corrige les écarts constatés lors de la PREMIÈRE exécution réelle de 001–003 sur PostgreSQL 16
-- (voir AUDIT_TECHNIQUE.md : P0-1, P0-2, P1-1, P1-2, P1-3).
BEGIN;

-- 1. Rôles : propriétaire non privilégié (les fonctions SECURITY DEFINER ne tournent plus en superutilisateur).
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='hc_owner') THEN
  CREATE ROLE hc_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='hc_api') THEN
  CREATE ROLE hc_api NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION;
 END IF;
END $$;

-- 2. Les fonctions 003 sont retirées : insert_synthetic_measurement échouait systématiquement
--    (digest() introuvable avec search_path=pg_catalog,hc) et tout s'exécutait avec les droits du superutilisateur.
DROP FUNCTION IF EXISTS hc.insert_synthetic_measurement(text,uuid,text,text,jsonb);
DROP FUNCTION IF EXISTS hc.read_synthetic_observations(text,uuid);
DROP FUNCTION IF EXISTS hc.authorize_synthetic(text,uuid,text);

-- 3. La contrainte d'unicité globale de provenance (sans patient) n'avait PAS été supprimée par 003 :
--    le nom visé y était faux (troncature à 63 caractères). On la retrouve par ses colonnes.
DO $$ DECLARE c record; BEGIN
 FOR c IN
  SELECT con.conname FROM pg_constraint con
  WHERE con.conrelid='hc.observation_provenance'::regclass AND con.contype='u'
    AND (SELECT array_agg(a.attname::text ORDER BY a.attname::text) FROM pg_attribute a
         WHERE a.attrelid=con.conrelid AND a.attnum=ANY(con.conkey))
        = ARRAY['ingestion_version','source_namespace','source_record_id']
 LOOP EXECUTE format('ALTER TABLE hc.observation_provenance DROP CONSTRAINT %I',c.conname); END LOOP;
END $$;

-- 4. Verrou « synthétique uniquement » en base (et non plus seulement dans le code applicatif).
--    À ne lever que par une migration explicite, après levée des bloquants de BLOCKERS.md.
ALTER TABLE hc.person ADD CONSTRAINT person_synthetic_only CHECK (synthetic);
ALTER TABLE hc.observation ADD CONSTRAINT observation_synthetic_only CHECK (synthetic);

-- 5. Registre unique des métriques (remplace trois vocabulaires incompatibles : contracts/types.ts,
--    src/api.mjs et src/live-report.mjs). Les bornes sont des bornes de PLAUSIBILITÉ TECHNIQUE de saisie,
--    pas des seuils cliniques. Aucune conversion d'unité automatique (décision dossier maître §17.3).
CREATE TABLE hc.metric_definition (
 metric_code text PRIMARY KEY CHECK (metric_code ~ '^[A-Z][A-Z0-9_]{0,31}$'),
 label_fr text NOT NULL,
 canonical_unit text NOT NULL,
 series_kind text NOT NULL CHECK (series_kind IN ('daily_series','punctual')),
 plausible_min numeric NOT NULL,
 plausible_max numeric NOT NULL,
 integer_only boolean NOT NULL DEFAULT false,
 registry_version text NOT NULL,
 CHECK (plausible_min<=plausible_max)
);
CREATE TABLE hc.metric_method (
 metric_code text NOT NULL REFERENCES hc.metric_definition(metric_code),
 method_code text NOT NULL CHECK (length(method_code) BETWEEN 1 AND 64),
 PRIMARY KEY(metric_code,method_code)
);
INSERT INTO hc.metric_definition(metric_code,label_fr,canonical_unit,series_kind,plausible_min,plausible_max,integer_only,registry_version) VALUES
 ('RHR','Fréquence cardiaque au repos','bpm','daily_series',1,250,false,'3.0'),
 ('HRV','VFC','ms','daily_series',0.01,1000,false,'3.0'),
 ('SLEEP','Durée de sommeil','h','daily_series',0,24,false,'3.0'),
 ('STEPS','Nombre de pas','steps','daily_series',0,150000,true,'3.0'),
 ('SPO2','SpO₂ mesurée par montre','%','daily_series',1,100,false,'3.0'),
 ('LDL_C','LDL-cholestérol','g/L','punctual',0,20,false,'3.0'),
 ('HBA1C','HbA1c','%','punctual',0,25,false,'3.0'),
 ('TG','Triglycérides','g/L','punctual',0,50,false,'3.0'),
 ('CREATININE','Créatinine','mg/L','punctual',0,1000,false,'3.0'),
 ('WAIST','Tour de taille','cm','punctual',20,300,false,'3.0'),
 ('BFP','Masse grasse estimée','%','punctual',1,80,false,'3.0'),
 ('SBP','Pression systolique','mmHg','punctual',30,350,false,'3.0'),
 ('GRIP','Force de préhension','kg','punctual',0,150,false,'3.0');
INSERT INTO hc.metric_method(metric_code,method_code) VALUES
 ('RHR','wearable_resting_hr'),('HRV','SDNN'),('HRV','RMSSD'),('SLEEP','wearable_sleep_duration'),
 ('STEPS','wearable_step_count'),('SPO2','wearable_spo2'),('LDL_C','lab_reported'),('LDL_C','calculated_friedewald'),
 ('HBA1C','lab_hplc'),('HBA1C','lab_reported'),('TG','lab_reported'),('CREATININE','lab_reported'),
 ('WAIST','waist_tape'),('BFP','bioimpedance'),('SBP','automated_bp_repeated'),('GRIP','grip_dynamometer');

-- 6. Espaces de noms de sources : qui peut importer quoi, via quel fournisseur (consentement/connexion).
CREATE TABLE hc.source_namespace_def (
 namespace text PRIMARY KEY CHECK (namespace ~ '^[a-z][a-z0-9_]{2,47}$'),
 provider text NOT NULL,
 importer_kinds text[] NOT NULL,
 description text NOT NULL
);
INSERT INTO hc.source_namespace_def VALUES
 ('demo_watch_csv','demo_watch',ARRAY['patient'],'Connecteur montre simulé (CSV synthétique)'),
 ('demo_lab_csv','demo_lab',ARRAY['ide','physician'],'Connecteur laboratoire simulé (CSV synthétique)'),
 ('demo_center_csv','demo_center',ARRAY['ide','physician'],'Mesures du centre simulées (CSV synthétique)'),
 ('demo_center_v1_2','demo_center',ARRAY['ide','physician'],'Mesures du centre du jeu fictif v1.2');
ALTER TABLE hc.source_connection ADD CONSTRAINT source_connection_person_provider_key UNIQUE(person_id,provider);

-- 7. Observation : appareil source explicite (clé de comparabilité) et rattachement au registre.
ALTER TABLE hc.observation ADD COLUMN source_device text NOT NULL DEFAULT 'unspecified' CHECK (length(source_device) BETWEEN 1 AND 160);
ALTER TABLE hc.observation ADD CONSTRAINT observation_metric_method_fk FOREIGN KEY(metric_code,method_code) REFERENCES hc.metric_method(metric_code,method_code);
ALTER TABLE hc.observation_provenance ADD COLUMN person_id uuid NOT NULL REFERENCES hc.person(id);
ALTER TABLE hc.report ALTER COLUMN window_start DROP NOT NULL, ALTER COLUMN window_end DROP NOT NULL;
ALTER TABLE hc.report ADD COLUMN parameters jsonb NOT NULL DEFAULT '{}'::jsonb, ADD COLUMN requested_by text;
ALTER TABLE hc.report ADD CONSTRAINT report_person_sha_key UNIQUE(person_id,document_sha256);

-- 8. Immuabilité technique des observations, de leur provenance, des accusés d'import et des rapports.
--    Une correction passera par une nouvelle version (supersedes_observation_id), jamais par UPDATE.
CREATE FUNCTION hc.reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'IMMUTABLE_RECORD: % on %', TG_OP, TG_TABLE_NAME USING ERRCODE='42501'; END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['observation','observation_provenance','ingestion_receipt','report','report_observation'] LOOP
  EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON hc.%I FOR EACH ROW EXECUTE FUNCTION hc.reject_mutation()',t||'_immutable',t);
  EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON hc.%I FOR EACH STATEMENT EXECUTE FUNCTION hc.reject_mutation()',t||'_no_truncate',t);
 END LOOP;
 EXECUTE 'CREATE TRIGGER access_audit_no_truncate BEFORE TRUNCATE ON hc.access_audit FOR EACH STATEMENT EXECUTE FUNCTION hc.reject_mutation()';
END $$;

-- 9. RLS : jusqu'ici FORCE RLS sans AUCUNE politique — le schéma ne « fonctionnait » que parce que
--    tout tournait en superutilisateur. Politiques réelles, appliquées au propriétaire hc_owner :
--    les tables portant des données de dossier ne sont visibles que pour LA personne placée en portée
--    de transaction par une fonction d'API après autorisation (défense en profondeur contre un oubli de filtre).
CREATE FUNCTION hc.scope_person() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('hc.person_scope', true),'')::uuid $$;

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['metric_definition','metric_method','source_namespace_def'] LOOP
  EXECUTE format('ALTER TABLE hc.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE hc.%I FORCE ROW LEVEL SECURITY',t);
 END LOOP;
 -- Tables de référence et d'habilitation : lisibles par le propriétaire (nécessaires à la décision d'accès).
 FOREACH t IN ARRAY ARRAY['metric_definition','metric_method','source_namespace_def','actor','patient_actor','care_access_grant','person','device','clinical_module'] LOOP
  EXECUTE format('CREATE POLICY owner_reference_read ON hc.%I FOR SELECT TO hc_owner USING (true)',t);
 END LOOP;
 -- Tables de dossier portant person_id : strictement limitées à la personne en portée.
 FOREACH t IN ARRAY ARRAY['observation','observation_provenance','ingestion_receipt','report','lab_report','measurement_session','source_connection'] LOOP
  EXECUTE format('CREATE POLICY person_scope ON hc.%I FOR ALL TO hc_owner USING (person_id = hc.scope_person()) WITH CHECK (person_id = hc.scope_person())',t);
 END LOOP;
END $$;
CREATE POLICY person_scope ON hc.report_observation FOR ALL TO hc_owner
 USING (EXISTS(SELECT 1 FROM hc.report r WHERE r.id=report_id))
 WITH CHECK (EXISTS(SELECT 1 FROM hc.report r WHERE r.id=report_id) AND EXISTS(SELECT 1 FROM hc.observation o WHERE o.id=observation_id));
CREATE POLICY audit_append ON hc.access_audit FOR INSERT TO hc_owner WITH CHECK (true);
CREATE POLICY audit_scope_read ON hc.access_audit FOR SELECT TO hc_owner USING (subject_id = hc.scope_person());

-- 10. Transfert de propriété au rôle non privilégié.
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='hc' LOOP EXECUTE format('ALTER TABLE hc.%I OWNER TO hc_owner',r.tablename); END LOOP;
 FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p WHERE p.pronamespace='hc'::regnamespace LOOP EXECUTE format('ALTER FUNCTION %s OWNER TO hc_owner',r.sig); END LOOP;
END $$;
ALTER SCHEMA hc OWNER TO hc_owner;
REVOKE ALL ON SCHEMA hc FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA hc FROM PUBLIC, hc_api;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA hc FROM PUBLIC, hc_api;
GRANT USAGE ON SCHEMA hc TO hc_api;
COMMIT;
