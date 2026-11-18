-- JEU DE DÉMONSTRATION 100 % SYNTHÉTIQUE. Jamais appliqué par les migrations :
-- uniquement par scripts/seed-demo.mjs, qui exige HC_SYNTHETIC_ONLY=true.
-- Idempotent. Aucune donnée personnelle : alias fictifs, sujets fictifs.
INSERT INTO hc.person(id,alias,synthetic) VALUES
 ('5a73bb9c-742f-5663-afba-549d057ff4a6','DEMO ALPHA (fictif)',true),
 ('22222222-2222-4222-8222-222222222222','DEMO BETA (fictif, dossier vide)',true)
ON CONFLICT (id) DO NOTHING;
INSERT INTO hc.actor(id,external_subject,actor_kind) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','patient-demo','patient'),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','patient-beta','patient'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','ide-demo','ide'),
 ('99999999-9999-4999-8999-999999999999','physician-demo','physician'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','founder-demo','founder'),
 ('77777777-7777-4777-8777-777777777777','admin-demo','admin')
ON CONFLICT (id) DO NOTHING;
INSERT INTO hc.patient_actor(actor_id,person_id) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','5a73bb9c-742f-5663-afba-549d057ff4a6'),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','22222222-2222-4222-8222-222222222222')
ON CONFLICT (actor_id) DO NOTHING;
-- IDE : mesures uniquement (pas de lecture de l'historique). Médecin : prise en charge (lecture + mesures).
INSERT INTO hc.care_access_grant(id,actor_id,person_id,purpose,valid_from,valid_until) VALUES
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','5a73bb9c-742f-5663-afba-549d057ff4a6','measurements',now()-interval '1 day',now()+interval '365 days'),
 ('ffffffff-ffff-4fff-8fff-ffffffffffff','99999999-9999-4999-8999-999999999999','5a73bb9c-742f-5663-afba-549d057ff4a6','clinical_care',now()-interval '1 day',now()+interval '365 days')
ON CONFLICT (id) DO NOTHING;
INSERT INTO hc.source_connection(person_id,provider,status,authorized_at) VALUES
 ('5a73bb9c-742f-5663-afba-549d057ff4a6','demo_watch','active',now()),
 ('5a73bb9c-742f-5663-afba-549d057ff4a6','demo_lab','active',now()),
 ('5a73bb9c-742f-5663-afba-549d057ff4a6','demo_center','active',now())
ON CONFLICT (person_id,provider) DO NOTHING;
