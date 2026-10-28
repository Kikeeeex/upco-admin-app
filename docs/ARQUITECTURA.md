# Arquitectura inicial

Monolito modular Next.js App Router. `src/app` contiene rutas y UI; `src/features/auth` valida sesión, tenant y membresía; `src/features/work-items` contiene reglas y acceso a registros. Las migraciones de `supabase/migrations` definen PostgreSQL, integridad y RLS. Las operaciones de datos deben ejecutarse con la identidad del usuario mediante cliente Supabase de servidor; una clave privilegiada no forma parte de la aplicación.

El acceso se cierra por defecto. La autenticación Entra mediante Supabase verifica identidad; la aplicación debe comprobar tenant y pertenencia activa antes de servir rutas privadas. RLS repite el control sobre cada fila. Una sesión autenticada por sí sola no concede acceso.

La organización inicial no se crea automáticamente en login. Un administrador de Supabase debe provisionar organización, usuario y membresía tras verificar los identificadores estables de Entra. El esquema incluye `organization_id` aunque el piloto tenga un usuario.

Los códigos legibles se asignan en transacción PostgreSQL mediante un contador por organización y área. UUID sigue siendo la clave primaria. La bitácora registra cambios críticos con actor y hora UTC. El archivo lógico usa `archived_at`.
