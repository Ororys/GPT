-- HEALTH CONVERGENCE V1.3 / DESIGN REFERENCE - NOT PRODUCTION READY
-- PostgreSQL >=15. Execute in a DEDICATED test database only.
-- Sensitive personal data must NOT be loaded until architecture, HDS, legal basis, DPIA,
-- database roles, audit, backup and incident processes are formally approved.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS hc;

CREATE TABLE hc.person (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 alias text NOT NULL CHECK (length(alias) BETWEEN 1 AND 160),
 created_at timestamptz NOT NULL DEFAULT now(),
 synthetic boolean NOT NULL DEFAULT false
);
CREATE TABLE hc.source_connection (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 person_id uuid NOT NULL REFERENCES hc.person(id),
 provider text NOT NULL CHECK(provider IN ('demo_watch','demo_lab','demo_center','apple_health','health_connect','garmin','lab','center')),
 status text NOT NULL DEFAULT 'inactive' CHECK(status IN ('inactive','active','revoked','error')),
 permission_scope jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(permission_scope)='array'),
 authorized_at timestamptz,
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(status<>'revoked' OR revoked_at IS NOT NULL)
);
CREATE TABLE hc.device (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 maker text NOT NULL,
 model text NOT NULL,
 device_kind text NOT NULL,
 measurement_method text,
 firmware text,
 synthetic boolean NOT NULL DEFAULT false
);
CREATE TABLE hc.measurement_session (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 person_id uuid NOT NULL REFERENCES hc.person(id),
 performed_at timestamptz NOT NULL,
 setting text NOT NULL,
 protocol_version text,
 operator_role text,
 synthetic boolean NOT NULL DEFAULT false
);
CREATE TABLE hc.lab_report (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 person_id uuid NOT NULL REFERENCES hc.person(id),
 report_external_id text,
 sample_at timestamptz,
 validated_at timestamptz,
 received_at timestamptz NOT NULL DEFAULT now(),
 lab_name text NOT NULL,
 document_reference text,
 revision int NOT NULL DEFAULT 1 CHECK(revision>0),
 synthetic boolean NOT NULL DEFAULT false,
 CHECK(sample_at IS NULL OR validated_at IS NULL OR validated_at>=sample_at)
);
-- One normalized observation per measurement and metric. Original raw identifiers
-- remain in provenance; no clinical interpretation attached to observations.
CREATE TABLE hc.observation (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 person_id uuid NOT NULL REFERENCES hc.person(id),
 source_connection_id uuid REFERENCES hc.source_connection(id),
 device_id uuid REFERENCES hc.device(id),
 session_id uuid REFERENCES hc.measurement_session(id),
 lab_report_id uuid REFERENCES hc.lab_report(id),
 metric_code text NOT NULL,
 method_code text NOT NULL DEFAULT 'unspecified',
 original_value numeric NOT NULL,
 original_unit text NOT NULL,
 value_canonical numeric NOT NULL,
 unit_canonical text NOT NULL,
 measured_at timestamptz NOT NULL,
 interval_end_at timestamptz,
 ingested_at timestamptz NOT NULL DEFAULT now(),
 original_timezone text,
 quality_state text NOT NULL DEFAULT 'unreviewed' CHECK(quality_state IN ('unreviewed','acceptable','incomplete','excluded')),
 synthetic boolean NOT NULL DEFAULT false,
 supersedes_observation_id uuid REFERENCES hc.observation(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(interval_end_at IS NULL OR interval_end_at>measured_at),
 CHECK(metric_code <> 'HRV' OR method_code IN ('SDNN','RMSSD','OTHER_UNSPECIFIED')),
 CHECK(metric_code <> 'HRV' OR unit_canonical='ms'),
 CHECK(metric_code <> 'SPO2' OR (value_canonical BETWEEN 0 AND 100)),
 CHECK(metric_code <> 'STEPS' OR value_canonical>=0)
);
CREATE INDEX observation_person_time_idx ON hc.observation(person_id, measured_at DESC);
CREATE INDEX observation_metric_time_idx ON hc.observation(person_id, metric_code, method_code, measured_at DESC);

CREATE TABLE hc.observation_provenance (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 observation_id uuid NOT NULL UNIQUE REFERENCES hc.observation(id),
 source_namespace text NOT NULL,
 source_record_id text NOT NULL,
 ingestion_version text NOT NULL,
 source_sha256 text,
 transformations jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(transformations)='array'),
 imported_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(source_namespace,source_record_id,ingestion_version)
);
CREATE TABLE hc.report (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 person_id uuid NOT NULL REFERENCES hc.person(id),
 generated_at timestamptz NOT NULL DEFAULT now(),
 purpose text NOT NULL DEFAULT 'descriptive' CHECK(purpose='descriptive'),
 algorithm_version text NOT NULL,
 window_start timestamptz NOT NULL,
 window_end timestamptz NOT NULL,
 document_sha256 text,
 synthetic boolean NOT NULL DEFAULT false,
 CHECK(window_end>window_start)
);
CREATE TABLE hc.report_observation (
 report_id uuid NOT NULL REFERENCES hc.report(id),
 observation_id uuid NOT NULL REFERENCES hc.observation(id),
 PRIMARY KEY(report_id,observation_id)
);
CREATE TABLE hc.access_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 subject_id uuid REFERENCES hc.person(id),
 actor_ref text NOT NULL,
 event_type text NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT now(),
 details jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE hc.clinical_module (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 module_code text NOT NULL UNIQUE,
 intended_purpose text NOT NULL,
 regulatory_status text NOT NULL DEFAULT 'research_only' CHECK(regulatory_status IN ('research_only','under_review','authorized')),
 executable_in_v1 boolean NOT NULL DEFAULT false CHECK(executable_in_v1=false)
);
-- Fail closed: no tenant access policy is installed. Permissions must be designed
-- with a trusted auth context, least-privilege roles and professional access control.
-- The table owner / superuser / BYPASSRLS roles may still bypass protections.
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='hc' LOOP
   EXECUTE format('ALTER TABLE hc.%I ENABLE ROW LEVEL SECURITY',r.tablename);
   EXECUTE format('ALTER TABLE hc.%I FORCE ROW LEVEL SECURITY',r.tablename);
 END LOOP;
END $$;
REVOKE ALL ON SCHEMA hc FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA hc FROM PUBLIC;
-- Privileged migration owner may still access data. Do not expose to client/API role.
COMMIT;
