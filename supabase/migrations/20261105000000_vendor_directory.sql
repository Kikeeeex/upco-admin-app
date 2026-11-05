-- Extend the existing catalog without changing vendor IDs or linked requests.
ALTER TABLE public.vendors
  ADD COLUMN country text CHECK (country IS NULL OR length(btrim(country)) BETWEEN 1 AND 100),
  ADD COLUMN tax_identifier text CHECK (tax_identifier IS NULL OR length(btrim(tax_identifier)) BETWEEN 1 AND 100),
  ADD COLUMN sales_area text CHECK (sales_area IS NULL OR length(btrim(sales_area)) BETWEEN 1 AND 200),
  ADD COLUMN website text CHECK (website IS NULL OR length(btrim(website)) BETWEEN 1 AND 500),
  ADD COLUMN city text CHECK (city IS NULL OR length(btrim(city)) BETWEEN 1 AND 150),
  ADD COLUMN products_services_detail text CHECK (products_services_detail IS NULL OR length(btrim(products_services_detail)) > 0);

-- The six legacy UPCO departments are distinct from commercial sales areas.
DROP TRIGGER vendors_require_area ON public.vendors;
DROP FUNCTION public.require_vendor_area();

-- The previous name-only rule prevented legitimate vendors in different countries.
DROP INDEX public.vendors_org_name_key;
CREATE UNIQUE INDEX vendors_org_tax_country_key ON public.vendors (
  organization_id,
  lower(btrim(regexp_replace(country, '[[:space:]]+', ' ', 'g'))),
  upper(regexp_replace(tax_identifier, '[^[:alnum:]]', '', 'g'))
) WHERE country IS NOT NULL AND tax_identifier IS NOT NULL;
CREATE UNIQUE INDEX vendors_org_name_country_key ON public.vendors (
  organization_id,
  lower(btrim(regexp_replace(name, '[[:space:]]+', ' ', 'g'))),
  lower(btrim(regexp_replace(country, '[[:space:]]+', ' ', 'g')))
) WHERE country IS NOT NULL AND tax_identifier IS NULL;

ALTER TABLE public.vendors ADD COLUMN search_document tsvector GENERATED ALWAYS AS (
  to_tsvector('simple'::regconfig,
    coalesce(name, '') || ' ' || coalesce(country, '') || ' ' || coalesce(tax_identifier, '') || ' ' ||
    coalesce(contact_name, '') || ' ' || coalesce(sales_area, '') || ' ' || coalesce(products_services_detail, ''))
) STORED;
CREATE INDEX vendors_search_document_idx ON public.vendors USING gin(search_document);
CREATE INDEX vendors_org_country_area_idx ON public.vendors(organization_id, country, sales_area) WHERE archived_at IS NULL;

GRANT INSERT (country, tax_identifier, sales_area, website, city, products_services_detail) ON public.vendors TO authenticated;
GRANT UPDATE (country, tax_identifier, sales_area, website, city, products_services_detail) ON public.vendors TO authenticated;

CREATE OR REPLACE FUNCTION public.prepare_vendor() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'immutable vendor fields cannot be changed' USING ERRCODE = '23514';
  END IF;
  IF OLD.archived_at IS NOT NULL AND NEW.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'archived vendor must be restored before editing' USING ERRCODE = '23514';
  END IF;
  IF OLD.archived_at < now() - interval '30 days' AND NEW.archived_at IS NULL THEN
    RAISE EXCEPTION 'expired archived vendor cannot be restored' USING ERRCODE = '23514';
  END IF;
  IF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
    IF ROW(NEW.name, NEW.associated_area, NEW.contact_name, NEW.email, NEW.phone, NEW.notes,
      NEW.country, NEW.tax_identifier, NEW.sales_area, NEW.website, NEW.city, NEW.products_services_detail)
       IS DISTINCT FROM ROW(OLD.name, OLD.associated_area, OLD.contact_name, OLD.email, OLD.phone, OLD.notes,
      OLD.country, OLD.tax_identifier, OLD.sales_area, OLD.website, OLD.city, OLD.products_services_detail) THEN
      RAISE EXCEPTION 'archive transition cannot edit vendor details' USING ERRCODE = '23514';
    END IF;
    IF NEW.archived_at IS NOT NULL THEN NEW.archived_at := now(); END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
NOTIFY pgrst, 'reload schema';
