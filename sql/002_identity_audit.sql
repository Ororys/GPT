-- v1.4 SECURITY DESIGN REFERENCE. RUN IN DISPOSABLE TEST DATABASE ONLY.
-- This migration does NOT provide usable patient authentication or clinical authorization.
-- API must verify tokens outside the database; NEVER trust a user-provided actor_id.
BEGIN;
CREATE TABLE hc.actor (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 external_subject text NOT NULL UNIQUE,
 actor_kind text NOT NULL CHECK (actor_kind IN ('patient','ide','physician','admin','founder','service')),
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE hc.patient_actor (
 actor_id uuid PRIMARY KEY REFERENCES hc.actor(id),
 person_id uuid NOT NULL REFERENCES hc.person(id),
 UNIQUE(actor_id,person_id)
);
CREATE TABLE hc.care_access_grant (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_id uuid NOT NULL REFERENCES hc.actor(id),
 person_id uuid NOT NULL REFERENCES hc.person(id),
 granted_by uuid REFERENCES hc.actor(id),
 purpose text NOT NULL CHECK(purpose IN ('clinical_care','measurements')),
 valid_from timestamptz NOT NULL,
 valid_until timestamptz NOT NULL,
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(valid_until>valid_from),
 CHECK(revoked_at IS NULL OR revoked_at>=valid_from)
);
CREATE INDEX care_grant_scope_idx ON hc.care_access_grant(actor_id,person_id,valid_from,valid_until);
CREATE TABLE hc.ingestion_receipt (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 person_id uuid NOT NULL REFERENCES hc.person(id),
 connection_id uuid REFERENCES hc.source_connection(id),
 source_namespace text NOT NULL,
 source_record_id text NOT NULL,
 ingestion_version text NOT NULL,
 payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
 observation_id uuid NOT NULL REFERENCES hc.observation(id),
 received_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(person_id,source_namespace,source_record_id,ingestion_version)
);
-- Append-only audit: forbid UPDATE / DELETE for ordinary SQL sessions.
-- This is not tamper proof against the database owner or superuser.
CREATE FUNCTION hc.reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Audit events are append-only'; END $$;
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON hc.access_audit
FOR EACH ROW EXECUTE FUNCTION hc.reject_audit_mutation();
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['actor','patient_actor','care_access_grant','ingestion_receipt'] LOOP
  EXECUTE format('ALTER TABLE hc.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE hc.%I FORCE ROW LEVEL SECURITY',t);
 END LOOP;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA hc FROM PUBLIC;
-- NO broad GRANTs and NO policies. API connection cannot use these tables yet.
-- A production design must create separated migration/service roles and enforce access
-- in DB policies or a fully audited SECURITY DEFINER RPC boundary before deployment.
COMMIT;
