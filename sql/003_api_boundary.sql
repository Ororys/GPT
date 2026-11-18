-- V1.5: SYNTHETIC DEMO ONLY. Execute after 001/002 with a trusted schema owner.
-- All exposed RPCs are SECURITY DEFINER, on synthetic person rows ONLY.
-- Table rights are REVOKED from hc_api. Never use hc_api as schema owner or BYPASSRLS.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='hc_api') THEN CREATE ROLE hc_api NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF;
END $$;
-- v1.3 provenance uniqueness omitted patient ID; receipt provides per-person uniqueness.
-- Keep an index but remove the global restriction to avoid cross-person collisions.
ALTER TABLE hc.observation_provenance DROP CONSTRAINT IF EXISTS observation_provenance_source_namespace_source_record_id_ingestion_version_key;
CREATE INDEX IF NOT EXISTS provenance_external_record_idx ON hc.observation_provenance(source_namespace,source_record_id,ingestion_version);
CREATE OR REPLACE FUNCTION hc.authorize_synthetic(p_subject text,p_person uuid,p_action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, hc AS $$
 SELECT EXISTS(
 SELECT 1 FROM hc.actor a JOIN hc.person p ON p.id=p_person
 LEFT JOIN hc.patient_actor pa ON pa.actor_id=a.id AND pa.person_id=p_person
 WHERE a.external_subject=p_subject AND a.active AND p.synthetic
 AND ((p_action='read' AND a.actor_kind='patient' AND pa.actor_id IS NOT NULL)
 OR (a.actor_kind IN ('ide','physician') AND p_action IN ('read','write') AND EXISTS (
 SELECT 1 FROM hc.care_access_grant g WHERE g.actor_id=a.id AND g.person_id=p_person
 AND g.revoked_at IS NULL AND g.valid_from<=now() AND now()<g.valid_until
 AND ((p_action='read' AND g.purpose='clinical_care')
   OR (p_action='write' AND (g.purpose='measurements' OR (a.actor_kind='physician' AND g.purpose='clinical_care'))))
 )))
 );
$$;
CREATE OR REPLACE FUNCTION hc.read_synthetic_observations(p_subject text,p_person uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,hc AS $$
DECLARE result jsonb;
BEGIN
 IF NOT hc.authorize_synthetic(p_subject,p_person,'read') THEN
  INSERT INTO hc.access_audit(actor_ref,event_type,details) VALUES (left(p_subject,180),'denied_read',jsonb_build_object('synthetic',true));
  RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',o.id,'metricCode',o.metric_code,'methodCode',o.method_code,'value',o.value_canonical,'unit',o.unit_canonical,'measuredAt',o.measured_at) ORDER BY o.measured_at),'[]'::jsonb)
 INTO result FROM hc.observation o WHERE o.person_id=p_person AND o.synthetic;
 INSERT INTO hc.access_audit(subject_id,actor_ref,event_type,details) VALUES (p_person,left(p_subject,180),'read_observations',jsonb_build_object('synthetic',true));
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION hc.insert_synthetic_measurement(p_subject text,p_person uuid,p_source_record text,p_version text,p_observation jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,hc AS $$
DECLARE v_metric text;v_method text;v_unit text;v_time timestamptz;v_value numeric;v_digest text;v_existing text;v_id uuid;
BEGIN
 IF NOT hc.authorize_synthetic(p_subject,p_person,'write') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF length(p_source_record) NOT BETWEEN 1 AND 120 OR length(p_version) NOT BETWEEN 1 AND 40 THEN RAISE EXCEPTION 'INVALID_OBSERVATION';END IF;
 v_metric:=p_observation->>'metricCode';v_method:=p_observation->>'methodCode';v_unit:=p_observation->>'unit';
 IF v_metric NOT IN ('HRV','SPO2','STEPS','HEART_RATE') OR v_method IS NULL OR v_unit IS NULL
 OR jsonb_typeof(p_observation->'value')<>'number' OR jsonb_typeof(p_observation->'measuredAt')<>'string' THEN
 RAISE EXCEPTION 'INVALID_OBSERVATION'; END IF;
 BEGIN v_time:=(p_observation->>'measuredAt')::timestamptz;v_value:=(p_observation->>'value')::numeric;
 EXCEPTION WHEN others THEN RAISE EXCEPTION 'INVALID_OBSERVATION';END;
 IF (v_metric='HRV' AND (v_method NOT IN ('SDNN','RMSSD') OR v_unit<>'ms'))
 OR (v_metric='SPO2' AND (v_value<0 OR v_value>100)) OR (v_metric='STEPS' AND v_value<0) THEN RAISE EXCEPTION 'INVALID_OBSERVATION'; END IF;
 -- Serialize same logical record before checking existing receipt. Avoid split-brain under concurrent imports.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_person::text||'|center|'||p_source_record||'|'||p_version,0));
 v_digest:=encode(digest(p_observation::text,'sha256'),'hex');
 SELECT r.payload_sha256 INTO v_existing FROM hc.ingestion_receipt r WHERE r.person_id=p_person AND r.source_namespace='center' AND r.source_record_id=p_source_record AND r.ingestion_version=p_version;
 IF FOUND THEN
 IF v_existing=v_digest THEN RETURN 'duplicate';END IF;
 RAISE EXCEPTION 'REVISION_CONFLICT' USING ERRCODE='23505';
 END IF;
 INSERT INTO hc.observation(person_id,metric_code,method_code,original_value,original_unit,value_canonical,unit_canonical,measured_at,synthetic)
 VALUES (p_person,v_metric,v_method,v_value,v_unit,v_value,v_unit,v_time,true) RETURNING id INTO v_id;
 INSERT INTO hc.observation_provenance(observation_id,source_namespace,source_record_id,ingestion_version,source_sha256)
 VALUES(v_id,'center',p_source_record,p_version,v_digest);
 INSERT INTO hc.ingestion_receipt(person_id,source_namespace,source_record_id,ingestion_version,payload_sha256,observation_id)
 VALUES(p_person,'center',p_source_record,p_version,v_digest,v_id);
 INSERT INTO hc.access_audit(subject_id,actor_ref,event_type,details)
 VALUES(p_person,left(p_subject,180),'write_measurement',jsonb_build_object('observationId',v_id,'synthetic',true));
 RETURN 'inserted';
END $$;
-- Execute-only API boundary. This is NOT a production auth mechanism by itself:
-- API owns hc_api connection and MUST verify signed tokens, never accept subject headers.
REVOKE ALL ON FUNCTION hc.authorize_synthetic(text,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION hc.read_synthetic_observations(text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION hc.insert_synthetic_measurement(text,uuid,text,text,jsonb) FROM PUBLIC;
GRANT USAGE ON SCHEMA hc TO hc_api;
GRANT EXECUTE ON FUNCTION hc.read_synthetic_observations(text,uuid) TO hc_api;
GRANT EXECUTE ON FUNCTION hc.insert_synthetic_measurement(text,uuid,text,text,jsonb) TO hc_api;
REVOKE ALL ON ALL TABLES IN SCHEMA hc FROM hc_api;
COMMIT;
-- IMPORTANT LIMITATIONS: denied audit INSERT rolls back with exception; no audit persistence for denies.
-- Additional issue: this API uses a shared identity-bearing role and SECURITY DEFINER functions;
-- production requires hardened identity binding and explicit privilege/ownership review.
