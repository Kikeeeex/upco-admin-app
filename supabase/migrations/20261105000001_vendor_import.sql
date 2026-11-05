-- Preserve name-only imports without duplicating vendors whose country is unknown.
CREATE UNIQUE INDEX vendors_org_name_no_country_key ON public.vendors (
  organization_id, lower(btrim(regexp_replace(name, '[[:space:]]+', ' ', 'g')))
) WHERE country IS NULL;

CREATE TABLE public.vendor_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  format text NOT NULL CHECK (format IN ('xlsx', 'csv')),
  rows_read integer NOT NULL CHECK (rows_read BETWEEN 0 AND 10000),
  created_count integer NOT NULL CHECK (created_count >= 0),
  updated_count integer NOT NULL CHECK (updated_count >= 0),
  skipped_count integer NOT NULL CHECK (skipped_count >= 0),
  rejected_count integer NOT NULL CHECK (rejected_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (rows_read = created_count + updated_count + skipped_count + rejected_count)
);
CREATE INDEX vendor_import_batches_org_created_idx ON public.vendor_import_batches(organization_id, created_at DESC);
ALTER TABLE public.vendor_import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY vendor_import_batches_member_read ON public.vendor_import_batches FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.memberships m WHERE m.organization_id=vendor_import_batches.organization_id AND m.user_id=auth.uid() AND m.active));
REVOKE ALL ON public.vendor_import_batches FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vendor_import_batches TO authenticated;

