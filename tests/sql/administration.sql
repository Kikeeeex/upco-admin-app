-- Administration V1 was retired in Administration V2. Keep checking that
-- authenticated users cannot create or mutate V1 matters and follow-ups.
BEGIN;

INSERT INTO auth.users(id) VALUES ('11111111-1111-4111-8111-111111111111');
INSERT INTO organizations(id, name)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Organización A');
INSERT INTO memberships(organization_id, user_id, entra_tenant_id, entra_subject, active)
VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'retirement-test-user',
  true
);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

DO $$
BEGIN
  IF has_table_privilege('authenticated', 'public.admin_details', 'SELECT')
    OR has_table_privilege('authenticated', 'public.admin_details', 'INSERT')
    OR has_table_privilege('authenticated', 'public.follow_ups', 'SELECT')
    OR has_table_privilege('authenticated', 'public.follow_ups', 'INSERT') THEN
    RAISE EXCEPTION 'retired administration tables remain accessible';
  END IF;

  IF has_function_privilege(
    'authenticated',
    'public.create_admin_matter(uuid,text,text,text,text,date,text,text,text,text,uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'retired matter creation RPC remains executable';
  END IF;

  BEGIN
    INSERT INTO work_items(organization_id, creator_id, type, title)
    VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', auth.uid(), 'administration', 'Gestión retirada');
    RAISE EXCEPTION 'retired administration work item was accepted';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    NULL;
  END;

  BEGIN
    PERFORM public.create_admin_matter(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Gestión retirada', 'Informe', 'Cliente A',
      NULL, NULL, 'pending', NULL, NULL, NULL, NULL
    );
    RAISE EXCEPTION 'retired matter creation RPC was accepted';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;

ROLLBACK;
