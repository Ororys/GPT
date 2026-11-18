-- Health data read on the phone (Apple Health / Health Connect) by the mobile app.
-- Stored as received, append-only and idempotent, under its own explicit permission
-- ('device-health', never granted by the seed). Not merged into the existing sleep or
-- activity series: how to present them is a separate product decision.
ALTER TABLE personal.source_consent DROP CONSTRAINT IF EXISTS source_consent_source_check;
ALTER TABLE personal.source_consent ADD CONSTRAINT source_consent_source_check
 CHECK(source IN ('pdf-documents','structured-import','device-health'));
CREATE TABLE personal.device_record(
 person_id text NOT NULL REFERENCES personal.record(person_id),
 platform text NOT NULL CHECK(platform IN ('healthkit','health-connect')),
 data_type text NOT NULL CHECK(data_type IN ('sleep','restingHeartRate','heartRateVariability','steps','distance')),
 record_key text NOT NULL CHECK(record_key ~ '^[A-Za-z0-9_-]{43}$'),
 start_at timestamptz NOT NULL, end_at timestamptz NOT NULL CHECK(end_at>=start_at),
 value double precision NOT NULL CHECK(value>=0 AND value<1e7 AND value<>'NaN'::float8),
 unit text NOT NULL CHECK(unit IN ('minute','bpm','millisecond','count','meter')),
 source_name text CHECK(char_length(source_name)<=100),
 received_by text NOT NULL,
 received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(person_id,platform,data_type,record_key)
);
CREATE INDEX device_record_series ON personal.device_record(person_id,data_type,start_at);
ALTER TABLE personal.device_record OWNER TO hc_personal_owner;
ALTER TABLE personal.device_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal.device_record FORCE ROW LEVEL SECURITY;
CREATE POLICY scoped ON personal.device_record TO hc_personal_owner
 USING(person_id=personal.scope()) WITH CHECK(person_id=personal.scope());
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON personal.device_record FOR EACH ROW EXECUTE FUNCTION personal.reject_mutation();
CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON personal.device_record FOR EACH STATEMENT EXECUTE FUNCTION personal.reject_mutation();
CREATE TRIGGER consent_device BEFORE INSERT ON personal.device_record FOR EACH ROW EXECUTE FUNCTION personal.require_consent('device-health');
REVOKE ALL ON personal.device_record FROM PUBLIC,hc_personal_api;

-- p_records: [{type,key,start,end,value,unit,sourceName}], validated by the app and again here.
CREATE FUNCTION personal.api_device_import(p_subject text,p_person text,p_platform text,p_records jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,personal,pg_temp AS $$
DECLARE n int; total int; BEGIN
 IF NOT personal.guard(p_subject,p_person,'device_import') THEN RETURN jsonb_build_object('status','forbidden'); END IF;
 IF p_platform NOT IN ('healthkit','health-connect') OR jsonb_typeof(p_records)<>'array'
 OR jsonb_array_length(p_records) NOT BETWEEN 1 AND 500 THEN RETURN jsonb_build_object('status','invalid'); END IF;
 total:=jsonb_array_length(p_records);
 INSERT INTO personal.device_record(person_id,platform,data_type,record_key,start_at,end_at,value,unit,source_name,received_by)
 SELECT p_person,p_platform,r->>'type',r->>'key',(r->>'start')::timestamptz,(r->>'end')::timestamptz,(r->>'value')::float8,r->>'unit',left(r->>'sourceName',100),p_subject
 FROM jsonb_array_elements(p_records) r
 ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS n = ROW_COUNT;
 INSERT INTO personal.audit(subject,person_id,event,resource_id) VALUES(p_subject,p_person,'device_import',p_platform||'#'||n);
 RETURN jsonb_build_object('status','ok','inserted',n,'duplicates',total-n);
END $$;
CREATE FUNCTION personal.api_device_summary(p_subject text,p_person text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,personal,pg_temp AS $$ BEGIN
 IF NOT personal.guard(p_subject,p_person,'device_read') THEN RETURN jsonb_build_object('status','forbidden'); END IF;
 RETURN jsonb_build_object('status','ok','series',(SELECT coalesce(jsonb_agg(jsonb_build_object(
   'platform',platform,'type',data_type,'count',n,
   'first',to_char(f AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
   'last',to_char(l AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
   'receivedAt',to_char(r AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"')) ORDER BY platform,data_type),'[]'::jsonb)
  FROM (SELECT platform,data_type,count(*) n,min(start_at) f,max(start_at) l,max(received_at) r
        FROM personal.device_record GROUP BY platform,data_type) s));
END $$;
-- Same bodies as 006, with the new source added.
CREATE OR REPLACE FUNCTION personal.api_consents(p_subject text,p_person text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,personal,pg_temp AS $$ BEGIN
 IF NOT personal.guard(p_subject,p_person,'consent_read') THEN RETURN jsonb_build_object('status','forbidden'); END IF;
 RETURN jsonb_build_object('status','ok','consents',(
  SELECT jsonb_agg(jsonb_build_object('source',s.source,
   'granted',personal.consent_granted(p_person,s.source),
   'version',coalesce((SELECT max(version) FROM personal.source_consent c WHERE c.source=s.source),0),
   'history',coalesce((SELECT jsonb_agg(jsonb_build_object('version',c.version,'granted',c.granted,'decidedBy',c.decided_by,
     'decidedAt',to_char(c.decided_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) ORDER BY c.version)
     FROM personal.source_consent c WHERE c.source=s.source),'[]'::jsonb)) ORDER BY s.source)
  FROM (VALUES('device-health'),('pdf-documents'),('structured-import')) s(source)));
END $$;
CREATE OR REPLACE FUNCTION personal.api_set_consent(p_subject text,p_person text,p_source text,p_expected_version int,p_granted boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,personal,pg_temp AS $$
DECLARE current_version int; BEGIN
 IF NOT personal.guard(p_subject,p_person,'consent') THEN RETURN jsonb_build_object('status','forbidden'); END IF;
 IF p_source IS NULL OR p_source NOT IN ('pdf-documents','structured-import','device-health') OR p_granted IS NULL OR p_expected_version IS NULL
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
 FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p WHERE pronamespace='personal'::regnamespace
  AND proname IN ('api_device_import','api_device_summary') LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO hc_personal_owner',r.sig);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',r.sig);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO hc_personal_api',r.sig);
 END LOOP;
END $$;
