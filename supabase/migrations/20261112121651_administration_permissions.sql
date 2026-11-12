CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA private TO authenticated,service_role;

CREATE TABLE public.administration_permissions (
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  permission text NOT NULL CHECK (permission IN (
    'purchases.read','purchases.manage','vendors.read','vendors.manage','retentions.read','books.read',
    'imports.validate','reports.export','fiscal_settings.read','fiscal_settings.manage'
  )),
  granted_by uuid NOT NULL REFERENCES auth.users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,user_id,permission),
  FOREIGN KEY (organization_id,user_id) REFERENCES public.memberships(organization_id,user_id) ON DELETE CASCADE
);
CREATE INDEX administration_permissions_user_idx ON public.administration_permissions(organization_id,user_id);
ALTER TABLE public.administration_permissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.administration_permissions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.administration_permissions TO authenticated;
CREATE FUNCTION private.is_active_administration_admin(p_organization_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships m WHERE m.organization_id=p_organization_id AND m.user_id=auth.uid() AND m.active AND m.role='admin');
$$;
CREATE FUNCTION private.can_administer_member_profile(p_target_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships target JOIN public.memberships actor ON actor.organization_id=target.organization_id
    WHERE target.user_id=p_target_user_id AND target.active AND actor.user_id=auth.uid() AND actor.active AND actor.role='admin'
  );
$$;
REVOKE ALL ON FUNCTION private.is_active_administration_admin(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.can_administer_member_profile(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.is_active_administration_admin(uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.can_administer_member_profile(uuid) TO authenticated,service_role;
CREATE POLICY administration_permissions_self_or_admin_read ON public.administration_permissions FOR SELECT TO authenticated
USING ((user_id = auth.uid() AND EXISTS (
  SELECT 1 FROM public.memberships self WHERE self.organization_id=administration_permissions.organization_id
    AND self.user_id=auth.uid() AND self.active
)) OR private.is_active_administration_admin(organization_id));

CREATE TABLE public.administration_permission_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  target_user_id uuid NOT NULL REFERENCES auth.users(id),
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  previous_permissions text[] NOT NULL,
  next_permissions text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id,target_user_id) REFERENCES public.memberships(organization_id,user_id)
);
CREATE INDEX administration_permission_events_org_created_idx ON public.administration_permission_events(organization_id,created_at DESC);
ALTER TABLE public.administration_permission_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.administration_permission_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.administration_permission_events TO authenticated;
CREATE POLICY administration_permission_events_admin_read ON public.administration_permission_events FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.memberships m WHERE m.organization_id=administration_permission_events.organization_id
    AND m.user_id=auth.uid() AND m.active AND m.role='admin'
));

CREATE FUNCTION private.has_administration_permission(p_organization_id uuid,p_permission text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.organization_id=p_organization_id AND m.user_id=auth.uid() AND m.active
      AND (m.role='admin' OR EXISTS (
        SELECT 1 FROM public.administration_permissions p
        WHERE p.organization_id=m.organization_id AND p.user_id=m.user_id AND p.permission=p_permission
      ))
  );
