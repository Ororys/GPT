-- v3.0 — Frontière d'API : seules ces fonctions SECURITY DEFINER sont exécutables par hc_api.
-- Elles appartiennent à hc_owner (non superutilisateur, soumis à la RLS forcée).
-- Convention : aucune exception pour un refus — la fonction retourne {"status":"forbidden"} APRÈS avoir
-- journalisé le refus, ce qui rend l'audit des refus durable (il était annulé par le RAISE en v1.5).
-- p_subject provient d'un jeton vérifié par l'API ; il n'est JAMAIS lu depuis le corps ou un en-tête libre.
BEGIN;

CREATE FUNCTION hc.iso_utc(t timestamptz) RETURNS text LANGUAGE sql IMMUTABLE
AS $$ SELECT to_char(t AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') $$;

-- Décision d'accès centrale. Actions : read | export | read_audit | manage_connections | import_wearable | write_measurement
CREATE FUNCTION hc.authz(p_subject text,p_person uuid,p_action text) RETURNS boolean
LANGUAGE sql STABLE SET search_path=pg_catalog,hc,pg_temp AS $$
 SELECT EXISTS(
  SELECT 1 FROM hc.actor a JOIN hc.person p ON p.id=p_person
  WHERE a.external_subject=p_subject AND a.active AND p.synthetic AND (
   (a.actor_kind='patient'
     AND p_action IN ('read','export','read_audit','manage_connections','import_wearable')
     AND EXISTS(SELECT 1 FROM hc.patient_actor pa WHERE pa.actor_id=a.id AND pa.person_id=p_person))
   OR (a.actor_kind IN ('ide','physician') AND EXISTS(
     SELECT 1 FROM hc.care_access_grant g
     WHERE g.actor_id=a.id AND g.person_id=p_person AND g.revoked_at IS NULL
       AND g.valid_from<=now() AND now()<g.valid_until
       AND ( (p_action IN ('read','export') AND g.purpose='clinical_care')
          OR (p_action='write_measurement' AND (g.purpose='measurements' OR (a.actor_kind='physician' AND g.purpose='clinical_care'))) )))
  ));
$$;

CREATE FUNCTION hc.audit(p_subject text,p_person uuid,p_event text,p_details jsonb) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog,hc,pg_temp AS $$
BEGIN
 INSERT INTO hc.access_audit(subject_id,actor_ref,event_type,details)
 VALUES ((SELECT id FROM hc.person WHERE id=p_person), left(coalesce(p_subject,'?'),180), p_event,
         coalesce(p_details,'{}'::jsonb) || CASE WHEN p_person IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('person',p_person) END);
END $$;

-- Garde commune : autorise, journalise le refus, place la personne en portée RLS de la transaction.
CREATE FUNCTION hc.guard(p_subject text,p_person uuid,p_action text) RETURNS boolean
LANGUAGE plpgsql SET search_path=pg_catalog,hc,pg_temp AS $$
BEGIN
 PERFORM set_config('hc.person_scope','',true);
 IF p_subject IS NULL OR length(p_subject) NOT BETWEEN 3 AND 180 OR p_person IS NULL OR NOT hc.authz(p_subject,p_person,p_action) THEN
  PERFORM hc.audit(p_subject,p_person,'denied_'||p_action,'{}'::jsonb);
  RETURN false;
 END IF;
 PERFORM set_config('hc.person_scope',p_person::text,true);
 RETURN true;
END $$;

CREATE FUNCTION hc.observation_json(o hc.observation,pr hc.observation_provenance) RETURNS jsonb
LANGUAGE sql STABLE SET search_path=pg_catalog,hc,pg_temp AS $$
 SELECT jsonb_build_object('id',o.id,'person_id',o.person_id,'metric_code',o.metric_code,'method_code',o.method_code,
  'value',o.value_canonical,'unit',o.unit_canonical,'original_value',o.original_value,'original_unit',o.original_unit,
  'measured_at',hc.iso_utc(o.measured_at),'interval_end_at',CASE WHEN o.interval_end_at IS NULL THEN NULL ELSE hc.iso_utc(o.interval_end_at) END,
  'original_timezone',o.original_timezone,'source_namespace',pr.source_namespace,'source_record_id',pr.source_record_id,
  'source_device',o.source_device,'synthetic',o.synthetic,'quality_state',o.quality_state);
$$;

CREATE FUNCTION hc.api_whoami(p_subject text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,hc,pg_temp AS $$
DECLARE v_actor hc.actor; v_patients jsonb;
BEGIN
 SELECT * INTO v_actor FROM hc.actor WHERE external_subject=p_subject AND active;
 IF NOT FOUND THEN PERFORM hc.audit(p_subject,NULL,'denied_whoami','{}'::jsonb); RETURN jsonb_build_object('status','forbidden'); END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'alias',p.alias,'permissions',
   (SELECT jsonb_agg(x) FROM unnest(ARRAY['read','export','read_audit','manage_connections','import_wearable','write_measurement']) x WHERE hc.authz(p_subject,p.id,x))) ORDER BY p.alias),'[]'::jsonb)
 INTO v_patients FROM hc.person p
 WHERE hc.authz(p_subject,p.id,'read') OR hc.authz(p_subject,p.id,'write_measurement');
 RETURN jsonb_build_object('status','ok','subject',p_subject,'actor_kind',v_actor.actor_kind,'patients',v_patients);
