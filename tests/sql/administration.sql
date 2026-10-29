BEGIN;

INSERT INTO auth.users(id) VALUES
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222'),
  ('33333333-3333-4333-8333-333333333333');
INSERT INTO organizations(id, name) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Organización A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Organización B');
INSERT INTO memberships(organization_id, user_id, entra_tenant_id, entra_subject, active) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'azure-subject-user-a', true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'azure-subject-user-b', true),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'azure-subject-user-c', true);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

SELECT public.create_admin_matter(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Preparar informe', 'Informe', 'Cliente A',
  NULL, '2026-11-02', 'pending', NULL, NULL, NULL, NULL
);

DO $$ DECLARE before_count integer;
BEGIN
  IF (SELECT count(*) FROM work_items WHERE type = 'administration' AND code LIKE 'ADM-%') <> 1 THEN
    RAISE EXCEPTION 'ADM work item was not created';
  END IF;
  IF (SELECT count(*) FROM admin_details WHERE procedure_type = 'Informe' AND counterpart_name = 'Cliente A' AND document_status = 'pending') <> 1 THEN
    RAISE EXCEPTION 'pending admin detail was not created';
  END IF;
  IF (SELECT due_date FROM work_items WHERE type = 'administration') <> '2026-11-02' THEN
    RAISE EXCEPTION 'commitment date was not saved';
  END IF;
  SELECT count(*) INTO before_count FROM work_items;
  BEGIN
    PERFORM public.create_admin_matter(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Fallida', 'Informe', 'Cliente A',
      NULL, NULL, 'invalid', NULL, NULL, NULL, NULL
    );
    RAISE EXCEPTION 'invalid document status was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  IF (SELECT count(*) FROM work_items) <> before_count THEN RAISE EXCEPTION 'failed detail left a work item'; END IF;
  BEGIN
    INSERT INTO work_items(organization_id, creator_id, type, title)
    VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', auth.uid(), 'administration', 'Sin ficha');
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'direct ADM insert without detail was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  IF (SELECT count(*) FROM work_items) <> before_count THEN RAISE EXCEPTION 'direct ADM insert left an orphan'; END IF;
  IF has_table_privilege('anon', 'public.admin_details', 'SELECT')
    OR has_table_privilege('authenticated', 'public.admin_details', 'DELETE')
    OR has_column_privilege('authenticated', 'public.admin_details', 'work_item_id', 'UPDATE') THEN
    RAISE EXCEPTION 'admin detail privileges are too broad';
  END IF;
END $$;

UPDATE admin_details SET document_status = 'received', document_reference = 'DOC-1'
WHERE work_item_id = (SELECT id FROM work_items WHERE type = 'administration');
DO $$ BEGIN
  IF (SELECT count(*) FROM activity_log WHERE action = 'updated' AND after_values->>'document_status' = 'received') <> 1 THEN
    RAISE EXCEPTION 'document update was not audited';
  END IF;
END $$;

SELECT set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
DO $$ DECLARE affected integer;
BEGIN
  IF (SELECT count(*) FROM admin_details) <> 1 THEN RAISE EXCEPTION 'same-org read was blocked'; END IF;
  UPDATE admin_details SET document_status = 'reviewed';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'non-owner changed document status'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
DO $$ BEGIN
  IF (SELECT count(*) FROM admin_details) <> 0 THEN RAISE EXCEPTION 'cross-org detail read'; END IF;
  BEGIN
    PERFORM public.create_admin_matter(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Ajena', 'Informe', 'Cliente A',
      NULL, NULL, 'pending', NULL, NULL, NULL, NULL
    );
    RAISE EXCEPTION 'cross-org creation was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

ROLLBACK;
