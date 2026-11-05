BEGIN;

INSERT INTO auth.users(id) VALUES ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');
INSERT INTO public.organizations(id, name) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Organización A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Organización B');
INSERT INTO public.memberships(organization_id,user_id,entra_tenant_id,entra_subject,active) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-cccccccccccc','azure-subject-user-a',true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','cccccccc-cccc-4ccc-8ccc-cccccccccccc','azure-subject-user-b',true);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
INSERT INTO public.vendors(organization_id,name,country,tax_identifier,phone,email,sales_area,contact_name,website,city,products_services_detail,created_by)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Acme','Venezuela','J-001','+58 0414-000','ventas@example.com','Por clasificar','Ana','www.example.com','Caracas','Válvulas',auth.uid());
INSERT INTO public.vendors(organization_id,name,created_by)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Solo nombre',auth.uid());
DO $$ BEGIN
  IF (SELECT count(*) FROM public.vendors WHERE country='Venezuela' AND tax_identifier='J-001' AND sales_area='Por clasificar' AND phone='+58 0414-000') <> 1
    THEN RAISE EXCEPTION 'commercial fields were not preserved'; END IF;
  IF (SELECT count(*) FROM public.vendors WHERE name='Solo nombre' AND associated_area IS NULL) <> 1
    THEN RAISE EXCEPTION 'name-only supplier was rejected'; END IF;
  IF has_column_privilege('anon','public.vendors','country','SELECT') OR NOT has_column_privilege('authenticated','public.vendors','country','INSERT')
    THEN RAISE EXCEPTION 'vendor directory grants are incorrect'; END IF;
  BEGIN
    INSERT INTO public.vendors(organization_id,name,country,tax_identifier,created_by)
    VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Otro nombre',' Venezuela ','J001',auth.uid());
    RAISE EXCEPTION 'duplicate fiscal identifier was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;
INSERT INTO public.vendors(organization_id,name,country,created_by)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Acme','Colombia',auth.uid());
DO $$ BEGIN
  IF (SELECT count(*) FROM public.vendors WHERE name='Acme') <> 2 THEN RAISE EXCEPTION 'same name in another country was rejected'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.vendors) <> 0 THEN RAISE EXCEPTION 'cross-organization read'; END IF;
END $$;
ROLLBACK;
