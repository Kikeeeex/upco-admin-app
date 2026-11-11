BEGIN;
INSERT INTO auth.users(id) VALUES ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');
INSERT INTO public.organizations(id,name) VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Organización A'), ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Organización B');
INSERT INTO public.memberships(organization_id,user_id,entra_tenant_id,entra_subject,active) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-cccccccccccc','azure-subject-user-a',true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','cccccccc-cccc-4ccc-8ccc-cccccccccccc','azure-subject-user-b',true);
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
DO $$ DECLARE result jsonb; BEGIN
  result := public.import_vendor_directory('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','xlsx',
    '[{"sourceRow":2,"mode":"create","data":{"name":"Proveedor Uno","country":"Venezuela","taxIdentifier":"J-001","phone":"+58 0414-000","email":"ventas@example.com","salesArea":"Por clasificar","contactPerson":"Ana","website":"www.example.com","city":"Caracas","productsServicesDetail":"Válvulas"}},{"sourceRow":3,"mode":"reject"}]'::jsonb);
  IF result->>'created' <> '1' OR result->>'rejected' <> '1' THEN RAISE EXCEPTION 'wrong import result %', result; END IF;
  IF result->'results' IS DISTINCT FROM '[{"sourceRow":2,"status":"created"},{"sourceRow":3,"status":"rejected"}]'::jsonb THEN RAISE EXCEPTION 'missing row outcomes %', result; END IF;
  IF (SELECT count(*) FROM public.vendors WHERE name='Proveedor Uno' AND associated_area IS NULL AND phone='+58 0414-000') <> 1
    THEN RAISE EXCEPTION 'imported vendor missing'; END IF;
  IF (SELECT count(*) FROM public.vendor_import_batches WHERE created_count=1 AND rejected_count=1) <> 1
    THEN RAISE EXCEPTION 'batch metadata missing'; END IF;
  result := public.import_vendor_directory('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','xlsx',
    '[{"sourceRow":2,"mode":"create","data":{"name":"PROVEEDOR UNO","country":"Venezuela","taxIdentifier":"J001"}}]'::jsonb);
  IF result->>'created' <> '0' OR result->>'skipped' <> '1' THEN RAISE EXCEPTION 'duplicate was not skipped %', result; END IF;
  IF result->'results' IS DISTINCT FROM '[{"sourceRow":2,"status":"skipped"}]'::jsonb THEN RAISE EXCEPTION 'missing duplicate outcome %', result; END IF;
END $$;
DO $$ DECLARE target_vendor_id uuid; result jsonb; BEGIN
  SELECT v.id INTO target_vendor_id FROM public.vendors v WHERE v.name='Proveedor Uno';
  result := public.import_vendor_directory('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','csv',
    jsonb_build_array(jsonb_build_object('sourceRow',2,'mode','update','vendorId',target_vendor_id,'fields',jsonb_build_array('phone','email'),
      'data',jsonb_build_object('name','Proveedor Uno','phone','+58 000','email',''))));
  IF result->>'updated' <> '1' THEN RAISE EXCEPTION 'update count wrong'; END IF;
  IF (SELECT count(*) FROM public.vendors WHERE public.vendors.id=target_vendor_id AND phone='+58 000' AND email='ventas@example.com') <> 1
    THEN RAISE EXCEPTION 'blank import cell erased old data'; END IF;
END $$;
DO $$ DECLARE before_count integer; BEGIN
  SELECT count(*) INTO before_count FROM public.vendor_import_batches;
  BEGIN
    PERFORM public.import_vendor_directory('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','csv',
      '[{"sourceRow":2,"mode":"create","data":{"name":"Fila válida","country":"Colombia"}},{"sourceRow":3,"mode":"create","data":{"name":"Correo inválido","email":"mal"}}]'::jsonb);
    RAISE EXCEPTION 'invalid batch accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  IF EXISTS (SELECT 1 FROM public.vendors WHERE name='Fila válida') OR (SELECT count(*) FROM public.vendor_import_batches) <> before_count
    THEN RAISE EXCEPTION 'failed batch left partial data'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.vendor_import_batches) <> 0 THEN RAISE EXCEPTION 'cross-organization batch read'; END IF;
  BEGIN
    PERFORM public.import_vendor_directory('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','csv','[]'::jsonb);
    RAISE EXCEPTION 'cross-organization import accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
ROLLBACK;
