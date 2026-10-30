BEGIN;

INSERT INTO auth.users(id) VALUES
  ('11111111-1111-4111-8111-111111111111'),
  ('33333333-3333-4333-8333-333333333333');
INSERT INTO public.organizations(id, name) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Organización A');
INSERT INTO public.memberships(organization_id, user_id, entra_tenant_id, entra_subject, active) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'azure-subject-user-a', true),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'azure-subject-user-c', true);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
INSERT INTO public.vendors(organization_id, name, associated_area, created_by)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Eliminación manual', 'finance', auth.uid());
DO $$ DECLARE affected integer; BEGIN
  DELETE FROM public.vendors WHERE name='Eliminación manual';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'active vendor was permanently deleted'; END IF;
END $$;
UPDATE public.vendors SET archived_at=now() WHERE name='Eliminación manual';

SELECT set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
DO $$ DECLARE affected integer; BEGIN
  DELETE FROM public.vendors WHERE name='Eliminación manual';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'non-creator permanently deleted vendor'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
DELETE FROM public.vendors WHERE name='Eliminación manual';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.vendors WHERE name='Eliminación manual') THEN RAISE EXCEPTION 'archived vendor survived permanent delete'; END IF;
  IF has_function_privilege('authenticated', 'public.purge_expired_vendors()', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated users can invoke automatic purge';
  END IF;
END $$;

RESET ROLE;
INSERT INTO public.vendors(organization_id, name, associated_area, created_by, archived_at) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Vencido', 'it', '11111111-1111-4111-8111-111111111111', now() - interval '31 days'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Reciente', 'it', '11111111-1111-4111-8111-111111111111', now() - interval '29 days');

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.vendors WHERE name='Vencido') THEN RAISE EXCEPTION 'expired vendor remains visible'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vendors WHERE name='Reciente') THEN RAISE EXCEPTION 'recent archived vendor is hidden'; END IF;
END $$;

RESET ROLE;
SELECT public.purge_expired_vendors();
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.vendors WHERE name='Vencido') THEN RAISE EXCEPTION 'expired vendor was not purged'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vendors WHERE name='Reciente') THEN RAISE EXCEPTION 'recent vendor was purged early'; END IF;
END $$;

ROLLBACK;
