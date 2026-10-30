-- BL-16: procurement request details. Apply before publishing request forms.
CREATE TABLE public.procurement_details (
  work_item_id uuid PRIMARY KEY REFERENCES public.work_items(id),
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  unit text NOT NULL CHECK (length(btrim(unit)) BETWEEN 1 AND 40),
  need text NOT NULL CHECK (length(btrim(need)) BETWEEN 1 AND 5000),
  reference text CHECK (reference IS NULL OR length(btrim(reference)) BETWEEN 1 AND 200),
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  vendor_name text CHECK (vendor_name IS NULL OR length(btrim(vendor_name)) BETWEEN 1 AND 200)
);

CREATE FUNCTION public.prepare_procurement_detail() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE item_organization_id uuid;
BEGIN
  SELECT organization_id INTO item_organization_id FROM public.work_items
    WHERE id = NEW.work_item_id AND type = 'procurement';
  IF item_organization_id IS NULL THEN
    RAISE EXCEPTION 'procurement detail requires a PRC work item' USING ERRCODE = '23514';
  END IF;
  IF NEW.vendor_id IS NOT NULL THEN
    SELECT name INTO NEW.vendor_name FROM public.vendors
      WHERE id = NEW.vendor_id AND organization_id = item_organization_id AND archived_at IS NULL;
    IF NEW.vendor_name IS NULL THEN
      RAISE EXCEPTION 'vendor must be active in the same organization' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER procurement_details_prepare BEFORE INSERT ON public.procurement_details
FOR EACH ROW EXECUTE FUNCTION public.prepare_procurement_detail();

ALTER TABLE public.procurement_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY procurement_details_member_read ON public.procurement_details FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.work_items item
  WHERE item.id = procurement_details.work_item_id AND item.type = 'procurement'
));
CREATE POLICY procurement_details_owner_insert ON public.procurement_details FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.work_items item
  WHERE item.id = procurement_details.work_item_id AND item.type = 'procurement'
    AND item.creator_id = auth.uid() AND item.archived_at IS NULL
));

REVOKE ALL ON public.procurement_details FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.procurement_details TO authenticated;
GRANT INSERT (work_item_id, quantity, unit, need, reference, vendor_id)
  ON public.procurement_details TO authenticated;

CREATE FUNCTION public.create_procurement_request(
  p_organization_id uuid, p_title text, p_quantity numeric, p_unit text,
  p_site_id uuid, p_need text, p_reference text, p_vendor_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE created_id uuid;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 OR p_quantity > 99999999999.999
    OR p_quantity <> round(p_quantity, 3) THEN
    RAISE EXCEPTION 'quantity must be positive with at most three decimal places' USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.work_items(organization_id, creator_id, type, title, site_id)
  VALUES (p_organization_id, auth.uid(), 'procurement', p_title, p_site_id)
  RETURNING id INTO created_id;
  INSERT INTO public.procurement_details(work_item_id, quantity, unit, need, reference, vendor_id)
  VALUES (created_id, p_quantity, p_unit, p_need, p_reference, p_vendor_id);
  RETURN created_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_procurement_request(uuid, text, numeric, text, uuid, text, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_procurement_request(uuid, text, numeric, text, uuid, text, text, uuid)
  TO authenticated;

CREATE FUNCTION public.require_procurement_site() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.type = 'procurement' AND NEW.site_id IS NULL THEN
    RAISE EXCEPTION 'procurement work item requires destination site' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER work_items_procurement_site BEFORE INSERT OR UPDATE ON public.work_items
FOR EACH ROW EXECUTE FUNCTION public.require_procurement_site();

CREATE FUNCTION public.require_procurement_detail() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.procurement_details WHERE work_item_id = NEW.id) THEN
    RAISE EXCEPTION 'procurement work item requires procurement_details' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER work_items_require_procurement_detail
AFTER INSERT ON public.work_items
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW WHEN (NEW.type = 'procurement')
EXECUTE FUNCTION public.require_procurement_detail();

REVOKE ALL ON FUNCTION public.prepare_procurement_detail() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.require_procurement_detail() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.require_procurement_site() FROM PUBLIC, anon, authenticated;
