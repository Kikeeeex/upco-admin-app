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

## URL de pruebas

El usuario creó `https://upco-admin-app.vercel.app/` para las pruebas. En Supabase Auth → URL Configuration, configurar **Site URL** como `https://upco-admin-app.vercel.app` y añadir `https://upco-admin-app.vercel.app/auth/callback` a **Redirect URLs**. El callback configurado en Entra sigue siendo el de Supabase (`https://<supabase-project>.supabase.co/auth/v1/callback`). En Vercel, el despliegue necesita `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` y `ENTRA_TENANT_ID` del proyecto de desarrollo; el acceso seguirá cerrado sin ellas. La URL de pruebas respondió en `/login` con 200 y el botón Microsoft habilitado; una ruta privada sin sesión redirigió al login, y Supabase inició OAuth hacia el tenant esperado. El inicio de sesión real aún no se ha probado.

La suite de permisos SQL usa Docker y PostgreSQL 17 descartable: `bash scripts/test-sql.sh`. Las migraciones `supabase/migrations/20261028000000_core.sql`, `20261028000001_restrict_table_privileges.sql` y `20261028000002_azure_subject.sql` se aplicaron al proyecto Supabase de desarrollo y se registraron en `supabase_migrations.schema_migrations`. La cuenta administradora inicial de pruebas fue habilitada explícitamente en `memberships`; no hay alta automática de usuarios. La autorización usa el tenant `tid` y el sujeto estable `sub` de la identidad Azure de Supabase; el `oid` de Entra no aparece en esa identidad y se conserva solo como dato opcional de auditoría. El usuario confirmó la entrada al panel; falta comprobar la persistencia desde el navegador.
