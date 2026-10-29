-- BL-13: administration details. Apply before publishing the Administration UI.
CREATE TABLE public.admin_details (
  work_item_id uuid PRIMARY KEY REFERENCES public.work_items(id),
  procedure_type text NOT NULL CHECK (length(btrim(procedure_type)) BETWEEN 1 AND 120),
  counterpart_name text NOT NULL CHECK (length(btrim(counterpart_name)) BETWEEN 1 AND 200),
  reference text CHECK (reference IS NULL OR length(btrim(reference)) BETWEEN 1 AND 200),
  document_status text NOT NULL DEFAULT 'pending' CHECK (document_status IN ('pending', 'received', 'reviewed')),
  document_reference text CHECK (document_reference IS NULL OR length(btrim(document_reference)) BETWEEN 1 AND 200),
  document_url text CHECK (document_url IS NULL OR (length(document_url) <= 2000 AND document_url ~* '^https?://[^[:space:]]+$'))
);

-- Earlier builds allowed choosing Administration in the generic work form.
-- Keep those ADM rows visible until their specific fields are completed.
INSERT INTO public.admin_details(work_item_id, procedure_type, counterpart_name)
SELECT id, 'Sin registrar', 'Sin registrar' FROM public.work_items WHERE type = 'administration';

ALTER TABLE public.admin_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_details_member_read ON public.admin_details FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.work_items item
  WHERE item.id = admin_details.work_item_id AND item.type = 'administration'
));

CREATE POLICY admin_details_owner_insert ON public.admin_details FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.work_items item
  WHERE item.id = admin_details.work_item_id AND item.type = 'administration'
    AND item.creator_id = auth.uid() AND item.archived_at IS NULL
));

CREATE POLICY admin_details_owner_update ON public.admin_details FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.work_items item
  WHERE item.id = admin_details.work_item_id AND item.type = 'administration'
    AND item.creator_id = auth.uid() AND item.archived_at IS NULL
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.work_items item
  WHERE item.id = admin_details.work_item_id AND item.type = 'administration'
    AND item.creator_id = auth.uid() AND item.archived_at IS NULL
));

-- Supabase can grant broad privileges on new tables through default privileges.
REVOKE ALL ON public.admin_details FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.admin_details TO authenticated;
GRANT INSERT (work_item_id, procedure_type, counterpart_name, reference, document_status,
  document_reference, document_url) ON public.admin_details TO authenticated;
GRANT UPDATE (procedure_type, counterpart_name, reference, document_status,
  document_reference, document_url) ON public.admin_details TO authenticated;

CREATE FUNCTION public.create_admin_matter(
  p_organization_id uuid,
  p_title text,
  p_procedure_type text,
  p_counterpart_name text,
  p_reference text,
  p_commitment_date date,
  p_document_status text,
  p_document_reference text,
  p_document_url text,
  p_description text,
  p_site_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE created_id uuid;
BEGIN
  INSERT INTO public.work_items(organization_id, creator_id, type, title, description, due_date, site_id)
  VALUES (p_organization_id, auth.uid(), 'administration', p_title, p_description, p_commitment_date, p_site_id)
  RETURNING id INTO created_id;

  INSERT INTO public.admin_details(work_item_id, procedure_type, counterpart_name, reference,
    document_status, document_reference, document_url)
  VALUES (created_id, p_procedure_type, p_counterpart_name, p_reference,
    p_document_status, p_document_reference, p_document_url);
  RETURN created_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_admin_matter(uuid, text, text, text, text, date, text, text, text, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_admin_matter(uuid, text, text, text, text, date, text, text, text, text, uuid)
  TO authenticated;

CREATE FUNCTION public.audit_admin_detail() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE item_organization_id uuid;
BEGIN
  IF ROW(NEW.procedure_type, NEW.counterpart_name, NEW.reference, NEW.document_status,
    NEW.document_reference, NEW.document_url) IS NOT DISTINCT FROM
    ROW(OLD.procedure_type, OLD.counterpart_name, OLD.reference, OLD.document_status,
    OLD.document_reference, OLD.document_url) THEN
    RETURN NULL;
  END IF;
  SELECT organization_id INTO item_organization_id FROM public.work_items WHERE id = NEW.work_item_id;
  UPDATE public.work_items SET updated_at = now() WHERE id = NEW.work_item_id;
  INSERT INTO public.activity_log(organization_id, work_item_id, action, before_values, after_values, actor_id)
  VALUES (item_organization_id, NEW.work_item_id, 'updated',
    jsonb_build_object('procedure_type', OLD.procedure_type, 'counterpart_name', OLD.counterpart_name,
      'reference', OLD.reference, 'document_status', OLD.document_status,
      'document_reference', OLD.document_reference, 'document_url', OLD.document_url),
    jsonb_build_object('procedure_type', NEW.procedure_type, 'counterpart_name', NEW.counterpart_name,
      'reference', NEW.reference, 'document_status', NEW.document_status,
      'document_reference', NEW.document_reference, 'document_url', NEW.document_url), auth.uid());
  RETURN NULL;
END;
$$;
CREATE TRIGGER admin_details_audit AFTER UPDATE ON public.admin_details
FOR EACH ROW EXECUTE FUNCTION public.audit_admin_detail();
REVOKE ALL ON FUNCTION public.audit_admin_detail() FROM PUBLIC, anon, authenticated;
