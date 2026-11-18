-- Preserve the unit read from the PDF; normalize only the Unicode micro-sign spelling.
DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='personal.observation'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%originalUnit%' LOOP
  EXECUTE format('ALTER TABLE personal.observation DROP CONSTRAINT %I',c.conname);
 END LOOP;
END $$;
ALTER TABLE personal.observation ADD CONSTRAINT observation_payload_provenance CHECK(
 payload->>'id'=id AND payload->>'personId'=person_id AND payload->>'synthetic'='true'
 AND payload->>'sourceId'=document_id AND payload->'evidence'->>'documentId'=document_id
 AND payload->>'code'=code AND payload->>'unit'=unit
 AND payload->'value'=payload->'evidence'->'originalValue'
 AND payload->>'unit'=replace(payload->'evidence'->>'originalUnit','μ','µ')
);
-- Native PDF demo intake and explicit selection. Does not alter the existing organization.
CREATE TABLE personal.pdf_fixture(id text PRIMARY KEY,sha256 text NOT NULL UNIQUE CHECK(sha256~'^[a-f0-9]{64}$'),person_id text NOT NULL CHECK(person_id IN ('demo-alpha','demo-beta')));
CREATE TABLE personal.pdf_intake(
 person_id text NOT NULL REFERENCES personal.record(person_id),sha256 text NOT NULL REFERENCES personal.pdf_fixture(sha256),
 bytes bytea NOT NULL CHECK(octet_length(bytes) BETWEEN 1 AND 500000),proposal jsonb NOT NULL,
 received_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(person_id,sha256),
 CHECK(encode(sha256(bytes),'hex')=sha256),
 CHECK(proposal->>'sha256'=sha256 AND proposal->'document'->>'personId'=person_id AND proposal->>'method'='pdf-native-v1')
);
CREATE TABLE personal.pdf_review(
 person_id text NOT NULL,sha256 text NOT NULL,selected_ids text[] NOT NULL,
 reviewed_by text NOT NULL,reviewed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(person_id,sha256),FOREIGN KEY(person_id,sha256) REFERENCES personal.pdf_intake(person_id,sha256)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['pdf_fixture','pdf_intake','pdf_review'] LOOP
  EXECUTE format('ALTER TABLE personal.%I OWNER TO hc_personal_owner',t);
  EXECUTE format('ALTER TABLE personal.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE personal.%I FORCE ROW LEVEL SECURITY',t);
  IF t='pdf_fixture' THEN EXECUTE 'CREATE POLICY reference_read ON personal.pdf_fixture FOR SELECT TO hc_personal_owner USING(true)';
  ELSE EXECUTE format('CREATE POLICY scoped ON personal.%I TO hc_personal_owner USING(person_id=personal.scope()) WITH CHECK(person_id=personal.scope())',t); END IF;
  EXECUTE format('CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON personal.%I FOR EACH ROW EXECUTE FUNCTION personal.reject_mutation()',t);
  EXECUTE format('CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON personal.%I FOR EACH STATEMENT EXECUTE FUNCTION personal.reject_mutation()',t);
 END LOOP;
END $$;
CREATE FUNCTION personal.api_stage_pdf(p_subject text,p_person text,p_sha text,p_hex text,p_proposal jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,personal,pg_temp AS $$
DECLARE proposal jsonb; BEGIN
 IF NOT personal.guard(p_subject,p_person,'pdf_stage') THEN RETURN jsonb_build_object('status','forbidden'); END IF;
 IF NOT EXISTS(SELECT 1 FROM personal.pdf_fixture WHERE sha256=p_sha AND person_id=p_person)
 OR length(p_hex)>1000000 OR p_hex IS NULL OR p_proposal IS NULL
 OR p_proposal->>'id' IS DISTINCT FROM 'pdf-'||p_sha OR p_proposal->>'sha256' IS DISTINCT FROM p_sha
 OR p_proposal->'document'->>'id' IS DISTINCT FROM 'pdf-'||p_sha
 OR p_proposal->'document'->>'synthetic' IS DISTINCT FROM 'true'
 OR p_proposal->'document'->>'personId' IS DISTINCT FROM p_person
 OR p_proposal->>'method' IS DISTINCT FROM 'pdf-native-v1'
 THEN RETURN jsonb_build_object('status','invalid'); END IF;
 INSERT INTO personal.pdf_intake VALUES(p_person,p_sha,decode(p_hex,'hex'),p_proposal,clock_timestamp()) ON CONFLICT DO NOTHING;
 SELECT i.proposal INTO proposal FROM personal.pdf_intake i WHERE i.sha256=p_sha;
 INSERT INTO personal.audit(subject,person_id,event,resource_id) VALUES(p_subject,p_person,'stage_pdf','pdf-'||p_sha);
 RETURN jsonb_build_object('status','ok','proposal',proposal,'reviewed',EXISTS(SELECT 1 FROM personal.pdf_review WHERE sha256=p_sha));
END $$;
CREATE FUNCTION personal.api_pdf_intake(p_subject text,p_person text,p_sha text,p_bytes boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,personal,pg_temp AS $$
DECLARE v jsonb; BEGIN
 IF NOT personal.guard(p_subject,p_person,'pdf_read') THEN RETURN jsonb_build_object('status','forbidden'); END IF;
 SELECT CASE WHEN p_bytes THEN jsonb_build_object('hex',encode(bytes,'hex')) ELSE jsonb_build_object('proposal',proposal) END INTO v FROM personal.pdf_intake WHERE sha256=p_sha;
 IF v IS NULL THEN RETURN jsonb_build_object('status','not_found'); END IF;
 RETURN v||jsonb_build_object('status','ok','reviewed',EXISTS(SELECT 1 FROM personal.pdf_review WHERE sha256=p_sha));
END $$;
CREATE FUNCTION personal.api_confirm_pdf(p_subject text,p_person text,p_sha text,p_selected text[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,personal,pg_temp AS $$
DECLARE proposal jsonb; d jsonb; c jsonb; o jsonb; canonical text[]; existing text[]; n int:=0; BEGIN
 IF NOT personal.guard(p_subject,p_person,'pdf_confirm') THEN RETURN jsonb_build_object('status','forbidden'); END IF;
 IF p_selected IS NULL OR cardinality(p_selected) NOT BETWEEN 1 AND 30 THEN RETURN jsonb_build_object('status','invalid'); END IF;
 SELECT array_agg(x ORDER BY x) INTO canonical FROM unnest(p_selected) x;
 IF (SELECT count(DISTINCT x) FROM unnest(p_selected) x)<>cardinality(p_selected) THEN RETURN jsonb_build_object('status','invalid'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('pdf|'||p_person||'|'||p_sha,0));
 SELECT i.proposal INTO proposal FROM personal.pdf_intake i WHERE i.sha256=p_sha;
 IF proposal IS NULL THEN RETURN jsonb_build_object('status','not_found'); END IF;
 SELECT selected_ids INTO existing FROM personal.pdf_review WHERE sha256=p_sha;
 IF FOUND THEN RETURN jsonb_build_object('status',CASE WHEN existing=canonical THEN 'ok' ELSE 'conflict' END,'inserted',0,'duplicates',1); END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(proposal->'candidates') x WHERE x->>'id'=ANY(p_selected) AND x->>'eligible'='true' AND jsonb_typeof(x->'observation')='object')<>cardinality(p_selected) THEN RETURN jsonb_build_object('status','invalid'); END IF;
 d:=proposal->'document';
 INSERT INTO personal.document VALUES(p_person,d->>'id',(d->>'date')::timestamptz,(d->>'knownAt')::timestamptz,d);
 FOR c IN SELECT * FROM jsonb_array_elements(proposal->'candidates') x WHERE x->>'id'=ANY(p_selected) LOOP
  o:=c->'observation';
  INSERT INTO personal.observation VALUES(p_person,o->>'id',o->>'sourceId',o->>'code',o->>'unit',(o->>'measuredAt')::timestamptz,(o->>'knownAt')::timestamptz,o);
  n:=n+1;
 END LOOP;
 INSERT INTO personal.pdf_review VALUES(p_person,p_sha,canonical,p_subject,clock_timestamp());
 INSERT INTO personal.audit(subject,person_id,event,resource_id) VALUES(p_subject,p_person,'confirm_pdf',d->>'id');
 RETURN jsonb_build_object('status','ok','inserted',n,'duplicates',0);
END $$;
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p WHERE pronamespace='personal'::regnamespace AND proname IN ('api_stage_pdf','api_pdf_intake','api_confirm_pdf') LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO hc_personal_owner',r.sig);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',r.sig);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO hc_personal_api',r.sig);
 END LOOP;
END $$;
REVOKE ALL ON personal.pdf_fixture,personal.pdf_intake,personal.pdf_review FROM PUBLIC,hc_personal_api;
