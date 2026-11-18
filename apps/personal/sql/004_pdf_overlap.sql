-- Non-blocking signal: for each eligible candidate of a staged PDF, list observations already
-- in the dossier for the same parameter on the same UTC day, from another document.
-- Computed at read time (other documents may arrive later); nothing is stored, merged or chosen.
CREATE FUNCTION personal.api_pdf_overlaps(p_subject text,p_person text,p_sha text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,personal,pg_temp AS $$
DECLARE proposal jsonb; BEGIN
 IF NOT personal.guard(p_subject,p_person,'pdf_read') THEN RETURN jsonb_build_object('status','forbidden'); END IF;
 SELECT i.proposal INTO proposal FROM personal.pdf_intake i WHERE i.sha256=p_sha;
 IF proposal IS NULL THEN RETURN jsonb_build_object('status','not_found'); END IF;
 RETURN jsonb_build_object('status','ok','overlaps',(
  SELECT coalesce(jsonb_agg(jsonb_build_object('candidateId',c->>'id','matches',m.matches) ORDER BY c->>'id'),'[]'::jsonb)
  FROM jsonb_array_elements(proposal->'candidates') c
  CROSS JOIN LATERAL (
   SELECT jsonb_agg(jsonb_build_object(
     'observationId',o.id,'documentId',o.document_id,'documentTitle',d.payload->>'title',
     'value',coalesce((SELECT x.value FROM personal.observation_correction x WHERE x.observation_id=o.id ORDER BY x.version DESC LIMIT 1),(o.payload->>'value')::float8),
     'unit',o.unit) ORDER BY o.document_id,o.id) matches
   FROM personal.observation o JOIN personal.document d ON d.id=o.document_id
   WHERE o.code=c->>'code' AND o.document_id<>'pdf-'||p_sha
   AND (o.measured_at AT TIME ZONE 'UTC')::date=((c->'observation'->>'measuredAt')::timestamptz AT TIME ZONE 'UTC')::date
  ) m
  WHERE jsonb_typeof(c->'observation')='object' AND m.matches IS NOT NULL));
END $$;
ALTER FUNCTION personal.api_pdf_overlaps(text,text,text) OWNER TO hc_personal_owner;
REVOKE ALL ON FUNCTION personal.api_pdf_overlaps(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION personal.api_pdf_overlaps(text,text,text) TO hc_personal_api;