END $$;

CREATE FUNCTION hc.api_metric_registry() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,hc,pg_temp AS $$
 SELECT jsonb_build_object('status','ok','metrics',(SELECT jsonb_agg(jsonb_build_object('metric_code',d.metric_code,'label',d.label_fr,'unit',d.canonical_unit,
   'series_kind',d.series_kind,'plausible_min',d.plausible_min,'plausible_max',d.plausible_max,'integer_only',d.integer_only,'registry_version',d.registry_version,
   'methods',(SELECT jsonb_agg(m.method_code ORDER BY m.method_code) FROM hc.metric_method m WHERE m.metric_code=d.metric_code)) ORDER BY d.metric_code) FROM hc.metric_definition d),
  'namespaces',(SELECT jsonb_agg(jsonb_build_object('namespace',n.namespace,'provider',n.provider,'importer_kinds',n.importer_kinds,'description',n.description) ORDER BY n.namespace) FROM hc.source_namespace_def n));
$$;

CREATE FUNCTION hc.api_list_observations(p_subject text,p_person uuid,p_metric text,p_namespace text,p_from timestamptz,p_to timestamptz,p_limit int,p_offset int,p_action text DEFAULT 'read')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,hc,pg_temp AS $$
DECLARE v_total bigint; v_rows jsonb; v_limit int; v_offset int;
BEGIN
 IF p_action NOT IN ('read','export') THEN RETURN jsonb_build_object('status','invalid'); END IF;
 IF NOT hc.guard(p_subject,p_person,p_action) THEN RETURN jsonb_build_object('status','forbidden'); END IF;
 v_limit:=least(greatest(coalesce(p_limit,50),1),100000); v_offset:=greatest(coalesce(p_offset,0),0);
 SELECT count(*) INTO v_total FROM hc.observation o JOIN hc.observation_provenance pr ON pr.observation_id=o.id
  WHERE (p_metric IS NULL OR o.metric_code=p_metric) AND (p_namespace IS NULL OR pr.source_namespace=p_namespace)
    AND (p_from IS NULL OR o.measured_at>=p_from) AND (p_to IS NULL OR o.measured_at<p_to);
 SELECT coalesce(jsonb_agg(j ORDER BY ord),'[]'::jsonb) INTO v_rows FROM (
  SELECT hc.observation_json(o,pr) AS j, row_number() OVER (ORDER BY o.measured_at,o.id) AS ord
  FROM hc.observation o JOIN hc.observation_provenance pr ON pr.observation_id=o.id
  WHERE (p_metric IS NULL OR o.metric_code=p_metric) AND (p_namespace IS NULL OR pr.source_namespace=p_namespace)
    AND (p_from IS NULL OR o.measured_at>=p_from) AND (p_to IS NULL OR o.measured_at<p_to)
  ORDER BY o.measured_at,o.id LIMIT v_limit OFFSET v_offset) s;
 PERFORM hc.audit(p_subject,p_person,CASE WHEN p_action='export' THEN 'export_observations' ELSE 'read_observations' END,jsonb_build_object('returned',jsonb_array_length(v_rows)));
 RETURN jsonb_build_object('status','ok','total',v_total,'limit',v_limit,'offset',v_offset,'observations',v_rows);
