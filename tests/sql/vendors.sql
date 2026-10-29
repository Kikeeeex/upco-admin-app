BEGIN;

INSERT INTO auth.users(id) VALUES
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222'),
  ('33333333-3333-4333-8333-333333333333');
INSERT INTO public.organizations(id, name) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Organización A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Organización B');
INSERT INTO public.memberships(organization_id, user_id, entra_tenant_id, entra_subject, active) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'azure-subject-user-a', true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'azure-subject-user-b', true),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'azure-subject-user-c', true);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
INSERT INTO public.vendors(organization_id, name, contact_name, email, phone, notes, created_by)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Acme S.A.', 'Ana', 'ana@example.com', NULL, NULL, auth.uid());
DO $$ DECLARE invalid_email text; BEGIN
  IF (SELECT count(*) FROM public.vendors WHERE name='Acme S.A.') <> 1 THEN RAISE EXCEPTION 'vendor not created'; END IF;
  IF has_table_privilege('anon','public.vendors','SELECT') OR has_table_privilege('authenticated','public.vendors','DELETE')
    OR has_column_privilege('authenticated','public.vendors','organization_id','UPDATE') THEN RAISE EXCEPTION 'vendor grants too broad'; END IF;
  BEGIN
    INSERT INTO public.vendors(organization_id, name, created_by)
    VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '  ACME   s.a. ', auth.uid());
    RAISE EXCEPTION 'duplicate normalized vendor accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  FOREACH invalid_email IN ARRAY ARRAY['a@b.c.', 'a@b..c'] LOOP
    BEGIN
      INSERT INTO public.vendors(organization_id, name, email, created_by)
      VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Correo inválido ' || invalid_email, invalid_email, auth.uid());
      RAISE EXCEPTION 'malformed vendor email accepted: %', invalid_email;
    EXCEPTION WHEN check_violation THEN NULL;
    END;
  END LOOP;
  BEGIN
    INSERT INTO public.vendors(organization_id, name, created_by)
    VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', E'\tACME S.A.', auth.uid());
    RAISE EXCEPTION 'tab-prefixed duplicate vendor accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.vendors(organization_id, name, created_by)
    VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', E'\t', auth.uid());
    RAISE EXCEPTION 'whitespace-only vendor name accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.vendors(organization_id, name, email, created_by)
    VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Correo inválido', 'sin-arroba', auth.uid());
    RAISE EXCEPTION 'invalid vendor email accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;
UPDATE public.vendors SET contact_name=NULL, email=NULL, notes='Actualizado' WHERE name='Acme S.A.';
DO $$ BEGIN
  IF (SELECT count(*) FROM public.vendors WHERE name='Acme S.A.' AND contact_name IS NULL AND email IS NULL AND notes='Actualizado') <> 1 THEN RAISE EXCEPTION 'vendor update failed'; END IF;
  IF (SELECT associated_area FROM public.vendors WHERE name='Acme S.A.') <> 'procurement' THEN RAISE EXCEPTION 'existing vendor area was not backfilled'; END IF;
  BEGIN
    UPDATE public.vendors SET associated_area='sales' WHERE name='Acme S.A.';
    RAISE EXCEPTION 'invalid vendor area accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;
UPDATE public.vendors SET associated_area='it' WHERE name='Acme S.A.';
UPDATE public.vendors SET archived_at='2000-01-01' WHERE name='Acme S.A.';
DO $$ BEGIN
  IF (SELECT count(*) FROM public.vendors WHERE name='Acme S.A.' AND associated_area='it'
    AND archived_at > '2026-01-01') <> 1 THEN RAISE EXCEPTION 'vendor was not archived with server time'; END IF;
  BEGIN
    UPDATE public.vendors SET notes='Edición prohibida' WHERE name='Acme S.A.';
    RAISE EXCEPTION 'archived vendor was editable';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.vendors SET archived_at=NULL, notes='Edición prohibida' WHERE name='Acme S.A.';
    RAISE EXCEPTION 'restore and edit was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.vendors(organization_id, name, created_by)
    VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ACME S.A.', auth.uid());
    RAISE EXCEPTION 'archived duplicate name was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;

SELECT set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
DO $$ DECLARE affected integer;
BEGIN
  IF (SELECT count(*) FROM public.vendors) <> 1 THEN RAISE EXCEPTION 'same organization cannot read vendor'; END IF;
  UPDATE public.vendors SET archived_at=NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'non-creator restored vendor'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
UPDATE public.vendors SET archived_at=NULL WHERE name='Acme S.A.';
DO $$ BEGIN
  IF (SELECT count(*) FROM public.vendors WHERE name='Acme S.A.' AND archived_at IS NULL AND associated_area='it') <> 1
    THEN RAISE EXCEPTION 'vendor restoration failed'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.vendors) <> 0 THEN RAISE EXCEPTION 'cross-organization vendor read'; END IF;
  BEGIN
    INSERT INTO public.vendors(organization_id, name, created_by)
    VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Proveedor ajeno', auth.uid());
    RAISE EXCEPTION 'cross-organization vendor insert';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
INSERT INTO public.vendors(organization_id, name, created_by)
VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Acme S.A.', auth.uid());
DO $$ BEGIN
  IF (SELECT count(*) FROM public.vendors) <> 1 THEN RAISE EXCEPTION 'same vendor name should work in another organization'; END IF;
END $$;

ROLLBACK;
