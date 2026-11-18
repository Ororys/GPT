-- Phone data, honest aggregation. Steps and distance are stored as the platform's own daily
-- totals (HealthKit / Health Connect deduplicate phone and watch); sleep segments carry their
-- state so that only time asleep is counted. Rows from 009 are kept as they were.
ALTER TABLE personal.device_record
 ADD COLUMN sleep_state text CHECK(sleep_state IN ('inBed','asleep','awake','rem','deep','light')),
 ADD COLUMN aggregation text NOT NULL DEFAULT 'sample' CHECK(aggregation IN ('sample','daily-total'));
ALTER TABLE personal.device_record ADD CONSTRAINT device_record_shape CHECK(
 (data_type IN ('steps','distance'))=(aggregation='daily-total')
 AND (data_type='sleep')=(sleep_state IS NOT NULL)
) NOT VALID;
CREATE OR REPLACE FUNCTION personal.api_device_import(p_subject text,p_person text,p_platform text,p_records jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,personal,pg_temp AS $$
DECLARE n int; total int; BEGIN
 IF NOT personal.guard(p_subject,p_person,'device_import') THEN RETURN jsonb_build_object('status','forbidden'); END IF;
 IF p_platform NOT IN ('healthkit','health-connect') OR jsonb_typeof(p_records)<>'array'
 OR jsonb_array_length(p_records) NOT BETWEEN 1 AND 500 THEN RETURN jsonb_build_object('status','invalid'); END IF;
 total:=jsonb_array_length(p_records);
 INSERT INTO personal.device_record(person_id,platform,data_type,record_key,start_at,end_at,value,unit,source_name,received_by,sleep_state,aggregation)
 SELECT p_person,p_platform,r->>'type',r->>'key',(r->>'start')::timestamptz,(r->>'end')::timestamptz,(r->>'value')::float8,r->>'unit',
  left(r->>'sourceName',100),p_subject,r->>'sleepState',coalesce(r->>'aggregation','sample')
 FROM jsonb_array_elements(p_records) r
 ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS n = ROW_COUNT;
 INSERT INTO personal.audit(subject,person_id,event,resource_id) VALUES(p_subject,p_person,'device_import',p_platform||'#'||n);
 RETURN jsonb_build_object('status','ok','inserted',n,'duplicates',total-n);
END $$;
-- Raw rows of the last p_days days for display aggregation (bounded).
CREATE FUNCTION personal.api_device_records(p_subject text,p_person text,p_days int) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,personal,pg_temp AS $$ BEGIN
 IF NOT personal.guard(p_subject,p_person,'device_read') THEN RETURN jsonb_build_object('status','forbidden'); END IF;
 IF p_days IS NULL OR p_days NOT BETWEEN 1 AND 400 THEN RETURN jsonb_build_object('status','invalid'); END IF;
 RETURN jsonb_build_object('status','ok','records',(SELECT coalesce(jsonb_agg(jsonb_build_object(
   'platform',platform,'type',data_type,'start',start_at,'end',end_at,'value',value,'unit',unit,
   'sleepState',sleep_state,'aggregation',aggregation,'sourceName',source_name) ORDER BY start_at),'[]'::jsonb)
  FROM (SELECT * FROM personal.device_record WHERE end_at>=clock_timestamp()-make_interval(days=>p_days)
        ORDER BY start_at DESC LIMIT 20000) d));
END $$;
ALTER FUNCTION personal.api_device_records(text,text,int) OWNER TO hc_personal_owner;
REVOKE ALL ON FUNCTION personal.api_device_records(text,text,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION personal.api_device_records(text,text,int) TO hc_personal_api;