$$;
REVOKE ALL ON FUNCTION private.has_administration_permission(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.has_administration_permission(uuid,text) TO authenticated,service_role;

CREATE FUNCTION public.replace_administration_permissions(p_organization_id uuid,p_target_user_id uuid,p_actor_id uuid,p_permissions text[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_actor uuid := p_actor_id;
  v_previous text[];
  v_next text[];
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.memberships m WHERE m.organization_id=p_organization_id AND m.user_id=v_actor AND m.active AND m.role='admin') THEN RAISE EXCEPTION 'administrator access required' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships m WHERE m.organization_id=p_organization_id AND m.user_id=p_target_user_id AND m.active AND m.role='member'
  ) THEN RAISE EXCEPTION 'active member not found' USING ERRCODE='P0002'; END IF;
  v_next := ARRAY(SELECT DISTINCT x FROM unnest(coalesce(p_permissions,'{}'::text[])) x ORDER BY x);
  IF EXISTS (SELECT 1 FROM unnest(v_next) x WHERE x NOT IN (
    'purchases.read','purchases.manage','vendors.read','vendors.manage','retentions.read','books.read',
    'imports.validate','reports.export','fiscal_settings.read','fiscal_settings.manage'
  )) THEN RAISE EXCEPTION 'unsupported administration permission' USING ERRCODE='22023'; END IF;
  SELECT coalesce(array_agg(p.permission ORDER BY p.permission),'{}'::text[]) INTO v_previous
    FROM public.administration_permissions p WHERE p.organization_id=p_organization_id AND p.user_id=p_target_user_id;
  IF v_previous IS DISTINCT FROM v_next THEN
    DELETE FROM public.administration_permissions WHERE organization_id=p_organization_id AND user_id=p_target_user_id;
    INSERT INTO public.administration_permissions(organization_id,user_id,permission,granted_by)
      SELECT p_organization_id,p_target_user_id,x,v_actor FROM unnest(v_next) x;
    INSERT INTO public.administration_permission_events(organization_id,target_user_id,actor_id,previous_permissions,next_permissions)
      VALUES(p_organization_id,p_target_user_id,v_actor,v_previous,v_next);
  END IF;
  RETURN jsonb_build_object('permissions',to_jsonb(v_next));
END;
$$;
REVOKE ALL ON FUNCTION public.replace_administration_permissions(uuid,uuid,uuid,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.replace_administration_permissions(uuid,uuid,uuid,text[]) TO service_role;

DROP POLICY administration_documents_admin_read ON public.administration_documents;
CREATE POLICY administration_documents_permission_read ON public.administration_documents FOR SELECT TO authenticated
USING (private.has_administration_permission(organization_id,'purchases.read')
  OR private.has_administration_permission(organization_id,'purchases.manage')
  OR private.has_administration_permission(organization_id,'retentions.read')
  OR private.has_administration_permission(organization_id,'books.read')
  OR private.has_administration_permission(organization_id,'reports.export')
  OR private.has_administration_permission(organization_id,'imports.validate'));
DROP POLICY administration_documents_admin_insert ON public.administration_documents;
CREATE POLICY administration_documents_permission_insert ON public.administration_documents FOR INSERT TO authenticated
WITH CHECK (created_by=auth.uid() AND status='draft' AND private.has_administration_permission(organization_id,'purchases.manage'));
DROP POLICY administration_documents_admin_update ON public.administration_documents;
CREATE POLICY administration_documents_permission_update ON public.administration_documents FOR UPDATE TO authenticated
USING (created_by=auth.uid() AND status='draft' AND private.has_administration_permission(organization_id,'purchases.manage'))
WITH CHECK (created_by=auth.uid() AND status='draft' AND private.has_administration_permission(organization_id,'purchases.manage'));
DROP POLICY administration_document_events_admin_read ON public.administration_document_events;
CREATE POLICY administration_document_events_permission_read ON public.administration_document_events FOR SELECT TO authenticated
USING (private.has_administration_permission(organization_id,'purchases.read')
  OR private.has_administration_permission(organization_id,'purchases.manage')
  OR private.has_administration_permission(organization_id,'retentions.read')
  OR private.has_administration_permission(organization_id,'books.read')
  OR private.has_administration_permission(organization_id,'reports.export')
  OR private.has_administration_permission(organization_id,'imports.validate'));

DROP POLICY fiscal_vendors_admin_read ON public.fiscal_vendors;
CREATE POLICY fiscal_vendors_permission_read ON public.fiscal_vendors FOR SELECT TO authenticated
USING (private.has_administration_permission(organization_id,'vendors.read')
  OR private.has_administration_permission(organization_id,'vendors.manage')
  OR private.has_administration_permission(organization_id,'purchases.read')
  OR private.has_administration_permission(organization_id,'purchases.manage')
  OR private.has_administration_permission(organization_id,'imports.validate')
  OR private.has_administration_permission(organization_id,'reports.export'));
DROP POLICY fiscal_vendors_owner_insert ON public.fiscal_vendors;
CREATE POLICY fiscal_vendors_permission_insert ON public.fiscal_vendors FOR INSERT TO authenticated
WITH CHECK (created_by=auth.uid() AND procurement_vendor_id IS NULL AND private.has_administration_permission(organization_id,'vendors.manage'));
DROP POLICY fiscal_vendors_owner_update ON public.fiscal_vendors;
CREATE POLICY fiscal_vendors_permission_update ON public.fiscal_vendors FOR UPDATE TO authenticated
USING (private.has_administration_permission(organization_id,'vendors.manage'))
WITH CHECK (private.has_administration_permission(organization_id,'vendors.manage'));
DROP POLICY fiscal_vendor_events_admin_read ON public.fiscal_vendor_events;
CREATE POLICY fiscal_vendor_events_permission_read ON public.fiscal_vendor_events FOR SELECT TO authenticated
USING (private.has_administration_permission(organization_id,'vendors.read')
  OR private.has_administration_permission(organization_id,'vendors.manage'));

DROP POLICY fiscal_settings_proposals_admin_read ON public.fiscal_settings_proposals;
CREATE POLICY fiscal_settings_proposals_permission_read ON public.fiscal_settings_proposals FOR SELECT TO authenticated
USING (private.has_administration_permission(organization_id,'fiscal_settings.read')
  OR private.has_administration_permission(organization_id,'fiscal_settings.manage')
  OR private.has_administration_permission(organization_id,'purchases.manage')
  OR private.has_administration_permission(organization_id,'imports.validate'));
DROP POLICY fiscal_settings_proposals_admin_insert ON public.fiscal_settings_proposals;
CREATE POLICY fiscal_settings_proposals_permission_insert ON public.fiscal_settings_proposals FOR INSERT TO authenticated
WITH CHECK (created_by=auth.uid() AND status='proposed' AND private.has_administration_permission(organization_id,'fiscal_settings.manage'));
DROP POLICY fiscal_settings_events_admin_read ON public.fiscal_settings_events;
CREATE POLICY fiscal_settings_events_permission_read ON public.fiscal_settings_events FOR SELECT TO authenticated
USING (private.has_administration_permission(organization_id,'fiscal_settings.read')
  OR private.has_administration_permission(organization_id,'fiscal_settings.manage'));
DROP POLICY fiscal_settings_activations_admin_read ON public.fiscal_settings_activations;
CREATE POLICY fiscal_settings_activations_permission_read ON public.fiscal_settings_activations FOR SELECT TO authenticated
USING (private.has_administration_permission(organization_id,'fiscal_settings.read')
  OR private.has_administration_permission(organization_id,'fiscal_settings.manage')
  OR private.has_administration_permission(organization_id,'purchases.manage')
  OR private.has_administration_permission(organization_id,'imports.validate'));

DROP POLICY administration_permissions_self_or_admin_read ON public.administration_permissions;
CREATE POLICY administration_permissions_self_or_admin_read ON public.administration_permissions FOR SELECT TO authenticated
USING ((user_id=auth.uid() AND EXISTS (
  SELECT 1 FROM public.memberships self WHERE self.organization_id=administration_permissions.organization_id
    AND self.user_id=auth.uid() AND self.active
)) OR private.is_active_administration_admin(organization_id));

CREATE POLICY memberships_admin_read ON public.memberships FOR SELECT TO authenticated
USING (private.is_active_administration_admin(organization_id));
CREATE POLICY profiles_admin_read ON public.user_profiles FOR SELECT TO authenticated
USING (private.can_administer_member_profile(user_id));