CREATE FUNCTION public.import_vendor_directory(p_organization_id uuid, p_format text, p_rows jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  actor uuid := auth.uid();
  item jsonb;
  data jsonb;
  row_mode text;
  source_row integer;
  vendor_name text;
  vendor_country text;
  vendor_tax text;
  vendor_id uuid;
  selected_fields text[];
  field_name text;
  inserted integer := 0;
  updated integer := 0;
  skipped integer := 0;
  rejected integer := 0;
  batch_id uuid;
  outcomes jsonb := '[]'::jsonb;
BEGIN
  IF actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.memberships m
    WHERE m.organization_id=p_organization_id AND m.user_id=actor AND m.active) THEN
    RAISE EXCEPTION 'vendor import not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_format NOT IN ('xlsx','csv') OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_rows) > 10000 THEN
    RAISE EXCEPTION 'invalid vendor import batch' USING ERRCODE = '23514';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_organization_id::text, 0));
  FOR item IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    row_mode := item->>'mode';
    source_row := (item->>'sourceRow')::integer;
    IF source_row IS NULL OR source_row < 2 THEN RAISE EXCEPTION 'invalid source row' USING ERRCODE = '23514'; END IF;
    IF row_mode = 'reject' THEN
      rejected := rejected + 1;
      outcomes := outcomes || jsonb_build_array(jsonb_build_object('sourceRow',source_row,'status','rejected'));
      CONTINUE;
    END IF;
    IF row_mode = 'skip' THEN
      skipped := skipped + 1;
      outcomes := outcomes || jsonb_build_array(jsonb_build_object('sourceRow',source_row,'status','skipped'));
      CONTINUE;
    END IF;
    data := item->'data';
    IF jsonb_typeof(data) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'vendor row lacks data' USING ERRCODE = '23514';
    END IF;
    vendor_name := nullif(btrim(data->>'name'), '');
    vendor_country := nullif(btrim(data->>'country'), '');
    vendor_tax := nullif(btrim(data->>'taxIdentifier'), '');
    IF vendor_name IS NULL THEN RAISE EXCEPTION 'vendor name is required' USING ERRCODE = '23514'; END IF;
    IF row_mode = 'create' THEN
      IF EXISTS (SELECT 1 FROM public.vendors v WHERE v.organization_id=p_organization_id AND (
        (vendor_country IS NOT NULL AND vendor_tax IS NOT NULL AND v.country IS NOT NULL AND v.tax_identifier IS NOT NULL
          AND lower(btrim(regexp_replace(v.country, '[[:space:]]+', ' ', 'g'))) = lower(btrim(regexp_replace(vendor_country, '[[:space:]]+', ' ', 'g')))
          AND upper(regexp_replace(v.tax_identifier, '[^[:alnum:]]', '', 'g')) = upper(regexp_replace(vendor_tax, '[^[:alnum:]]', '', 'g')))
        OR (lower(btrim(regexp_replace(v.name, '[[:space:]]+', ' ', 'g'))) = lower(btrim(regexp_replace(vendor_name, '[[:space:]]+', ' ', 'g')))
          AND (v.country IS NULL OR vendor_country IS NULL OR lower(btrim(regexp_replace(v.country, '[[:space:]]+', ' ', 'g'))) = lower(btrim(regexp_replace(vendor_country, '[[:space:]]+', ' ', 'g')))))
      )) THEN
        skipped := skipped + 1;
        outcomes := outcomes || jsonb_build_array(jsonb_build_object('sourceRow',source_row,'status','skipped'));
        CONTINUE;
      END IF;
      vendor_id := NULL;
      INSERT INTO public.vendors(organization_id,created_by,name,country,tax_identifier,phone,email,sales_area,contact_name,website,city,products_services_detail)
      VALUES (p_organization_id,actor,vendor_name,vendor_country,vendor_tax,nullif(btrim(data->>'phone'),''),
        nullif(btrim(data->>'email'),''),nullif(btrim(data->>'salesArea'),''),nullif(btrim(data->>'contactPerson'),''),
        nullif(btrim(data->>'website'),''),nullif(btrim(data->>'city'),''),nullif(btrim(data->>'productsServicesDetail'),''))
      ON CONFLICT DO NOTHING RETURNING id INTO vendor_id;
      IF vendor_id IS NULL THEN
        skipped := skipped + 1;
        outcomes := outcomes || jsonb_build_array(jsonb_build_object('sourceRow',source_row,'status','skipped'));
      ELSE
        inserted := inserted + 1;
        outcomes := outcomes || jsonb_build_array(jsonb_build_object('sourceRow',source_row,'status','created'));
      END IF;
    ELSIF row_mode = 'update' THEN
      IF jsonb_typeof(item->'fields') IS DISTINCT FROM 'array' OR jsonb_array_length(item->'fields') = 0 THEN
        RAISE EXCEPTION 'update fields are required' USING ERRCODE = '23514';
      END IF;
      SELECT array_agg(value) INTO selected_fields FROM jsonb_array_elements_text(item->'fields');
      FOREACH field_name IN ARRAY selected_fields LOOP
        IF field_name NOT IN ('name','country','taxIdentifier','phone','email','salesArea','contactPerson','website','city','productsServicesDetail') THEN
          RAISE EXCEPTION 'invalid update field' USING ERRCODE = '23514';
        END IF;
      END LOOP;
      IF NOT EXISTS (SELECT 1 FROM unnest(selected_fields) f WHERE nullif(btrim(data->>f),'') IS NOT NULL) THEN
        skipped := skipped + 1;
        outcomes := outcomes || jsonb_build_array(jsonb_build_object('sourceRow',source_row,'status','skipped'));
        CONTINUE;
      END IF;
      BEGIN vendor_id := (item->>'vendorId')::uuid;
      EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid vendor ID' USING ERRCODE = '23514'; END;
      UPDATE public.vendors v SET
        name = CASE WHEN 'name'=ANY(selected_fields) THEN coalesce(nullif(btrim(data->>'name'),''),v.name) ELSE v.name END,
        country = CASE WHEN 'country'=ANY(selected_fields) THEN coalesce(nullif(btrim(data->>'country'),''),v.country) ELSE v.country END,
        tax_identifier = CASE WHEN 'taxIdentifier'=ANY(selected_fields) THEN coalesce(nullif(btrim(data->>'taxIdentifier'),''),v.tax_identifier) ELSE v.tax_identifier END,
        phone = CASE WHEN 'phone'=ANY(selected_fields) THEN coalesce(nullif(btrim(data->>'phone'),''),v.phone) ELSE v.phone END,
        email = CASE WHEN 'email'=ANY(selected_fields) THEN coalesce(nullif(btrim(data->>'email'),''),v.email) ELSE v.email END,
        sales_area = CASE WHEN 'salesArea'=ANY(selected_fields) THEN coalesce(nullif(btrim(data->>'salesArea'),''),v.sales_area) ELSE v.sales_area END,
        contact_name = CASE WHEN 'contactPerson'=ANY(selected_fields) THEN coalesce(nullif(btrim(data->>'contactPerson'),''),v.contact_name) ELSE v.contact_name END,
        website = CASE WHEN 'website'=ANY(selected_fields) THEN coalesce(nullif(btrim(data->>'website'),''),v.website) ELSE v.website END,
        city = CASE WHEN 'city'=ANY(selected_fields) THEN coalesce(nullif(btrim(data->>'city'),''),v.city) ELSE v.city END,
        products_services_detail = CASE WHEN 'productsServicesDetail'=ANY(selected_fields) THEN coalesce(nullif(btrim(data->>'productsServicesDetail'),''),v.products_services_detail) ELSE v.products_services_detail END
      WHERE v.id=vendor_id AND v.organization_id=p_organization_id AND v.created_by=actor AND v.archived_at IS NULL;
      IF FOUND THEN
        updated := updated + 1;
        outcomes := outcomes || jsonb_build_array(jsonb_build_object('sourceRow',source_row,'status','updated'));
      ELSE
        skipped := skipped + 1;
        outcomes := outcomes || jsonb_build_array(jsonb_build_object('sourceRow',source_row,'status','skipped'));
      END IF;
    ELSE
      RAISE EXCEPTION 'invalid vendor import action' USING ERRCODE = '23514';
    END IF;
  END LOOP;
  INSERT INTO public.vendor_import_batches(organization_id,created_by,format,rows_read,created_count,updated_count,skipped_count,rejected_count)
  VALUES (p_organization_id,actor,p_format,jsonb_array_length(p_rows),inserted,updated,skipped,rejected)
  RETURNING id INTO batch_id;
  RETURN jsonb_build_object('batchId',batch_id,'created',inserted,'updated',updated,'skipped',skipped,'rejected',rejected,'results',outcomes);
END;
$$;
REVOKE ALL ON FUNCTION public.import_vendor_directory(uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.import_vendor_directory(uuid,text,jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';
