-- Supabase default table privileges can include anon/authenticated ALL.
-- Explicitly revoke them before granting the minimum needed by this app.
REVOKE ALL ON public.organizations, public.sites, public.user_profiles,
  public.memberships, public.projects, public.work_item_counters,
  public.work_items, public.activity_log FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.organizations, public.sites, public.user_profiles,
  public.memberships, public.projects, public.activity_log TO authenticated;

GRANT SELECT ON public.work_items TO authenticated;
GRANT INSERT (organization_id, creator_id, type, title, description, status,
  priority, project_id, site_id, due_date) ON public.work_items TO authenticated;
GRANT UPDATE (title, description, status, priority, project_id, site_id,
  due_date, archived_at) ON public.work_items TO authenticated;

REVOKE ALL ON FUNCTION public.prepare_work_item() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_work_item() FROM PUBLIC, anon, authenticated;
