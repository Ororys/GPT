-- Additive, synthetic-only schema. Run as migration administrator, never as the application.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='hc_personal_owner') THEN
  CREATE ROLE hc_personal_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='hc_personal_api') THEN
  CREATE ROLE hc_personal_api NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('hc_personal_owner','hc_personal_api') AND (rolsuper OR rolbypassrls OR rolcanlogin OR rolcreaterole OR rolcreatedb)) THEN
  RAISE EXCEPTION 'UNSAFE_PERSONAL_ROLES';
 END IF;
END $$;
CREATE SCHEMA personal AUTHORIZATION hc_personal_owner;
REVOKE ALL ON SCHEMA personal FROM PUBLIC;
CREATE TABLE personal.record (
 person_id text PRIMARY KEY CHECK(person_id IN ('demo-alpha','demo-beta')),
 metadata jsonb NOT NULL CHECK(metadata->>'personId'=person_id AND metadata->>'synthetic'='true')
);
CREATE TABLE personal.actor (
 subject text PRIMARY KEY,
 person_id text NOT NULL UNIQUE REFERENCES personal.record(person_id),
 active boolean NOT NULL DEFAULT true
);
CREATE TABLE personal.biomarker (
 code text PRIMARY KEY,
 unit text NOT NULL,
 payload jsonb NOT NULL CHECK(payload->>'code'=code AND payload->>'unit'=unit),
 UNIQUE(code,unit)
);
CREATE TABLE personal.document (
 person_id text NOT NULL REFERENCES personal.record(person_id), id text NOT NULL,
 measured_at timestamptz NOT NULL, known_at timestamptz NOT NULL,
 payload jsonb NOT NULL CHECK(payload->>'id'=id AND payload->>'personId'=person_id AND payload->>'synthetic'='true'),
 PRIMARY KEY(person_id,id), CHECK(known_at>=measured_at)
);
CREATE TABLE personal.observation (
 person_id text NOT NULL, id text NOT NULL, document_id text NOT NULL,
 code text NOT NULL, unit text NOT NULL,
 measured_at timestamptz NOT NULL, known_at timestamptz NOT NULL,
 payload jsonb NOT NULL CHECK(payload->>'id'=id AND payload->>'personId'=person_id AND payload->>'synthetic'='true'
  AND payload->>'sourceId'=document_id AND payload->'evidence'->>'documentId'=document_id
  AND payload->>'code'=code AND payload->>'unit'=unit
  AND payload->'value'=payload->'evidence'->'originalValue'
  AND payload->>'unit'=payload->'evidence'->>'originalUnit'),
 PRIMARY KEY(person_id,id), FOREIGN KEY(person_id,document_id) REFERENCES personal.document(person_id,id),
 FOREIGN KEY(code,unit) REFERENCES personal.biomarker(code,unit), CHECK(known_at>=measured_at)
);
CREATE INDEX observation_series ON personal.observation(person_id,code,measured_at);
CREATE TABLE personal.activity (
 person_id text NOT NULL REFERENCES personal.record(person_id), id text NOT NULL,
 measured_at timestamptz NOT NULL, known_at timestamptz NOT NULL,
 payload jsonb NOT NULL CHECK(payload->>'id'=id AND payload->>'synthetic'='true'),
 PRIMARY KEY(person_id,id), CHECK(known_at>=measured_at)
);
CREATE TABLE personal.sleep_session (LIKE personal.activity INCLUDING ALL);
ALTER TABLE personal.sleep_session ADD FOREIGN KEY(person_id) REFERENCES personal.record(person_id);
CREATE TABLE personal.life_event (LIKE personal.activity INCLUDING ALL);
ALTER TABLE personal.life_event ADD FOREIGN KEY(person_id) REFERENCES personal.record(person_id);
CREATE TABLE personal.import_fixture (
 batch_id text PRIMARY KEY, person_id text NOT NULL REFERENCES personal.record(person_id),
 sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'), document jsonb NOT NULL, observations jsonb NOT NULL
);
CREATE TABLE personal.import_receipt (
 person_id text NOT NULL REFERENCES personal.record(person_id), batch_id text NOT NULL REFERENCES personal.import_fixture(batch_id),
 sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'), imported_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(person_id,batch_id)
);
CREATE TABLE personal.audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),at timestamptz NOT NULL DEFAULT clock_timestamp(),
 subject text NOT NULL,person_id text,event text NOT NULL,resource_id text NOT NULL
);
CREATE FUNCTION personal.scope() RETURNS text LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('hc.personal_scope',true),'')
$$;
CREATE FUNCTION personal.reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN RAISE EXCEPTION 'IMMUTABLE_PERSONAL_RECORD' USING ERRCODE='42501'; END
$$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['record','actor','biomarker','document','observation','activity','sleep_session','life_event','import_fixture','import_receipt','audit'] LOOP
  EXECUTE format('ALTER TABLE personal.%I OWNER TO hc_personal_owner',t);
  EXECUTE format('ALTER TABLE personal.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE personal.%I FORCE ROW LEVEL SECURITY',t);
  IF t IN ('actor','biomarker','import_fixture') THEN
   EXECUTE format('CREATE POLICY reference_read ON personal.%I FOR SELECT TO hc_personal_owner USING(true)',t);
  ELSIF t='audit' THEN
   CREATE POLICY audit_insert ON personal.audit FOR INSERT TO hc_personal_owner WITH CHECK(true);
   CREATE POLICY audit_read ON personal.audit FOR SELECT TO hc_personal_owner USING(person_id=personal.scope());
  ELSE
   EXECUTE format('CREATE POLICY scoped ON personal.%I TO hc_personal_owner USING(person_id=personal.scope()) WITH CHECK(person_id=personal.scope())',t);
  END IF;
  IF t NOT IN ('actor','biomarker','import_fixture') THEN
   EXECUTE format('CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON personal.%I FOR EACH ROW EXECUTE FUNCTION personal.reject_mutation()',t);
   EXECUTE format('CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON personal.%I FOR EACH STATEMENT EXECUTE FUNCTION personal.reject_mutation()',t);
  END IF;
 END LOOP;
