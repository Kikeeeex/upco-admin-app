BEGIN;
INSERT INTO auth.users(id) VALUES ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');
INSERT INTO organizations(id, name) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Procura A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Procura B');
INSERT INTO memberships(organization_id, user_id, entra_tenant_id, entra_object_id, entra_subject, active) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', NULL, 'multi-subject-aaaa', true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', NULL, 'multi-subject-bbbb', true);
INSERT INTO sites(id, organization_id, code, name)
VALUES ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'MAR', 'Maracaibo');

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
INSERT INTO vendors(organization_id, created_by, name, associated_area)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', auth.uid(), 'Proveedor de prueba', 'operations');

SELECT public.create_procurement_request_multi(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'Reponer equipos', 'MULTI-1', (SELECT id FROM vendors WHERE name = 'Proveedor de prueba'),
  'Ana', 'Pérez', 'operations',
  '[{"article":"Guantes","partNumber":"G-1","quantity":"2.5","unit":"cajas"},{"article":"Casco","partNumber":null,"quantity":"3","unit":"unidades"}]'::jsonb);

DO $$ BEGIN
  IF (SELECT count(*) FROM work_items WHERE type = 'procurement' AND title = 'Guantes' AND code = 'PRC-000001') <> 1 THEN
    RAISE EXCEPTION 'multi request parent incorrect';
  END IF;
  IF (SELECT count(*) FROM procurement_request_items WHERE position IN (1, 2)) <> 2 THEN
    RAISE EXCEPTION 'multi request lines missing';
  END IF;
  IF (SELECT count(*) FROM procurement_request_items WHERE position = 1 AND article = 'Guantes' AND part_number = 'G-1' AND quantity = 2.5 AND unit = 'cajas') <> 1 THEN
    RAISE EXCEPTION 'first line incorrect';
  END IF;
  IF (SELECT count(*) FROM procurement_request_items WHERE position = 2 AND article = 'Casco' AND part_number IS NULL AND quantity = 3 AND unit = 'unidades') <> 1 THEN
    RAISE EXCEPTION 'second line incorrect';
  END IF;
  IF (SELECT count(*) FROM procurement_details WHERE vendor_name = 'Proveedor de prueba' AND need = 'Reponer equipos' AND requester_area = 'operations' AND item_count = 2) <> 1 THEN
    RAISE EXCEPTION 'shared request fields incorrect';
  END IF;

  BEGIN
    PERFORM public.create_procurement_request_multi('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'Necesidad', NULL, NULL, 'Ana', 'Pérez', 'operations',
      '[{"article":"Válido","quantity":"1","unit":"unidad","partNumber":null},{"article":"Inválido","quantity":"0","unit":"unidad","partNumber":null}]'::jsonb);
    RAISE EXCEPTION 'invalid second line accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.create_procurement_request_multi('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'Necesidad', NULL, NULL, 'Ana', 'Pérez', 'operations', '[]'::jsonb);
    RAISE EXCEPTION 'empty lines accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.create_procurement_request_multi('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'Necesidad', NULL, NULL, 'Ana', 'Pérez', 'operations',
      '[{"article":"Demasiados decimales","quantity":"1.2345","unit":"unidad","partNumber":null}]'::jsonb);
    RAISE EXCEPTION 'overprecise line accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  IF (SELECT count(*) FROM work_items WHERE type = 'procurement') <> 1 THEN RAISE EXCEPTION 'partial request remained'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
DO $$ BEGIN
  IF (SELECT count(*) FROM procurement_request_items) <> 0 THEN RAISE EXCEPTION 'cross-organization line visible'; END IF;
END $$;

RESET ROLE;
DO $$ BEGIN
  IF has_table_privilege('anon', 'public.procurement_request_items', 'SELECT') THEN RAISE EXCEPTION 'anon can read lines'; END IF;
  IF has_table_privilege('authenticated', 'public.procurement_request_items', 'DELETE') THEN RAISE EXCEPTION 'authenticated can delete lines'; END IF;
END $$;
ROLLBACK;
