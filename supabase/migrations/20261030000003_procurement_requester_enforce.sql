-- Apply only after the new procurement form is available on staging.
CREATE FUNCTION public.require_procurement_requester() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.requester_first_name IS NULL OR length(btrim(NEW.requester_first_name)) = 0
    OR NEW.requester_last_name IS NULL OR length(btrim(NEW.requester_last_name)) = 0
    OR NEW.requester_area IS NULL THEN
    RAISE EXCEPTION 'procurement request requires requester name, surname and area' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER procurement_details_require_requester
BEFORE INSERT OR UPDATE OF requester_first_name, requester_last_name, requester_area ON public.procurement_details
FOR EACH ROW EXECUTE FUNCTION public.require_procurement_requester();

DROP FUNCTION public.create_procurement_request(uuid, text, numeric, text, uuid, text, text, uuid);
REVOKE ALL ON FUNCTION public.require_procurement_requester() FROM PUBLIC, anon, authenticated;
