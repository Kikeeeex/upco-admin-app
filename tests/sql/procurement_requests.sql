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
  (SELECT id FROM vendors WHERE name = 'Proveedor A'), 'PART-123', 'Ana', 'Pérez', 'operations');

DO $$ DECLARE direct_item_id uuid; BEGIN
  IF (SELECT count(*) FROM work_items w JOIN procurement_details d ON d.work_item_id = w.id
      WHERE w.code = 'PRC-000001' AND w.site_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
        AND d.quantity = 2.5 AND d.unit = 'horas' AND d.need = 'Necesario para operación'
        AND d.reference = 'REF-1' AND d.vendor_name = 'Proveedor A'
        AND d.part_number = 'PART-123' AND d.requester_first_name = 'Ana'
        AND d.requester_last_name = 'Pérez' AND d.requester_area = 'operations') <> 1 THEN
    RAISE EXCEPTION 'procurement request incomplete';
  END IF;
  IF (SELECT count(*) FROM procurement_details WHERE item_count = 1) <> 1 THEN
    RAISE EXCEPTION 'legacy request count incorrect';
  END IF;
  IF (SELECT count(*) FROM procurement_request_items WHERE position = 1 AND article = 'Servicio de prueba'
        AND part_number = 'PART-123' AND quantity = 2.5 AND unit = 'horas') <> 1 THEN
    RAISE EXCEPTION 'legacy RPC did not create a line';
  END IF;
  BEGIN
    PERFORM public.create_procurement_request('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Cero', 0, 'unidad', NULL, 'Necesidad', NULL, NULL, NULL, 'Ana', 'Pérez', 'operations');
    RAISE EXCEPTION 'zero quantity accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.create_procurement_request('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Demasiados decimales', 1.2345, 'unidad', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Necesidad', NULL, NULL, NULL, 'Ana', 'Pérez', 'operations');
    RAISE EXCEPTION 'overprecise quantity accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.create_procurement_request('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Sin sede', 1, 'unidad', NULL, 'Necesidad', NULL, NULL, NULL, 'Ana', 'Pérez', 'operations');
    RAISE EXCEPTION 'missing destination accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE work_items SET site_id = NULL WHERE code = 'PRC-000001';
    RAISE EXCEPTION 'destination removed after creation';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.create_procurement_request('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Otra sede', 1, 'unidad', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Necesidad', NULL, NULL, NULL, 'Ana', 'Pérez', 'operations');
    RAISE EXCEPTION 'cross-organization site accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.create_procurement_request('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Archivado', 1, 'unidad', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Necesidad', NULL, (SELECT id FROM vendors WHERE name = 'Archivado'), NULL, 'Ana', 'Pérez', 'operations');
    RAISE EXCEPTION 'archived vendor accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.create_procurement_request('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Proveedor externo', 1, 'unidad', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Necesidad', NULL, '99999999-9999-4999-8999-999999999999', NULL, 'Ana', 'Pérez', 'operations');
    RAISE EXCEPTION 'cross-organization vendor accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  IF (SELECT count(*) FROM work_items WHERE type = 'procurement') <> 1 THEN RAISE EXCEPTION 'partial request remained'; END IF;
  BEGIN
    PERFORM public.create_procurement_request('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Sin solicitante', 1, 'unidad', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Necesidad', NULL, NULL, NULL, NULL, 'Pérez', 'operations');
    RAISE EXCEPTION 'missing requester name accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.create_procurement_request('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Área no válida', 1, 'unidad', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Necesidad', NULL, NULL, NULL, 'Ana', 'Pérez', 'general');
    RAISE EXCEPTION 'invalid requester area accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO work_items(organization_id, creator_id, type, title, site_id)
      VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', auth.uid(), 'procurement', 'Inserción directa', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd')
      RETURNING id INTO direct_item_id;
    INSERT INTO procurement_details(work_item_id, quantity, unit, need) VALUES (direct_item_id, 1, 'unidad', 'Necesidad');
    RAISE EXCEPTION 'direct insert without requester accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

UPDATE procurement_details SET part_number = NULL, requester_last_name = 'García', requester_area = 'finance'
  WHERE work_item_id = (SELECT id FROM work_items WHERE code = 'PRC-000001');
DO $$ BEGIN
  IF (SELECT count(*) FROM procurement_details WHERE requester_last_name = 'García' AND requester_area = 'finance' AND part_number IS NULL) <> 1 THEN
    RAISE EXCEPTION 'requester update failed';
  END IF;
  IF (SELECT count(*) FROM activity_log WHERE after_values->>'requester_area' = 'finance') <> 1 THEN
    RAISE EXCEPTION 'requester change was not audited';
  END IF;
  IF (SELECT count(*) FROM procurement_request_items WHERE position = 1 AND part_number IS NULL) <> 1 THEN
    RAISE EXCEPTION 'first part number did not synchronize';
  END IF;
END $$;
UPDATE work_items SET title = 'Servicio actualizado' WHERE code = 'PRC-000001';
DO $$ BEGIN
  IF (SELECT count(*) FROM procurement_request_items WHERE position = 1 AND article = 'Servicio actualizado') <> 1 THEN
    RAISE EXCEPTION 'first article did not synchronize';
  END IF;
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
DO $$ DECLARE affected integer; BEGIN
  UPDATE procurement_details SET requester_first_name = 'Intruso';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'another organization updated requester'; END IF;
END $$;

RESET ROLE;
DO $$ BEGIN
  IF has_table_privilege('anon', 'public.procurement_details', 'SELECT') THEN RAISE EXCEPTION 'anon can read details'; END IF;
  IF has_table_privilege('authenticated', 'public.procurement_details', 'DELETE') THEN RAISE EXCEPTION 'authenticated can delete details'; END IF;
END $$;
ROLLBACK;
