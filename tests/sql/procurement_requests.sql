BEGIN;
INSERT INTO auth.users(id) VALUES ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');
INSERT INTO organizations(id, name) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Procura A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Procura B');
INSERT INTO memberships(organization_id, user_id, entra_tenant_id, entra_object_id, entra_subject, active) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', NULL, 'procurement-subject-a', true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', NULL, 'procurement-subject-b', true);
INSERT INTO sites(id, organization_id, code, name) VALUES
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'MAR', 'Maracaibo'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'OTHER', 'Otra');
INSERT INTO vendors(id, organization_id, created_by, name, associated_area)
VALUES ('99999999-9999-4999-8999-999999999999', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '22222222-2222-4222-8222-222222222222', 'Proveedor B', 'it');

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
INSERT INTO vendors(organization_id, created_by, name, associated_area) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', auth.uid(), 'Proveedor A', 'it'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', auth.uid(), 'Archivado', 'it');
UPDATE vendors SET archived_at = now() WHERE name = 'Archivado';

SELECT public.create_procurement_request(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Servicio de prueba', 2.5, 'horas',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Necesario para operación', 'REF-1',
  (SELECT id FROM vendors WHERE name = 'Proveedor A'));

DO $$ BEGIN
  IF (SELECT count(*) FROM work_items w JOIN procurement_details d ON d.work_item_id = w.id
      WHERE w.code = 'PRC-000001' AND w.site_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
        AND d.quantity = 2.5 AND d.unit = 'horas' AND d.need = 'Necesario para operación'
        AND d.reference = 'REF-1' AND d.vendor_name = 'Proveedor A') <> 1 THEN
    RAISE EXCEPTION 'procurement request incomplete';
  END IF;
  BEGIN
    PERFORM public.create_procurement_request('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Cero', 0, 'unidad', NULL, 'Necesidad', NULL, NULL);
    RAISE EXCEPTION 'zero quantity accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.create_procurement_request('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Demasiados decimales', 1.2345, 'unidad', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Necesidad', NULL, NULL);
    RAISE EXCEPTION 'overprecise quantity accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.create_procurement_request('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Sin sede', 1, 'unidad', NULL, 'Necesidad', NULL, NULL);
    RAISE EXCEPTION 'missing destination accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE work_items SET site_id = NULL WHERE code = 'PRC-000001';
    RAISE EXCEPTION 'destination removed after creation';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.create_procurement_request('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Otra sede', 1, 'unidad', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Necesidad', NULL, NULL);
    RAISE EXCEPTION 'cross-organization site accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.create_procurement_request('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Archivado', 1, 'unidad', NULL, 'Necesidad', NULL, (SELECT id FROM vendors WHERE name = 'Archivado'));
    RAISE EXCEPTION 'archived vendor accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.create_procurement_request('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Proveedor externo', 1, 'unidad', NULL, 'Necesidad', NULL, '99999999-9999-4999-8999-999999999999');
    RAISE EXCEPTION 'cross-organization vendor accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  IF (SELECT count(*) FROM work_items WHERE type = 'procurement') <> 1 THEN RAISE EXCEPTION 'partial request remained'; END IF;
END $$;

UPDATE vendors SET archived_at = now() WHERE name = 'Proveedor A';
DELETE FROM vendors WHERE name = 'Proveedor A';
DO $$ BEGIN
  IF (SELECT count(*) FROM procurement_details WHERE vendor_id IS NULL AND vendor_name = 'Proveedor A') <> 1 THEN
    RAISE EXCEPTION 'vendor snapshot lost on deletion';
  END IF;
END $$;

SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
DO $$ BEGIN
  IF (SELECT count(*) FROM procurement_details) <> 0 THEN RAISE EXCEPTION 'cross-organization detail visible'; END IF;
END $$;

RESET ROLE;
DO $$ BEGIN
  IF has_table_privilege('anon', 'public.procurement_details', 'SELECT') THEN RAISE EXCEPTION 'anon can read details'; END IF;
  IF has_table_privilege('authenticated', 'public.procurement_details', 'DELETE') THEN RAISE EXCEPTION 'authenticated can delete details'; END IF;
END $$;
ROLLBACK;
