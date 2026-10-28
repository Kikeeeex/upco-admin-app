-- Sprint 1 core. Apply to an authorized Supabase development project only.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  code text NOT NULL CHECK (length(btrim(code)) BETWEEN 1 AND 20),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, code)
);

CREATE TABLE public.user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  entra_tenant_id uuid NOT NULL,
  entra_object_id uuid NOT NULL,
  display_name text NOT NULL DEFAULT '',
  timezone text NOT NULL DEFAULT 'America/Caracas',
  default_site_id uuid REFERENCES public.sites(id),
  UNIQUE (entra_tenant_id, entra_object_id)
);

CREATE TABLE public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  entra_tenant_id uuid NOT NULL,
  entra_object_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'member')),
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id),
  UNIQUE (organization_id, entra_tenant_id, entra_object_id)
);
CREATE INDEX memberships_user_active_idx ON public.memberships(user_id, active, organization_id);

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  code text NOT NULL CHECK (length(btrim(code)) BETWEEN 1 AND 30),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  description text,
  site_id uuid,
  target_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, code),
  FOREIGN KEY (organization_id, site_id) REFERENCES public.sites(organization_id, id)
);

CREATE TABLE public.work_item_counters (
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  type text NOT NULL CHECK (type IN ('general', 'administration', 'procurement', 'it')),
  last_value bigint NOT NULL CHECK (last_value > 0),
  PRIMARY KEY (organization_id, type)
);

CREATE TABLE public.work_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  code text NOT NULL,
  type text NOT NULL CHECK (type IN ('general', 'administration', 'procurement', 'it')),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'waiting', 'completed', 'cancelled')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  project_id uuid,
  site_id uuid,
  due_date date,
  creator_id uuid NOT NULL REFERENCES auth.users(id),
  closed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code),
  FOREIGN KEY (organization_id, project_id) REFERENCES public.projects(organization_id, id),
  FOREIGN KEY (organization_id, site_id) REFERENCES public.sites(organization_id, id)
);
CREATE INDEX work_items_org_status_due_idx ON public.work_items(organization_id, status, due_date) WHERE archived_at IS NULL;
CREATE INDEX work_items_org_creator_idx ON public.work_items(organization_id, creator_id, created_at DESC);

CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  work_item_id uuid NOT NULL REFERENCES public.work_items(id),
  action text NOT NULL CHECK (action IN ('created', 'updated')),
  before_values jsonb,
  after_values jsonb NOT NULL,
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_log_work_item_time_idx ON public.activity_log(work_item_id, occurred_at DESC);

CREATE FUNCTION public.prepare_work_item() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  next_number bigint;
  prefix text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.work_item_counters(organization_id, type, last_value)
    VALUES (NEW.organization_id, NEW.type, 1)
    ON CONFLICT (organization_id, type)
    DO UPDATE SET last_value = public.work_item_counters.last_value + 1
    RETURNING last_value INTO next_number;

    prefix := CASE NEW.type
      WHEN 'administration' THEN 'ADM'
      WHEN 'procurement' THEN 'PRC'
      WHEN 'it' THEN 'IT'
      ELSE 'GEN' END;
    NEW.code := prefix || '-' || lpad(next_number::text, greatest(6, length(next_number::text)), '0');
  ELSE
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
      OR NEW.creator_id IS DISTINCT FROM OLD.creator_id
      OR NEW.type IS DISTINCT FROM OLD.type
      OR NEW.code IS DISTINCT FROM OLD.code THEN
      RAISE EXCEPTION 'immutable work item fields cannot be changed';
    END IF;
    NEW.updated_at := now();
  END IF;

  IF NEW.status = 'completed' AND NEW.closed_at IS NULL THEN NEW.closed_at := now(); END IF;
  IF NEW.status <> 'completed' THEN NEW.closed_at := NULL; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER work_items_prepare BEFORE INSERT OR UPDATE ON public.work_items
FOR EACH ROW EXECUTE FUNCTION public.prepare_work_item();

CREATE FUNCTION public.audit_work_item() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_log(organization_id, work_item_id, action, after_values, actor_id)
    VALUES (NEW.organization_id, NEW.id, 'created',
      jsonb_build_object('status', NEW.status, 'priority', NEW.priority, 'due_date', NEW.due_date), auth.uid());
  ELSIF NEW.status IS DISTINCT FROM OLD.status
    OR NEW.priority IS DISTINCT FROM OLD.priority
    OR NEW.due_date IS DISTINCT FROM OLD.due_date
    OR NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
    INSERT INTO public.activity_log(organization_id, work_item_id, action, before_values, after_values, actor_id)
    VALUES (NEW.organization_id, NEW.id, 'updated',
      jsonb_build_object('status', OLD.status, 'priority', OLD.priority, 'due_date', OLD.due_date, 'archived_at', OLD.archived_at),
      jsonb_build_object('status', NEW.status, 'priority', NEW.priority, 'due_date', NEW.due_date, 'archived_at', NEW.archived_at), auth.uid());
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER work_items_audit AFTER INSERT OR UPDATE ON public.work_items
FOR EACH ROW EXECUTE FUNCTION public.audit_work_item();

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_item_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY memberships_own_active_read ON public.memberships FOR SELECT TO authenticated
USING (user_id = auth.uid() AND active);

CREATE POLICY organizations_member_read ON public.organizations FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.memberships m WHERE m.organization_id = organizations.id AND m.user_id = auth.uid() AND m.active));

CREATE POLICY sites_member_read ON public.sites FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.memberships m WHERE m.organization_id = sites.organization_id AND m.user_id = auth.uid() AND m.active));

CREATE POLICY profiles_member_read ON public.user_profiles FOR SELECT TO authenticated
USING (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = auth.uid() AND m.active));

CREATE POLICY projects_member_read ON public.projects FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.memberships m WHERE m.organization_id = projects.organization_id AND m.user_id = auth.uid() AND m.active));

CREATE POLICY work_items_member_read ON public.work_items FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.memberships m WHERE m.organization_id = work_items.organization_id AND m.user_id = auth.uid() AND m.active));

CREATE POLICY work_items_member_insert ON public.work_items FOR INSERT TO authenticated
WITH CHECK (creator_id = auth.uid() AND EXISTS (SELECT 1 FROM public.memberships m WHERE m.organization_id = work_items.organization_id AND m.user_id = auth.uid() AND m.active));

CREATE POLICY work_items_member_update ON public.work_items FOR UPDATE TO authenticated
USING (creator_id = auth.uid() AND EXISTS (SELECT 1 FROM public.memberships m WHERE m.organization_id = work_items.organization_id AND m.user_id = auth.uid() AND m.active))
WITH CHECK (creator_id = auth.uid() AND EXISTS (SELECT 1 FROM public.memberships m WHERE m.organization_id = work_items.organization_id AND m.user_id = auth.uid() AND m.active));

CREATE POLICY activity_log_member_read ON public.activity_log FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.memberships m WHERE m.organization_id = activity_log.organization_id AND m.user_id = auth.uid() AND m.active));

GRANT SELECT ON public.organizations, public.sites, public.user_profiles, public.memberships, public.projects, public.activity_log TO authenticated;
GRANT SELECT ON public.work_items TO authenticated;
GRANT INSERT (organization_id, creator_id, type, title, description, status, priority, project_id, site_id, due_date)
  ON public.work_items TO authenticated;
GRANT UPDATE (title, description, status, priority, project_id, site_id, due_date, archived_at)
  ON public.work_items TO authenticated;
REVOKE ALL ON public.work_item_counters FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.prepare_work_item() FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.audit_work_item() FROM PUBLIC, authenticated;