END $$;

CREATE FUNCTION hc.api_get_observation(p_subject text,p_person uuid,p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,hc,pg_temp AS $$
DECLARE v jsonb;
BEGIN
 IF NOT hc.guard(p_subject,p_person,'read') THEN RETURN jsonb_build_object('status','forbidden'); END IF;
 SELECT hc.observation_json(o,pr) || jsonb_build_object('provenance',jsonb_build_object(
   'ingestion_version',pr.ingestion_version,'payload_sha256',pr.source_sha256,'imported_at',hc.iso_utc(pr.imported_at),
   'transformations',pr.transformations,'supersedes_observation_id',o.supersedes_observation_id))
 INTO v FROM hc.observation o JOIN hc.observation_provenance pr ON pr.observation_id=o.id WHERE o.id=p_id;
 IF v IS NULL THEN RETURN jsonb_build_object('status','not_found'); END IF;
 PERFORM hc.audit(p_subject,p_person,'read_observation',jsonb_build_object('observation',p_id));
 RETURN jsonb_build_object('status','ok','observation',v);
END $$;

-- Enregistre l'instantané d'un rapport calculé par le moteur descriptif : paramètres, empreinte et
-- liste exacte des observations utilisées (traçabilité T08). Idempotent sur (personne, empreinte).
CREATE FUNCTION hc.api_record_report(p_subject text,p_person uuid,p_algorithm text,p_parameters jsonb,p_sha text,p_observation_ids uuid[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,hc,pg_temp AS $$
DECLARE v_id uuid; v_known int; v_ids uuid[];
BEGIN
 IF NOT hc.guard(p_subject,p_person,'read') THEN RETURN jsonb_build_object('status','forbidden'); END IF;
 IF p_sha !~ '^[a-f0-9]{64}$' OR length(coalesce(p_algorithm,'')) NOT BETWEEN 1 AND 40 OR jsonb_typeof(p_parameters)<>'object' THEN RETURN jsonb_build_object('status','invalid'); END IF;
 v_ids:=ARRAY(SELECT DISTINCT x FROM unnest(coalesce(p_observation_ids,'{}'::uuid[])) x);
 SELECT count(*) INTO v_known FROM hc.observation o WHERE o.id=ANY(v_ids);
 IF v_known<>coalesce(array_length(v_ids,1),0) THEN RETURN jsonb_build_object('status','invalid','reason','UNRESOLVED_REFERENCE'); END IF;
 SELECT id INTO v_id FROM hc.report WHERE person_id=p_person AND document_sha256=p_sha;
 IF v_id IS NULL THEN
  INSERT INTO hc.report(person_id,algorithm_version,document_sha256,synthetic,parameters,requested_by)
  VALUES(p_person,p_algorithm,p_sha,true,p_parameters,left(p_subject,180)) RETURNING id INTO v_id;
  INSERT INTO hc.report_observation(report_id,observation_id) SELECT v_id,x FROM unnest(v_ids) x;
 END IF;
 PERFORM hc.audit(p_subject,p_person,'generate_report',jsonb_build_object('report',v_id,'sha256',p_sha));
 RETURN jsonb_build_object('status','ok','report_id',v_id,'sha256',p_sha);
END $$;

-- Import par lot : atomique (tout ou rien), idempotent, déterministe.
-- Clé d'idempotence : (personne, espace de noms, identifiant source, version). Même clé + même contenu = doublon
-- ignoré ; même clé + contenu différent = conflit (aucun écrasement silencieux).
CREATE FUNCTION hc.api_import_batch(p_subject text,p_person uuid,p_namespace text,p_version text,p_records jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,hc,pg_temp AS $$
DECLARE v_ns hc.source_namespace_def; v_kind text; v_action text; v_rec jsonb; v_i int:=0; v_errors jsonb:='[]'::jsonb;
 v_metric text; v_method text; v_unit text; v_srid text; v_dev text; v_ts text; v_end text; v_value numeric; v_time timestamptz; v_endt timestamptz;
 v_def hc.metric_definition; v_digest text; v_existing text; v_reason text; v_id uuid; v_inserted int:=0; v_dup int:=0; v_conflict boolean:=false;
 v_seen jsonb:='{}'::jsonb; v_todo jsonb:='[]'::jsonb; v_item jsonb; v_canon jsonb;
 c_ts CONSTANT text:='^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$';
BEGIN
 SELECT * INTO v_ns FROM hc.source_namespace_def WHERE namespace=p_namespace;
 SELECT actor_kind INTO v_kind FROM hc.actor WHERE external_subject=p_subject AND active;
 v_action:=CASE WHEN v_kind='patient' THEN 'import_wearable' ELSE 'write_measurement' END;
 IF v_ns.namespace IS NULL OR v_kind IS NULL OR NOT (v_kind=ANY(v_ns.importer_kinds)) THEN
  PERFORM set_config('hc.person_scope','',true);
  PERFORM hc.audit(p_subject,p_person,'denied_import',jsonb_build_object('namespace',left(coalesce(p_namespace,''),48)));
  RETURN jsonb_build_object('status','forbidden');
 END IF;
 IF NOT hc.guard(p_subject,p_person,v_action) THEN RETURN jsonb_build_object('status','forbidden'); END IF;
 -- Consentement / connexion active exigée pour ce fournisseur (retrait = arrêt des imports, T09).
 IF NOT EXISTS(SELECT 1 FROM hc.source_connection c WHERE c.provider=v_ns.provider AND c.status='active') THEN
  PERFORM hc.audit(p_subject,p_person,'denied_import',jsonb_build_object('namespace',p_namespace,'reason','connection_inactive'));
  RETURN jsonb_build_object('status','connection_inactive','provider',v_ns.provider);
 END IF;
 IF length(coalesce(p_version,'')) NOT BETWEEN 1 AND 40 OR jsonb_typeof(p_records)<>'array' OR jsonb_array_length(p_records) NOT BETWEEN 1 AND 5000 THEN
  RETURN jsonb_build_object('status','invalid','errors',jsonb_build_array(jsonb_build_object('index',NULL,'reason','BATCH_SHAPE')));
 END IF;
 -- Sérialise les imports concurrents d'une même personne et d'une même source.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_person::text||'|'||p_namespace,0));

 FOR v_rec IN SELECT * FROM jsonb_array_elements(p_records) LOOP
  v_reason:=NULL; v_srid:=NULL;
  IF jsonb_typeof(v_rec)<>'object' THEN v_reason:='RECORD_SHAPE';
  ELSE
   v_srid:=v_rec->>'source_record_id'; v_metric:=v_rec->>'metric_code'; v_method:=v_rec->>'method_code'; v_unit:=v_rec->>'unit';
   v_dev:=btrim(coalesce(v_rec->>'source_device','')); v_ts:=v_rec->>'measured_at'; v_end:=v_rec->>'interval_end_at';
   SELECT * INTO v_def FROM hc.metric_definition WHERE metric_code=v_metric;
   IF v_srid IS NULL OR length(v_srid) NOT BETWEEN 1 AND 200 THEN v_reason:='SOURCE_RECORD_ID';
   ELSIF v_def.metric_code IS NULL THEN v_reason:='UNKNOWN_METRIC';
   ELSIF NOT EXISTS(SELECT 1 FROM hc.metric_method m WHERE m.metric_code=v_metric AND m.method_code=v_method) THEN v_reason:='UNAPPROVED_METHOD';
   ELSIF v_unit IS DISTINCT FROM v_def.canonical_unit THEN v_reason:='UNIT_MISMATCH_NO_SILENT_CONVERSION';
   ELSIF jsonb_typeof(v_rec->'value')<>'number' THEN v_reason:='VALUE_NOT_NUMERIC';
   ELSIF length(v_dev) NOT BETWEEN 1 AND 160 THEN v_reason:='MISSING_DEVICE_PROVENANCE';
   ELSIF v_ts IS NULL OR v_ts !~ c_ts OR (v_end IS NOT NULL AND v_end !~ c_ts) THEN v_reason:='TIMESTAMP_REQUIRES_EXPLICIT_OFFSET';
   ELSE
    BEGIN
     v_value:=trim_scale((v_rec->>'value')::numeric); v_time:=v_ts::timestamptz; v_endt:=v_end::timestamptz;
    EXCEPTION WHEN others THEN v_reason:='UNPARSEABLE_VALUE_OR_TIMESTAMP'; END;
    IF v_reason IS NULL THEN
     IF v_value<v_def.plausible_min OR v_value>v_def.plausible_max THEN v_reason:='VALUE_OUT_OF_PLAUSIBLE_RANGE';
     ELSIF v_def.integer_only AND v_value<>trunc(v_value) THEN v_reason:='INTEGER_REQUIRED';
     ELSIF v_endt IS NOT NULL AND v_endt<=v_time THEN v_reason:='INTERVAL_END_BEFORE_START';
     ELSIF v_time>now()+interval '1 day' THEN v_reason:='TIMESTAMP_IN_FUTURE';
     END IF;
    END IF;
   END IF;
  END IF;
  IF v_reason IS NULL THEN
   v_canon:=jsonb_build_object('metric_code',v_metric,'method_code',v_method,'unit',v_unit,'value',v_value,
     'measured_at',hc.iso_utc(v_time),'interval_end_at',CASE WHEN v_endt IS NULL THEN NULL ELSE hc.iso_utc(v_endt) END,'source_device',v_dev);
   v_digest:=encode(sha256(convert_to(v_canon::text,'UTF8')),'hex');
   IF v_seen ? v_srid THEN
    IF v_seen->>v_srid = v_digest THEN v_dup:=v_dup+1; ELSE v_reason:='CONFLICTING_DUPLICATE_IN_BATCH'; END IF;
   ELSE
    v_seen:=v_seen||jsonb_build_object(v_srid,v_digest);
    SELECT r.payload_sha256 INTO v_existing FROM hc.ingestion_receipt r
     WHERE r.source_namespace=p_namespace AND r.source_record_id=v_srid AND r.ingestion_version=p_version;
    IF FOUND THEN
     IF v_existing=v_digest THEN v_dup:=v_dup+1; ELSE v_reason:='REVISION_CONFLICT'; v_conflict:=true; END IF;
    ELSE
     v_todo:=v_todo||jsonb_build_array(v_canon||jsonb_build_object('srid',v_srid,'digest',v_digest,
       'tz',substring(v_ts from '(Z|[+-]\d{2}:\d{2})$'),'original_value',v_rec->'value'));
    END IF;
   END IF;
  END IF;
  IF v_reason IS NOT NULL THEN v_errors:=v_errors||jsonb_build_array(jsonb_build_object('index',v_i,'source_record_id',left(v_srid,200),'reason',v_reason)); END IF;
  v_i:=v_i+1;
 END LOOP;

 IF jsonb_array_length(v_errors)>0 THEN
  PERFORM hc.audit(p_subject,p_person,'import_rejected',jsonb_build_object('namespace',p_namespace,'errors',jsonb_array_length(v_errors)));
  RETURN jsonb_build_object('status',CASE WHEN v_conflict THEN 'conflict' ELSE 'invalid' END,'inserted',0,'errors',v_errors);
 END IF;

 FOR v_item IN SELECT * FROM jsonb_array_elements(v_todo) LOOP
  -- Identifiant déterministe : un même enregistrement source reçoit le même identifiant sur toute installation.
  v_id:=md5(p_person::text||'|'||p_namespace||'|'||(v_item->>'srid')||'|'||p_version)::uuid;
  INSERT INTO hc.observation(id,person_id,source_connection_id,metric_code,method_code,original_value,original_unit,value_canonical,unit_canonical,
    measured_at,interval_end_at,original_timezone,synthetic,source_device)
  VALUES(v_id,p_person,(SELECT c.id FROM hc.source_connection c WHERE c.provider=v_ns.provider),v_item->>'metric_code',v_item->>'method_code',
    (v_item->>'original_value')::numeric,v_item->>'unit',(v_item->>'value')::numeric,v_item->>'unit',
    (v_item->>'measured_at')::timestamptz,(v_item->>'interval_end_at')::timestamptz,v_item->>'tz',true,v_item->>'source_device');
  INSERT INTO hc.observation_provenance(observation_id,person_id,source_namespace,source_record_id,ingestion_version,source_sha256,transformations)
  VALUES(v_id,p_person,p_namespace,v_item->>'srid',p_version,v_item->>'digest','[]'::jsonb);
  INSERT INTO hc.ingestion_receipt(person_id,connection_id,source_namespace,source_record_id,ingestion_version,payload_sha256,observation_id)
  VALUES(p_person,(SELECT c.id FROM hc.source_connection c WHERE c.provider=v_ns.provider),p_namespace,v_item->>'srid',p_version,v_item->>'digest',v_id);
  v_inserted:=v_inserted+1;
 END LOOP;
 PERFORM hc.audit(p_subject,p_person,'import_batch',jsonb_build_object('namespace',p_namespace,'version',p_version,'inserted',v_inserted,'duplicates',v_dup));
 RETURN jsonb_build_object('status','ok','inserted',v_inserted,'duplicates',v_dup);
END $$;

CREATE FUNCTION hc.api_list_connections(p_subject text,p_person uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,hc,pg_temp AS $$
DECLARE v jsonb;
BEGIN
 IF NOT (hc.authz(p_subject,p_person,'read') OR hc.authz(p_subject,p_person,'write_measurement')) THEN
  PERFORM set_config('hc.person_scope','',true); PERFORM hc.audit(p_subject,p_person,'denied_list_connections','{}'::jsonb);
  RETURN jsonb_build_object('status','forbidden');
 END IF;
 PERFORM set_config('hc.person_scope',p_person::text,true);
 SELECT coalesce(jsonb_agg(jsonb_build_object('provider',c.provider,'status',c.status,
   'authorized_at',CASE WHEN c.authorized_at IS NULL THEN NULL ELSE hc.iso_utc(c.authorized_at) END,
   'revoked_at',CASE WHEN c.revoked_at IS NULL THEN NULL ELSE hc.iso_utc(c.revoked_at) END) ORDER BY c.provider),'[]'::jsonb)
 INTO v FROM hc.source_connection c;
 RETURN jsonb_build_object('status','ok','connections',v);
END $$;

-- Seul le patient active ou révoque ses connexions de sources (consentement distinct des habilitations soignants).
CREATE FUNCTION hc.api_set_connection(p_subject text,p_person uuid,p_provider text,p_status text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,hc,pg_temp AS $$
BEGIN
 IF NOT hc.guard(p_subject,p_person,'manage_connections') THEN RETURN jsonb_build_object('status','forbidden'); END IF;
 IF p_status NOT IN ('active','revoked') OR NOT EXISTS(SELECT 1 FROM hc.source_namespace_def n WHERE n.provider=p_provider) THEN RETURN jsonb_build_object('status','invalid'); END IF;
 INSERT INTO hc.source_connection(person_id,provider,status,authorized_at,revoked_at)
 VALUES(p_person,p_provider,p_status,CASE WHEN p_status='active' THEN now() END,CASE WHEN p_status='revoked' THEN now() END)
 ON CONFLICT(person_id,provider) DO UPDATE SET status=EXCLUDED.status,
   authorized_at=CASE WHEN EXCLUDED.status='active' THEN now() ELSE hc.source_connection.authorized_at END,
   revoked_at=CASE WHEN EXCLUDED.status='revoked' THEN now() ELSE NULL END;
 PERFORM hc.audit(p_subject,p_person,'connection_'||p_status,jsonb_build_object('provider',p_provider));
 RETURN jsonb_build_object('status','ok','provider',p_provider,'connection_status',p_status);
END $$;

CREATE FUNCTION hc.api_list_audit(p_subject text,p_person uuid,p_limit int) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,hc,pg_temp AS $$
DECLARE v jsonb;
BEGIN
 IF NOT hc.guard(p_subject,p_person,'read_audit') THEN RETURN jsonb_build_object('status','forbidden'); END IF;
 SELECT coalesce(jsonb_agg(j),'[]'::jsonb) INTO v FROM (
  SELECT jsonb_build_object('actor',a.actor_ref,'event',a.event_type,'at',hc.iso_utc(a.occurred_at)) AS j
  FROM hc.access_audit a ORDER BY a.occurred_at DESC,a.id LIMIT least(greatest(coalesce(p_limit,50),1),200)) s;
 RETURN jsonb_build_object('status','ok','events',v);
END $$;

DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p WHERE p.pronamespace='hc'::regnamespace LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO hc_owner',r.sig);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',r.sig);
  IF r.proname LIKE 'api\_%' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO hc_api',r.sig); END IF;
 END LOOP;
END $$;
COMMIT;
