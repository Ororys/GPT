-- Allow the consultation summary export to be audited. Same function body as 001,
-- with one additional permitted event; owner and grants are preserved by REPLACE.
CREATE OR REPLACE FUNCTION personal.api_audit(p_subject text,p_event text,p_resource text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,personal,pg_temp AS $$
DECLARE p text; BEGIN
 IF p_event NOT IN ('demo_session','denied_read','read_document','export_record','import_demo','read_record','export_summary') OR length(p_resource)>100 OR length(p_subject)>100 THEN RAISE EXCEPTION 'INVALID_AUDIT'; END IF;
 SELECT person_id INTO p FROM personal.actor WHERE subject=p_subject AND active;
 INSERT INTO personal.audit(subject,person_id,event,resource_id) VALUES(p_subject,p,p_event,p_resource);
END $$;
