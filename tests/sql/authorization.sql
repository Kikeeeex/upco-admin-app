BEGIN;

INSERT INTO auth.users(id) VALUES
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');
INSERT INTO organizations(id, name) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Organización A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Organización B');
INSERT INTO memberships(organization_id, user_id, entra_tenant_id, entra_object_id, entra_subject, active) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', NULL, 'azure-subject-user-a', true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', NULL, 'azure-subject-user-b', true);

DO $$ BEGIN
  IF has_table_privilege('anon', 'public.work_items', 'SELECT') THEN RAISE EXCEPTION 'anon table privilege remains'; END IF;
END $$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT auth.uid() AS current_user_id, (SELECT count(*) FROM memberships) AS visible_memberships, (SELECT count(*) FROM organizations) AS visible_organizations;

DO $$ BEGIN
  IF (SELECT count(*) FROM organizations) <> 1 THEN RAISE EXCEPTION 'organization RLS failed'; END IF;
  IF (SELECT count(*) FROM memberships) <> 1 THEN RAISE EXCEPTION 'membership RLS failed'; END IF;
END $$;

INSERT INTO work_items(organization_id, creator_id, type, title, priority) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'general', 'Primer registro', 'medium'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'general', 'Segundo registro', 'high');

DO $$ BEGIN
  BEGIN
    UPDATE work_items SET closed_at = now() WHERE title = 'Primer registro';
    RAISE EXCEPTION 'privileged field update was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

DO $$ BEGIN
  IF (SELECT count(DISTINCT code) FROM work_items) <> 2 THEN RAISE EXCEPTION 'code allocation failed'; END IF;
  IF (SELECT count(*) FROM activity_log) <> 2 THEN RAISE EXCEPTION 'creation audit failed'; END IF;
  BEGIN
    INSERT INTO work_items(organization_id, creator_id, type, title) VALUES
      ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '11111111-1111-4111-8111-111111111111', 'general', 'Debe fallar');
    RAISE EXCEPTION 'foreign organization insert was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

UPDATE work_items SET status = 'completed', due_date = '2026-10-30' WHERE title = 'Primer registro';
DO $$ BEGIN
  IF (SELECT closed_at IS NULL FROM work_items WHERE title = 'Primer registro') THEN RAISE EXCEPTION 'completion timestamp missing'; END IF;
  IF (SELECT count(*) FROM activity_log) <> 3 THEN RAISE EXCEPTION 'critical update audit failed'; END IF;
END $$;
UPDATE work_items SET status = 'in_progress' WHERE title = 'Primer registro';
DO $$ BEGIN
  IF (SELECT closed_at IS NOT NULL FROM work_items WHERE title = 'Primer registro') THEN RAISE EXCEPTION 'reopening did not clear completion'; END IF;
  IF (SELECT count(*) FROM activity_log) <> 4 THEN RAISE EXCEPTION 'reopening audit failed'; END IF;
END $$;

UPDATE work_items SET archived_at = now() WHERE title = 'Primer registro';
DO $$ BEGIN
  IF (SELECT count(*) FROM work_items WHERE title = 'Primer registro' AND archived_at IS NOT NULL) <> 1 THEN
    RAISE EXCEPTION 'archiving lost the work item';
  END IF;
  IF (SELECT count(*) FROM activity_log) <> 5 THEN RAISE EXCEPTION 'archive audit failed'; END IF;
END $$;
UPDATE work_items SET archived_at = NULL WHERE title = 'Primer registro';
DO $$ BEGIN
  IF (SELECT count(*) FROM work_items WHERE title = 'Primer registro' AND archived_at IS NULL) <> 1 THEN
    RAISE EXCEPTION 'restoring lost the work item';
  END IF;
  IF (SELECT count(*) FROM activity_log) <> 6 THEN RAISE EXCEPTION 'restore audit failed'; END IF;
END $$;

INSERT INTO activity_log(organization_id, work_item_id, action, after_values, actor_id)
SELECT organization_id, id, 'note', jsonb_build_object('body', 'Primera nota'), auth.uid()
FROM work_items WHERE title = 'Primer registro';
DO $$ BEGIN
  IF (SELECT count(*) FROM activity_log WHERE action = 'note' AND after_values->>'body' = 'Primera nota') <> 1 THEN
    RAISE EXCEPTION 'own note was not saved';
  END IF;
  IF (SELECT count(*) FROM activity_log) <> 7 THEN RAISE EXCEPTION 'note history is missing'; END IF;
  IF has_table_privilege('authenticated', 'public.activity_log', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.activity_log', 'after_values', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.activity_log', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated user can change historical events';
  END IF;
  BEGIN
    INSERT INTO activity_log(organization_id, work_item_id, action, after_values, actor_id)
    SELECT organization_id, id, 'updated', '{}'::jsonb, auth.uid()
    FROM work_items WHERE title = 'Primer registro';
    RAISE EXCEPTION 'forged update event was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO activity_log(organization_id, work_item_id, action, after_values, actor_id)
    SELECT 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', id, 'note', jsonb_build_object('body', 'Nota ajena'), auth.uid()
    FROM work_items WHERE title = 'Primer registro';
    RAISE EXCEPTION 'cross organization note was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO activity_log(organization_id, work_item_id, action, after_values, actor_id)
    SELECT organization_id, id, 'note', jsonb_build_object('body', '  '), auth.uid()
    FROM work_items WHERE title = 'Primer registro';
    RAISE EXCEPTION 'blank note was allowed';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
DO $$ BEGIN
  IF (SELECT count(*) FROM work_items) <> 0 THEN RAISE EXCEPTION 'cross organization read failed'; END IF;
  IF (SELECT count(*) FROM activity_log) <> 0 THEN RAISE EXCEPTION 'cross organization audit read failed'; END IF;
END $$;
DO $$
DECLARE affected bigint;
BEGIN
  UPDATE work_items SET archived_at = now() WHERE title = 'Primer registro';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'cross organization archive was allowed'; END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
DO $$ BEGIN
  IF (SELECT count(*) FROM organizations) <> 0 THEN RAISE EXCEPTION 'unknown user read failed'; END IF;
  IF (SELECT count(*) FROM work_items) <> 0 THEN RAISE EXCEPTION 'unknown user work read failed'; END IF;
END $$;

ROLLBACK;
