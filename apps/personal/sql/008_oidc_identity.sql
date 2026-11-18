-- Real sign-in (OIDC). A verified identity is resolved to a dossier only through an active
-- personal.actor row, created by a controlled enrolment (scripts/link-identity.ts); there is
-- no automatic enrolment. The subject is a hash of issuer and provider identifier.
-- One dossier may have several identities (demo subject, real sign-in): lift uniqueness.
DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='personal.actor'::regclass AND contype='u' LOOP
  EXECUTE format('ALTER TABLE personal.actor DROP CONSTRAINT %I',c.conname);
 END LOOP;
END $$;
CREATE INDEX actor_person ON personal.actor(person_id);
CREATE FUNCTION personal.api_identity_person(p_subject text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,personal,pg_temp AS $$
DECLARE p text; BEGIN
 IF p_subject IS NULL OR p_subject !~ '^oidc:[A-Za-z0-9_-]{43}$' THEN RETURN jsonb_build_object('status','invalid'); END IF;
 SELECT person_id INTO p FROM personal.actor WHERE subject=p_subject AND active;
 IF p IS NULL THEN
  INSERT INTO personal.audit(subject,person_id,event,resource_id) VALUES(p_subject,NULL,'oidc_not_enrolled','personal-record');
  RETURN jsonb_build_object('status','not_enrolled');
 END IF;
 INSERT INTO personal.audit(subject,person_id,event,resource_id) VALUES(p_subject,p,'oidc_login',p);
 RETURN jsonb_build_object('status','ok','personId',p);
END $$;
ALTER FUNCTION personal.api_identity_person(text) OWNER TO hc_personal_owner;
REVOKE ALL ON FUNCTION personal.api_identity_person(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION personal.api_identity_person(text) TO hc_personal_api;
-- Audit events written by the application: add sign-in refusals and sign-out.
CREATE OR REPLACE FUNCTION personal.api_audit(p_subject text,p_event text,p_resource text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,personal,pg_temp AS $$
DECLARE p text; BEGIN
 IF p_event NOT IN ('demo_session','denied_read','read_document','export_record','import_demo','read_record','export_summary','oidc_denied','logout') OR length(p_resource)>100 OR length(p_subject)>100 THEN RAISE EXCEPTION 'INVALID_AUDIT'; END IF;
 SELECT person_id INTO p FROM personal.actor WHERE subject=p_subject AND active;
 INSERT INTO personal.audit(subject,person_id,event,resource_id) VALUES(p_subject,p,p_event,p_resource);
END $$;
