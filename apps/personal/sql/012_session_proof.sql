-- S-02: the database no longer has to trust the subject sent by the API role. When proof is
-- required, every guarded call must carry the signed session token (the HttpOnly cookie
-- value) in the transaction setting hc.session_proof. Its HMAC-SHA256 is checked with a key
-- the API role cannot read; subject, dossier and expiry come from the token itself.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
CREATE TABLE personal.session_key(
 id int PRIMARY KEY CHECK(id=1),
 key bytea NOT NULL CHECK(octet_length(key)>=32),
 require_proof boolean NOT NULL DEFAULT true
);
ALTER TABLE personal.session_key OWNER TO hc_personal_owner;
-- Read-only for the owner functions (guard); only the administrator (db:prepare) writes it.
ALTER TABLE personal.session_key ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal.session_key FORCE ROW LEVEL SECURITY;
CREATE POLICY key_read ON personal.session_key FOR SELECT TO hc_personal_owner USING(true);
REVOKE ALL ON personal.session_key FROM PUBLIC,hc_personal_api;

CREATE FUNCTION personal.b64url(p text) RETURNS bytea LANGUAGE sql IMMUTABLE STRICT
SET search_path=pg_catalog AS $$
 SELECT decode(translate(p,'-_','+/')||repeat('=',(4-length(p)%4)%4),'base64')
$$;
-- NULL when proof is not required; otherwise true only for a valid, unexpired token whose
-- payload names exactly this subject and dossier.
CREATE FUNCTION personal.session_proof_ok(p_subject text,p_person text) RETURNS boolean
LANGUAGE plpgsql STABLE SET search_path=pg_catalog,personal,public,pg_temp AS $$
DECLARE k personal.session_key; token text; parts text[]; payload jsonb; BEGIN
 SELECT * INTO k FROM personal.session_key WHERE id=1;
 IF k IS NULL OR NOT k.require_proof THEN RETURN NULL; END IF;
 token:=nullif(current_setting('hc.session_proof',true),'');
 IF token IS NULL OR length(token)>2000 THEN RETURN false; END IF;
 parts:=string_to_array(token,'.');
 IF cardinality(parts)<>2 THEN RETURN false; END IF;
 IF hmac(convert_to(parts[1],'UTF8'),k.key,'sha256')<>personal.b64url(parts[2]) THEN RETURN false; END IF;
 payload:=convert_from(personal.b64url(parts[1]),'UTF8')::jsonb;
 RETURN payload->>'subject'=p_subject AND payload->>'personId'=p_person
  AND (payload->>'expires')::bigint>extract(epoch from clock_timestamp())*1000;
EXCEPTION WHEN others THEN RETURN false;
END $$;
-- Same guard as 001, with the proof check added before scope is set.
CREATE OR REPLACE FUNCTION personal.guard(p_subject text,p_person text,p_event text) RETURNS boolean
LANGUAGE plpgsql SET search_path=pg_catalog,personal,pg_temp AS $$ BEGIN
 PERFORM set_config('hc.personal_scope','',true);
 IF NOT EXISTS(SELECT 1 FROM personal.actor WHERE subject=p_subject AND person_id=p_person AND active)
 OR personal.session_proof_ok(p_subject,p_person) IS FALSE THEN
  INSERT INTO personal.audit(subject,person_id,event,resource_id) VALUES(left(coalesce(p_subject,'anonymous'),100),NULL,'denied_'||p_event,'personal-record');
  RETURN false;
 END IF;
 PERFORM set_config('hc.personal_scope',p_person,true); RETURN true;
END $$;
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p WHERE pronamespace='personal'::regnamespace
  AND proname IN ('b64url','session_proof_ok') LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO hc_personal_owner',r.sig);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',r.sig);
 END LOOP;
END $$;
