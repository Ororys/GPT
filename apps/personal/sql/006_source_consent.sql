-- Explicit, versioned, revocable permission per data entry point. Only the entry points that
-- really exist are covered: native PDF documents and the structured demo import. Revoking
-- stops new intake; data already added stays (erasure policy is an open legal decision).
CREATE TABLE personal.source_consent(
 person_id text NOT NULL REFERENCES personal.record(person_id),
 source text NOT NULL CHECK(source IN ('pdf-documents','structured-import')),
 version int NOT NULL CHECK(version BETWEEN 1 AND 1000),
 granted boolean NOT NULL,
 decided_by text NOT NULL,
 decided_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(person_id,source,version)
);
ALTER TABLE personal.source_consent OWNER TO hc_personal_owner;
ALTER TABLE personal.source_consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal.source_consent FORCE ROW LEVEL SECURITY;
CREATE POLICY scoped ON personal.source_consent TO hc_personal_owner
 USING(person_id=personal.scope()) WITH CHECK(person_id=personal.scope());
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON personal.source_consent
 FOR EACH ROW EXECUTE FUNCTION personal.reject_mutation();
CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON personal.source_consent
 FOR EACH STATEMENT EXECUTE FUNCTION personal.reject_mutation();
REVOKE ALL ON personal.source_consent FROM PUBLIC,hc_personal_api;

CREATE FUNCTION personal.consent_granted(p_person text,p_source text) RETURNS boolean
LANGUAGE sql STABLE SET search_path=pg_catalog,personal,pg_temp AS $$
 SELECT coalesce((SELECT granted FROM personal.source_consent WHERE person_id=p_person AND source=p_source ORDER BY version DESC LIMIT 1),false)
$$;
-- Enforced where data enters, whatever function writes it; the whole transaction rolls back.
CREATE FUNCTION personal.require_consent() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,personal,pg_temp AS $$ BEGIN
 IF NOT personal.consent_granted(NEW.person_id,TG_ARGV[0]) THEN
  RAISE EXCEPTION 'CONSENT_REQUIRED' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER consent_pdf BEFORE INSERT ON personal.pdf_intake FOR EACH ROW EXECUTE FUNCTION personal.require_consent('pdf-documents');
CREATE TRIGGER consent_pdf BEFORE INSERT ON personal.pdf_review FOR EACH ROW EXECUTE FUNCTION personal.require_consent('pdf-documents');
CREATE TRIGGER consent_import BEFORE INSERT ON personal.import_receipt FOR EACH ROW EXECUTE FUNCTION personal.require_consent('structured-import');

CREATE FUNCTION personal.api_consents(p_subject text,p_person text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,personal,pg_temp AS $$ BEGIN
 IF NOT personal.guard(p_subject,p_person,'consent_read') THEN RETURN jsonb_build_object('status','forbidden'); END IF;
 RETURN jsonb_build_object('status','ok','consents',(
  SELECT jsonb_agg(jsonb_build_object('source',s.source,
   'granted',personal.consent_granted(p_person,s.source),
   'version',coalesce((SELECT max(version) FROM personal.source_consent c WHERE c.source=s.source),0),
   'history',coalesce((SELECT jsonb_agg(jsonb_build_object('version',c.version,'granted',c.granted,'decidedBy',c.decided_by,
     'decidedAt',to_char(c.decided_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) ORDER BY c.version)
     FROM personal.source_consent c WHERE c.source=s.source),'[]'::jsonb)) ORDER BY s.source)
  FROM (VALUES('pdf-documents'),('structured-import')) s(source)));
END $$;
CREATE FUNCTION personal.api_set_consent(p_subject text,p_person text,p_source text,p_expected_version int,p_granted boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,personal,pg_temp AS $$
DECLARE current_version int; BEGIN
 IF NOT personal.guard(p_subject,p_person,'consent') THEN RETURN jsonb_build_object('status','forbidden'); END IF;
 IF p_source IS NULL OR p_source NOT IN ('pdf-documents','structured-import') OR p_granted IS NULL OR p_expected_version IS NULL
 THEN RETURN jsonb_build_object('status','invalid'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('consent|'||p_person||'|'||p_source,0));
 SELECT coalesce(max(version),0) INTO current_version FROM personal.source_consent WHERE source=p_source;
 IF current_version<>p_expected_version THEN RETURN jsonb_build_object('status','conflict','version',current_version); END IF;
 IF personal.consent_granted(p_person,p_source)=p_granted THEN RETURN jsonb_build_object('status','invalid'); END IF;
 INSERT INTO personal.source_consent VALUES(p_person,p_source,current_version+1,p_granted,p_subject,clock_timestamp());
 INSERT INTO personal.audit(subject,person_id,event,resource_id)
  VALUES(p_subject,p_person,CASE WHEN p_granted THEN 'consent_granted' ELSE 'consent_revoked' END,p_source||'#v'||(current_version+1));
 RETURN jsonb_build_object('status','ok','version',current_version+1,'granted',p_granted);
END $$;
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT p.oid::regprocedure AS sig,p.proname FROM pg_proc p WHERE pronamespace='personal'::regnamespace
  AND proname IN ('consent_granted','require_consent','api_consents','api_set_consent') LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO hc_personal_owner',r.sig);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',r.sig);
  IF r.proname LIKE 'api\_%' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO hc_personal_api',r.sig); END IF;
 END LOOP;
END $$;
