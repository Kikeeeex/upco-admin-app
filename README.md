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

El usuario creó `https://upco-admin-app.vercel.app/` para las pruebas. En Supabase Auth → URL Configuration, configurar **Site URL** como `https://upco-admin-app.vercel.app` y añadir `https://upco-admin-app.vercel.app/auth/callback` a **Redirect URLs**. El callback configurado en Entra sigue siendo el de Supabase (`https://<supabase-project>.supabase.co/auth/v1/callback`). En Vercel, el despliegue necesita `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` y `ENTRA_TENANT_ID` del proyecto de desarrollo; el acceso seguirá cerrado sin ellas. El usuario confirmó el inicio de sesión corporativo y el acceso al panel.

La aplicación cierra la sesión tras **30 minutos sin interacción** o **8 horas desde el ingreso**, lo que suceda primero. Las rutas y acciones privadas verifican ambos plazos; la vista abierta comprueba la actividad y muestra una explicación al cerrar. Un nuevo despliegue de esta política requiere volver a ingresar para emitir los marcadores de sesión. La sesión propia de Microsoft puede seguir abierta y facilitar el siguiente ingreso.

La suite de permisos SQL usa Docker y PostgreSQL 17 descartable: `bash scripts/test-sql.sh`. Las migraciones de `supabase/migrations`, incluida `20261029000000_admin_details.sql`, se aplicaron al proyecto Supabase de desarrollo y se registraron en `supabase_migrations.schema_migrations`. La cuenta administradora inicial de pruebas fue habilitada explícitamente en `memberships`; no hay alta automática de usuarios. La autorización usa el tenant `tid` y el sujeto estable `sub` de la identidad Azure de Supabase; el `oid` de Entra no aparece en esa identidad y se conserva solo como dato opcional de auditoría. El usuario confirmó desde el navegador la entrada al panel, la creación y edición de una actividad sintética, nota e historial tras archivo/restauración, cierre/reapertura y la búsqueda combinada con prioridad. La suite SQL local/remota cubre también el filtro de sede. La lista activa, el archivo y el historial de cada ficha tienen paginación; las fechas con hora usan la zona configurada del perfil.

La identidad visual se documenta en [docs/IDENTIDAD_VISUAL_UPCO.md](docs/IDENTIDAD_VISUAL_UPCO.md): logos oficiales, paleta y tipografía del manual entregado por UPCO. Satoshi se sirve desde la app; Helvetica Neue usa la instalación del equipo con alternativas del sistema hasta confirmar la licencia para distribuir sus archivos en este repositorio público.
