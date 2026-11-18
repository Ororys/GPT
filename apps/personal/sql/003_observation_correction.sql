-- Versioned correction of values read from a native PDF. Additive: the observation row,
-- its original value and its source text are never modified. Each correction is a new
-- immutable version with a mandatory reason; the read model exposes the value in force
-- plus the full history so the original and every step remain visible.
CREATE TABLE personal.observation_correction(
 person_id text NOT NULL,
 observation_id text NOT NULL,
 version int NOT NULL CHECK(version BETWEEN 1 AND 50),
 value double precision NOT NULL CHECK(value>=0 AND value<1e9 AND value<>'NaN'::float8),
 unit text NOT NULL,
 reason text NOT NULL CHECK(char_length(btrim(reason)) BETWEEN 3 AND 300),
 corrected_by text NOT NULL,
 corrected_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(person_id,observation_id,version),
 FOREIGN KEY(person_id,observation_id) REFERENCES personal.observation(person_id,id)
);
ALTER TABLE personal.observation_correction OWNER TO hc_personal_owner;
ALTER TABLE personal.observation_correction ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal.observation_correction FORCE ROW LEVEL SECURITY;
CREATE POLICY scoped ON personal.observation_correction TO hc_personal_owner
 USING(person_id=personal.scope()) WITH CHECK(person_id=personal.scope());
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON personal.observation_correction
 FOR EACH ROW EXECUTE FUNCTION personal.reject_mutation();
CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON personal.observation_correction
 FOR EACH STATEMENT EXECUTE FUNCTION personal.reject_mutation();
REVOKE ALL ON personal.observation_correction FROM PUBLIC,hc_personal_api;

-- p_expected_version is the version the caller reviewed (0 = original): a stale form is refused.
CREATE FUNCTION personal.api_correct_observation(p_subject text,p_person text,p_observation text,p_expected_version int,p_value double precision,p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,personal,pg_temp AS $$
DECLARE o jsonb; current_version int; current_value double precision; BEGIN
 IF NOT personal.guard(p_subject,p_person,'correct') THEN RETURN jsonb_build_object('status','forbidden'); END IF;
 IF p_observation IS NULL OR p_expected_version IS NULL OR p_value IS NULL OR p_reason IS NULL
 OR p_value<0 OR p_value>=1e9 OR p_value='NaN'::float8 OR char_length(btrim(p_reason)) NOT BETWEEN 3 AND 300
 THEN RETURN jsonb_build_object('status','invalid'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('correct|'||p_person||'|'||p_observation,0));
 SELECT payload INTO o FROM personal.observation WHERE id=p_observation;
 IF o IS NULL THEN RETURN jsonb_build_object('status','not_found'); END IF;
 -- Only values read from a PDF can be corrected; synthetic or imported series are not edited.
 IF o->'evidence'->>'method' IS DISTINCT FROM 'native-pdf' THEN RETURN jsonb_build_object('status','invalid'); END IF;
 SELECT coalesce(max(version),0) INTO current_version FROM personal.observation_correction WHERE observation_id=p_observation;
 IF current_version<>p_expected_version THEN RETURN jsonb_build_object('status','conflict','version',current_version); END IF;
 SELECT coalesce((SELECT value FROM personal.observation_correction WHERE observation_id=p_observation AND version=current_version),(o->'evidence'->>'originalValue')::float8) INTO current_value;
 IF current_value=p_value THEN RETURN jsonb_build_object('status','invalid'); END IF;
 INSERT INTO personal.observation_correction VALUES(p_person,p_observation,current_version+1,p_value,o->>'unit',btrim(p_reason),p_subject,clock_timestamp());
 INSERT INTO personal.audit(subject,person_id,event,resource_id) VALUES(p_subject,p_person,'correct_observation',p_observation||'#v'||(current_version+1));
 RETURN jsonb_build_object('status','ok','version',current_version+1);
END $$;

-- Same record as 001, observations overlaid with the value in force and their history.
CREATE OR REPLACE FUNCTION personal.api_get_record(p_subject text,p_person text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,personal,pg_temp AS $$
DECLARE r jsonb; BEGIN
 IF NOT personal.guard(p_subject,p_person,'read') THEN RETURN jsonb_build_object('status','forbidden'); END IF;
 SELECT metadata INTO r FROM personal.record;
 IF r IS NULL THEN RETURN jsonb_build_object('status','not_found'); END IF;
 r:=r||jsonb_build_object('storage','postgresql',
 'biomarkers',(SELECT coalesce(jsonb_agg(payload ORDER BY code),'[]'::jsonb) FROM personal.biomarker),
 'documents',(SELECT coalesce(jsonb_agg(payload ORDER BY measured_at,id),'[]'::jsonb) FROM personal.document),
 'observations',(SELECT coalesce(jsonb_agg(
   CASE WHEN h.history IS NULL THEN o.payload
   ELSE o.payload||jsonb_build_object('value',h.history->-1->'value','corrections',h.history) END
   ORDER BY o.measured_at,o.id),'[]'::jsonb)
  FROM personal.observation o
  LEFT JOIN LATERAL (SELECT jsonb_agg(jsonb_build_object('version',c.version,'value',c.value,'unit',c.unit,'reason',c.reason,
    'correctedBy',c.corrected_by,'correctedAt',to_char(c.corrected_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) ORDER BY c.version) history
   FROM personal.observation_correction c WHERE c.observation_id=o.id) h ON true),
 'activities',(SELECT coalesce(jsonb_agg(payload ORDER BY measured_at DESC,id),'[]'::jsonb) FROM personal.activity),
 'sleep',(SELECT coalesce(jsonb_agg(payload ORDER BY measured_at DESC,id),'[]'::jsonb) FROM personal.sleep_session),
 'events',(SELECT coalesce(jsonb_agg(payload ORDER BY measured_at DESC,id),'[]'::jsonb) FROM personal.life_event));
 INSERT INTO personal.audit(subject,person_id,event,resource_id) VALUES(p_subject,p_person,'read_record',p_person);
 RETURN jsonb_build_object('status','ok','record',r);
END $$;

ALTER FUNCTION personal.api_correct_observation(text,text,text,int,double precision,text) OWNER TO hc_personal_owner;
REVOKE ALL ON FUNCTION personal.api_correct_observation(text,text,text,int,double precision,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION personal.api_correct_observation(text,text,text,int,double precision,text) TO hc_personal_api;
ALTER FUNCTION personal.api_get_record(text,text) OWNER TO hc_personal_owner;
REVOKE ALL ON FUNCTION personal.api_get_record(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION personal.api_get_record(text,text) TO hc_personal_api;
