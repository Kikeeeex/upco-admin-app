REVOKE ALL ON FUNCTION public.replace_administration_permissions(uuid,uuid,uuid,text[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_administration_permissions(uuid,uuid,uuid,text[])
  TO service_role;
