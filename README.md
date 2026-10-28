# UPCO Admin

Aplicación web en español para organizar trabajo de Administración, Procura, TI, Proyectos y Seguimientos. El alcance funcional está en [la especificación](docs/UPCO_Admin_Especificacion_MVP_v1_0.md); el estado de entrega está en [PROGRESO](docs/PROGRESO.md).

## Desarrollo local

Requiere Node 24 y npm. En el entorno cloud, usar una caché npm bajo `/workspace` porque el directorio HOME no es escribible.

```bash
cd /workspace/upco-admin-app
npm_config_cache=/workspace/.npm-cache npm ci
cp .env.example .env.local # completar solo con valores del proyecto de desarrollo autorizado
npm run dev
```

Sin variables configuradas, la app presenta la pantalla de acceso pero niega sesiones y datos. El proyecto no incluye credenciales, tenant ni datos corporativos. No activar proveedores OAuth o cargar información real sin autorización de UPCO.

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

La autenticación real requiere proyecto Supabase autorizado, proveedor Azure configurado, registro de aplicación en Entra, callback de Entra `https://<supabase-project>.supabase.co/auth/v1/callback`, URL de redirección de la aplicación `<origen>/auth/callback`, tenant aprobado y membresía activa provisionada por un administrador. `SUPABASE_PUBLISHABLE_KEY` debe ser solo la clave publicable/anon; nunca una clave `service_role`. Ver [DECISIONES](docs/DECISIONES.md).

La suite de permisos SQL usa Docker y PostgreSQL 17 descartable: `bash scripts/test-sql.sh`. Las migraciones `supabase/migrations/20261028000000_core.sql` y `20261028000001_restrict_table_privileges.sql` se aplicaron al proyecto Supabase de desarrollo y se registraron en `supabase_migrations.schema_migrations`. La primera cuenta debe autenticarse por Entra y ser habilitada explícitamente en `memberships` antes de probar persistencia desde la interfaz. No hay alta automática de usuarios.
