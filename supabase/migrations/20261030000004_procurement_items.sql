-- Multiple articles per procurement request, preserving existing single-article data.
ALTER TABLE public.procurement_details
  ADD COLUMN item_count integer NOT NULL DEFAULT 1 CHECK (item_count BETWEEN 1 AND 50);

CREATE TABLE public.procurement_request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_item_id uuid NOT NULL REFERENCES public.work_items(id),
  position integer NOT NULL CHECK (position BETWEEN 1 AND 50),
  article text NOT NULL CHECK (length(btrim(article)) BETWEEN 1 AND 200),
  part_number text CHECK (part_number IS NULL OR length(btrim(part_number)) BETWEEN 1 AND 120),
  quantity numeric NOT NULL CHECK (quantity > 0 AND quantity <= 99999999999.999 AND quantity = round(quantity, 3)),
  unit text NOT NULL CHECK (length(btrim(unit)) BETWEEN 1 AND 40),
  UNIQUE (work_item_id, position)
);
CREATE INDEX procurement_request_items_work_item_idx ON public.procurement_request_items(work_item_id, position);

INSERT INTO public.procurement_request_items(work_item_id, position, article, part_number, quantity, unit)
SELECT details.work_item_id, 1, item.title, details.part_number, details.quantity, details.unit
FROM public.procurement_details details
JOIN public.work_items item ON item.id = details.work_item_id AND item.type = 'procurement';

ALTER TABLE public.procurement_request_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY procurement_request_items_member_read ON public.procurement_request_items FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.work_items item
  WHERE item.id = procurement_request_items.work_item_id AND item.type = 'procurement'
));
CREATE POLICY procurement_request_items_owner_insert ON public.procurement_request_items FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.work_items item
  WHERE item.id = procurement_request_items.work_item_id AND item.type = 'procurement'
    AND item.creator_id = auth.uid() AND item.archived_at IS NULL
));
REVOKE ALL ON public.procurement_request_items FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.procurement_request_items TO authenticated;
GRANT INSERT (work_item_id, position, article, part_number, quantity, unit)
  ON public.procurement_request_items TO authenticated;

CREATE FUNCTION public.seed_procurement_first_item() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE first_article text;
BEGIN
  SELECT title INTO first_article FROM public.work_items WHERE id = NEW.work_item_id AND type = 'procurement';
  INSERT INTO public.procurement_request_items(work_item_id, position, article, part_number, quantity, unit)
  VALUES (NEW.work_item_id, 1, first_article, NEW.part_number, NEW.quantity, NEW.unit);
  RETURN NULL;
END;
$$;
CREATE TRIGGER procurement_details_seed_first_item AFTER INSERT ON public.procurement_details
FOR EACH ROW EXECUTE FUNCTION public.seed_procurement_first_item();

CREATE FUNCTION public.count_procurement_item() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.position > 1 THEN
    UPDATE public.procurement_details SET item_count = item_count + 1
      WHERE work_item_id = NEW.work_item_id;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER procurement_request_items_count AFTER INSERT ON public.procurement_request_items
FOR EACH ROW EXECUTE FUNCTION public.count_procurement_item();

CREATE FUNCTION public.sync_procurement_first_part() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.part_number IS DISTINCT FROM OLD.part_number THEN
    UPDATE public.procurement_request_items SET part_number = NEW.part_number
      WHERE work_item_id = NEW.work_item_id AND position = 1;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER procurement_details_sync_first_part AFTER UPDATE OF part_number ON public.procurement_details
FOR EACH ROW EXECUTE FUNCTION public.sync_procurement_first_part();

CREATE FUNCTION public.sync_procurement_first_article() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.type = 'procurement' AND NEW.title IS DISTINCT FROM OLD.title THEN
    UPDATE public.procurement_request_items SET article = NEW.title
      WHERE work_item_id = NEW.id AND position = 1;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER work_items_sync_first_article AFTER UPDATE OF title ON public.work_items
FOR EACH ROW EXECUTE FUNCTION public.sync_procurement_first_article();

CREATE FUNCTION public.create_procurement_request_multi(
  p_organization_id uuid, p_site_id uuid, p_need text, p_reference text, p_vendor_id uuid,
  p_requester_first_name text, p_requester_last_name text, p_requester_area text, p_items jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  line_count integer;
  line_index integer;
  line jsonb;
  article_value text;
  part_value text;
  quantity_value text;
  unit_value text;
  created_id uuid;
BEGIN
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'items must be an array' USING ERRCODE = '23514';
  END IF;
  line_count := jsonb_array_length(p_items);
  IF line_count < 1 OR line_count > 50 THEN
    RAISE EXCEPTION 'request requires 1 to 50 items' USING ERRCODE = '23514';
  END IF;
  FOR line_index IN 0..line_count - 1 LOOP
    line := p_items -> line_index;
    IF jsonb_typeof(line) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'each item must be an object' USING ERRCODE = '23514';
    END IF;
    article_value := btrim(coalesce(line ->> 'article', ''));
    part_value := nullif(btrim(coalesce(line ->> 'partNumber', '')), '');
    quantity_value := line ->> 'quantity';
    unit_value := btrim(coalesce(line ->> 'unit', ''));
    IF length(article_value) NOT BETWEEN 1 AND 200
      OR (part_value IS NOT NULL AND length(part_value) > 120)
      OR length(unit_value) NOT BETWEEN 1 AND 40
      OR quantity_value IS NULL
      OR quantity_value !~ '^(0|[1-9][0-9]{0,10})(\.[0-9]{1,3})?$' THEN
      RAISE EXCEPTION 'invalid procurement item' USING ERRCODE = '23514';
    END IF;
    IF quantity_value::numeric <= 0 THEN
      RAISE EXCEPTION 'item quantity must be positive' USING ERRCODE = '23514';
    END IF;
  END LOOP;

  line := p_items -> 0;
  INSERT INTO public.work_items(organization_id, creator_id, type, title, site_id)
  VALUES (p_organization_id, auth.uid(), 'procurement', btrim(line ->> 'article'), p_site_id)
  RETURNING id INTO created_id;
  INSERT INTO public.procurement_details(work_item_id, quantity, unit, need, reference, vendor_id,
    part_number, requester_first_name, requester_last_name, requester_area)
  VALUES (created_id, (line ->> 'quantity')::numeric, btrim(line ->> 'unit'), p_need, p_reference, p_vendor_id,
    nullif(btrim(coalesce(line ->> 'partNumber', '')), ''), p_requester_first_name, p_requester_last_name, p_requester_area);

  IF line_count > 1 THEN
    FOR line_index IN 2..line_count LOOP
      line := p_items -> (line_index - 1);
      INSERT INTO public.procurement_request_items(work_item_id, position, article, part_number, quantity, unit)
      VALUES (created_id, line_index, btrim(line ->> 'article'),
        nullif(btrim(coalesce(line ->> 'partNumber', '')), ''), (line ->> 'quantity')::numeric, btrim(line ->> 'unit'));
    END LOOP;
  END IF;
  RETURN created_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_procurement_request_multi(uuid, uuid, text, text, uuid, text, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_procurement_request_multi(uuid, uuid, text, text, uuid, text, text, text, jsonb)
  TO authenticated;

REVOKE ALL ON FUNCTION public.seed_procurement_first_item() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.count_procurement_item() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_procurement_first_part() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_procurement_first_article() FROM PUBLIC, anon, authenticated;
