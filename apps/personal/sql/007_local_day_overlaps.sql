-- C-01 local-day rule for the cross-document signal: an instant belongs to the calendar day
-- of the dossier's IANA zone (record metadata timeZone, Europe/Paris when absent); a value
-- known only to the day keeps its calendar date. Same rule as modules/observations/time.ts.
CREATE FUNCTION personal.local_day(p_at timestamptz,p_precision text,p_zone text) RETURNS date
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT CASE WHEN p_precision='day' THEN (p_at AT TIME ZONE 'UTC')::date ELSE (p_at AT TIME ZONE p_zone)::date END
$$;
CREATE OR REPLACE FUNCTION personal.api_pdf_overlaps(p_subject text,p_person text,p_sha text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,personal,pg_temp AS $$
DECLARE proposal jsonb; zone text; BEGIN
 IF NOT personal.guard(p_subject,p_person,'pdf_read') THEN RETURN jsonb_build_object('status','forbidden'); END IF;
 SELECT i.proposal INTO proposal FROM personal.pdf_intake i WHERE i.sha256=p_sha;
 IF proposal IS NULL THEN RETURN jsonb_build_object('status','not_found'); END IF;
 SELECT coalesce(r.metadata->>'timeZone','Europe/Paris') INTO zone FROM personal.record r;
 IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=zone) THEN zone:='Europe/Paris'; END IF;
 RETURN jsonb_build_object('status','ok','timeZone',zone,'overlaps',(
  SELECT coalesce(jsonb_agg(jsonb_build_object('candidateId',c->>'id','matches',m.matches) ORDER BY c->>'id'),'[]'::jsonb)
  FROM jsonb_array_elements(proposal->'candidates') c
  CROSS JOIN LATERAL (
   SELECT jsonb_agg(jsonb_build_object(
     'observationId',o.id,'documentId',o.document_id,'documentTitle',d.payload->>'title',
     'value',coalesce((SELECT x.value FROM personal.observation_correction x WHERE x.observation_id=o.id ORDER BY x.version DESC LIMIT 1),(o.payload->>'value')::float8),
     'unit',o.unit) ORDER BY o.document_id,o.id) matches
   FROM personal.observation o JOIN personal.document d ON d.id=o.document_id
   WHERE o.code=c->>'code' AND o.document_id<>'pdf-'||p_sha
   AND personal.local_day(o.measured_at,o.payload->>'measuredPrecision',zone)
     =personal.local_day((c->'observation'->>'measuredAt')::timestamptz,c->'observation'->>'measuredPrecision',zone)
  ) m
  WHERE jsonb_typeof(c->'observation')='object' AND m.matches IS NOT NULL));
END $$;
ALTER FUNCTION personal.local_day(timestamptz,text,text) OWNER TO hc_personal_owner;
REVOKE ALL ON FUNCTION personal.local_day(timestamptz,text,text) FROM PUBLIC;
