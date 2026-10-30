-- Extend BL-16 with part numbers and requester identity. Existing PRC rows retain NULLs.
ALTER TABLE public.procurement_details
  ADD COLUMN part_number text CHECK (part_number IS NULL OR length(btrim(part_number)) BETWEEN 1 AND 120),
  ADD COLUMN requester_first_name text CHECK (requester_first_name IS NULL OR length(btrim(requester_first_name)) BETWEEN 1 AND 100),
  ADD COLUMN requester_last_name text CHECK (requester_last_name IS NULL OR length(btrim(requester_last_name)) BETWEEN 1 AND 100),
  ADD COLUMN requester_area text CHECK (requester_area IN ('siaho', 'products_services', 'operations', 'administration', 'finance', 'it'));

CREATE POLICY procurement_details_owner_update ON public.procurement_details FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.work_items item
  WHERE item.id = procurement_details.work_item_id AND item.type = 'procurement'
    AND item.creator_id = auth.uid() AND item.archived_at IS NULL
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.work_items item
  WHERE item.id = procurement_details.work_item_id AND item.type = 'procurement'
    AND item.creator_id = auth.uid() AND item.archived_at IS NULL
));

GRANT INSERT (part_number, requester_first_name, requester_last_name, requester_area)
  ON public.procurement_details TO authenticated;
GRANT UPDATE (part_number, requester_first_name, requester_last_name, requester_area)
  ON public.procurement_details TO authenticated;

-- Keep the old eight-argument RPC during deployment; retire it after Vercel serves the new action.
CREATE FUNCTION public.create_procurement_request(
  p_organization_id uuid, p_title text, p_quantity numeric, p_unit text,
  p_site_id uuid, p_need text, p_reference text, p_vendor_id uuid,
  p_part_number text, p_requester_first_name text, p_requester_last_name text, p_requester_area text
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE created_id uuid;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 OR p_quantity > 99999999999.999
    OR p_quantity <> round(p_quantity, 3) THEN
    RAISE EXCEPTION 'quantity must be positive with at most three decimal places' USING ERRCODE = '23514';
  END IF;
  IF p_requester_first_name IS NULL OR length(btrim(p_requester_first_name)) = 0
    OR p_requester_last_name IS NULL OR length(btrim(p_requester_last_name)) = 0
    OR p_requester_area IS NULL
    OR p_requester_area NOT IN ('siaho', 'products_services', 'operations', 'administration', 'finance', 'it') THEN
    RAISE EXCEPTION 'procurement request requires requester name, surname and area' USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.work_items(organization_id, creator_id, type, title, site_id)
  VALUES (p_organization_id, auth.uid(), 'procurement', p_title, p_site_id)
  RETURNING id INTO created_id;
  INSERT INTO public.procurement_details(work_item_id, quantity, unit, need, reference, vendor_id,
    part_number, requester_first_name, requester_last_name, requester_area)
  VALUES (created_id, p_quantity, p_unit, p_need, p_reference, p_vendor_id,
    p_part_number, p_requester_first_name, p_requester_last_name, p_requester_area);
  RETURN created_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_procurement_request(uuid, text, numeric, text, uuid, text, text, uuid, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_procurement_request(uuid, text, numeric, text, uuid, text, text, uuid, text, text, text, text)
  TO authenticated;

CREATE FUNCTION public.audit_procurement_requester() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE item_organization_id uuid;
BEGIN
  IF ROW(NEW.part_number, NEW.requester_first_name, NEW.requester_last_name, NEW.requester_area)
    IS NOT DISTINCT FROM ROW(OLD.part_number, OLD.requester_first_name, OLD.requester_last_name, OLD.requester_area) THEN
    RETURN NULL;
  END IF;
  SELECT organization_id INTO item_organization_id FROM public.work_items WHERE id = NEW.work_item_id;
  UPDATE public.work_items SET updated_at = now() WHERE id = NEW.work_item_id;
  INSERT INTO public.activity_log(organization_id, work_item_id, action, before_values, after_values, actor_id)
  VALUES (item_organization_id, NEW.work_item_id, 'updated',
    jsonb_build_object('part_number', OLD.part_number, 'requester_first_name', OLD.requester_first_name,
      'requester_last_name', OLD.requester_last_name, 'requester_area', OLD.requester_area),
    jsonb_build_object('part_number', NEW.part_number, 'requester_first_name', NEW.requester_first_name,
      'requester_last_name', NEW.requester_last_name, 'requester_area', NEW.requester_area), auth.uid());
  RETURN NULL;
END;
$$;
CREATE TRIGGER procurement_details_audit_requester
AFTER UPDATE OF part_number, requester_first_name, requester_last_name, requester_area ON public.procurement_details
FOR EACH ROW EXECUTE FUNCTION public.audit_procurement_requester();

REVOKE ALL ON FUNCTION public.audit_procurement_requester() FROM PUBLIC, anon, authenticated;