END $$;
CREATE FUNCTION personal.guard(p_subject text,p_person text,p_event text) RETURNS boolean
LANGUAGE plpgsql SET search_path=pg_catalog,personal,pg_temp AS $$ BEGIN
 PERFORM set_config('hc.personal_scope','',true);
 IF NOT EXISTS(SELECT 1 FROM personal.actor WHERE subject=p_subject AND person_id=p_person AND active) THEN
  INSERT INTO personal.audit(subject,person_id,event,resource_id) VALUES(left(coalesce(p_subject,'anonymous'),100),NULL,'denied_'||p_event,'personal-record');
  RETURN false;
 END IF;
 PERFORM set_config('hc.personal_scope',p_person,true); RETURN true;
END $$;
CREATE FUNCTION personal.api_get_record(p_subject text,p_person text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,personal,pg_temp AS $$
DECLARE r jsonb; BEGIN
 IF NOT personal.guard(p_subject,p_person,'read') THEN RETURN jsonb_build_object('status','forbidden'); END IF;
 SELECT metadata INTO r FROM personal.record;
 IF r IS NULL THEN RETURN jsonb_build_object('status','not_found'); END IF;
 r:=r||jsonb_build_object('storage','postgresql',
 'biomarkers',(SELECT coalesce(jsonb_agg(payload ORDER BY code),'[]'::jsonb) FROM personal.biomarker),
 'documents',(SELECT coalesce(jsonb_agg(payload ORDER BY measured_at,id),'[]'::jsonb) FROM personal.document),
 'observations',(SELECT coalesce(jsonb_agg(payload ORDER BY measured_at,id),'[]'::jsonb) FROM personal.observation),
 'activities',(SELECT coalesce(jsonb_agg(payload ORDER BY measured_at DESC,id),'[]'::jsonb) FROM personal.activity),
 'sleep',(SELECT coalesce(jsonb_agg(payload ORDER BY measured_at DESC,id),'[]'::jsonb) FROM personal.sleep_session),
 'events',(SELECT coalesce(jsonb_agg(payload ORDER BY measured_at DESC,id),'[]'::jsonb) FROM personal.life_event));
 INSERT INTO personal.audit(subject,person_id,event,resource_id) VALUES(p_subject,p_person,'read_record',p_person);
 RETURN jsonb_build_object('status','ok','record',r);
END $$;
CREATE FUNCTION personal.api_import(p_subject text,p_person text,p_sha text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,personal,pg_temp AS $$
DECLARE f personal.import_fixture; o jsonb; BEGIN
 IF NOT personal.guard(p_subject,p_person,'import') THEN RETURN jsonb_build_object('status','forbidden'); END IF;
 SELECT * INTO f FROM personal.import_fixture WHERE person_id=p_person AND sha256=p_sha;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','invalid'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('personal|'||p_person||'|'||f.batch_id,0));
 IF EXISTS(SELECT 1 FROM personal.import_receipt WHERE batch_id=f.batch_id) THEN
  INSERT INTO personal.audit(subject,person_id,event,resource_id) VALUES(p_subject,p_person,'import_duplicate',f.batch_id);
  RETURN jsonb_build_object('status','ok','inserted',0,'duplicates',1,'sha256',p_sha);
 END IF;
 INSERT INTO personal.document VALUES(p_person,f.document->>'id',(f.document->>'date')::timestamptz,(f.document->>'knownAt')::timestamptz,f.document);
 FOR o IN SELECT * FROM jsonb_array_elements(f.observations) LOOP
  INSERT INTO personal.observation VALUES(p_person,o->>'id',o->>'sourceId',o->>'code',o->>'unit',(o->>'measuredAt')::timestamptz,(o->>'knownAt')::timestamptz,o);
 END LOOP;
 INSERT INTO personal.import_receipt(person_id,batch_id,sha256) VALUES(p_person,f.batch_id,p_sha);
 INSERT INTO personal.audit(subject,person_id,event,resource_id) VALUES(p_subject,p_person,'import_demo',f.batch_id);
 RETURN jsonb_build_object('status','ok','inserted',jsonb_array_length(f.observations),'duplicates',0,'sha256',p_sha);
END $$;
CREATE FUNCTION personal.api_audit(p_subject text,p_event text,p_resource text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,personal,pg_temp AS $$
DECLARE p text; BEGIN
 IF p_event NOT IN ('demo_session','denied_read','read_document','export_record','import_demo','read_record') OR length(p_resource)>100 OR length(p_subject)>100 THEN RAISE EXCEPTION 'INVALID_AUDIT'; END IF;
 SELECT person_id INTO p FROM personal.actor WHERE subject=p_subject AND active;
 INSERT INTO personal.audit(subject,person_id,event,resource_id) VALUES(p_subject,p,p_event,p_resource);
END $$;
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT p.oid::regprocedure AS signature,p.proname FROM pg_proc p WHERE pronamespace='personal'::regnamespace LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO hc_personal_owner',r.signature);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',r.signature);
  IF r.proname LIKE 'api\_%' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO hc_personal_api',r.signature); END IF;
 END LOOP;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA personal FROM PUBLIC,hc_personal_api;
GRANT USAGE ON SCHEMA personal TO hc_personal_api;
