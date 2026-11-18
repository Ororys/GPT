-- Right of access / portability: everything stored about one dossier, beyond what the pages
-- display. Read-only, guarded and scoped by RLS like every other API function.
CREATE FUNCTION personal.api_export_extras(p_subject text,p_person text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,personal,pg_temp AS $$ BEGIN
 IF NOT personal.guard(p_subject,p_person,'export') THEN RETURN jsonb_build_object('status','forbidden'); END IF;
 RETURN jsonb_build_object('status','ok',
  'identities',(SELECT coalesce(jsonb_agg(jsonb_build_object('subject',subject,'active',active) ORDER BY subject),'[]'::jsonb)
    FROM personal.actor WHERE person_id=p_person),
  'consents',(SELECT coalesce(jsonb_agg(jsonb_build_object('source',source,'version',version,'granted',granted,
    'decidedBy',decided_by,'decidedAt',decided_at) ORDER BY source,version),'[]'::jsonb) FROM personal.source_consent),
  'pdfIntakes',(SELECT coalesce(jsonb_agg(jsonb_build_object('sha256',i.sha256,'receivedAt',i.received_at,
    'reviewedSelection',r.selected_ids,'reviewedBy',r.reviewed_by,'reviewedAt',r.reviewed_at,'proposal',i.proposal)
    ORDER BY i.received_at),'[]'::jsonb)
    FROM personal.pdf_intake i LEFT JOIN personal.pdf_review r USING(person_id,sha256)),
  'importReceipts',(SELECT coalesce(jsonb_agg(jsonb_build_object('batchId',batch_id,'sha256',sha256,'importedAt',imported_at)
    ORDER BY imported_at),'[]'::jsonb) FROM personal.import_receipt),
  'deviceRecords',(SELECT coalesce(jsonb_agg(jsonb_build_object('platform',platform,'type',data_type,'start',start_at,
    'end',end_at,'value',value,'unit',unit,'sleepState',sleep_state,'aggregation',aggregation,'sourceName',source_name,
    'receivedAt',received_at) ORDER BY start_at),'[]'::jsonb) FROM personal.device_record),
  'activityLog',(SELECT coalesce(jsonb_agg(jsonb_build_object('at',at,'subject',subject,'event',event,'resource',resource_id)
    ORDER BY at),'[]'::jsonb) FROM personal.audit WHERE person_id=p_person));
END $$;
ALTER FUNCTION personal.api_export_extras(text,text) OWNER TO hc_personal_owner;
REVOKE ALL ON FUNCTION personal.api_export_extras(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION personal.api_export_extras(text,text) TO hc_personal_api;
