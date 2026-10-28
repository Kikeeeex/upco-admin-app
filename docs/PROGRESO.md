# Progreso verificable

Estado del corte inicial del 28/10/2026. `hecho` requiere comprobación ejecutada; `parcial` indica código presente con verificación o dependencia pendiente.

| Historia | Traza | Estado | Dependencia o criterio pendiente |
|---|---|---|---|
| BL-01 | RNF-14 | parcial | Repositorio, CI y comandos locales listos; CI remoto y staging no ejecutados |
| BL-02 | RNF-15 | bloqueado | Aprobación corporativa de nube y datos |
| BL-03 | RF-001 | bloqueado | Registro Entra, Supabase y prueba OAuth real |
| BL-04 | RF-002, RF-003 | parcial | Guardas y casos negativos locales; validar claims y sesión reales |
| BL-05 | RNF-02, RNF-13 | hecho | Migración aplicada en PostgreSQL 17 descartable |
| BL-06 | RNF-03 | parcial | RLS negativa local comprobada; pendiente Supabase real |
| BL-07 | RNF-08, RNF-16 | parcial | Navegación presente y prueba de render; falta revisión manual móvil |
| BL-08 | RF-006, RF-007 | parcial | Formulario, lista, edición, validación y SQL; falta flujo real con Supabase |
| BL-09 | RF-008, RF-012 | parcial | Cierre/reapertura y auditoría SQL; archivo sin UI |
| BL-10 | RF-011, RNF-05 | parcial | Bitácora de creación/cambios SQL; faltan notas |

**Siguiente historia tras este corte:** BL-11, vista Mi trabajo con búsqueda y filtros, cuando BL-08 esté operativo con persistencia autorizada.

Comprobación local ejecutada: `npm ci`, Vitest (16 pruebas), typecheck, ESLint, build Next.js, `scripts/test-sql.sh` y petición HTTP al servidor de producción local (login 200; ruta privada sin sesión 307 hacia login; callback sin código 307 hacia login). OAuth real, lectura/escritura desde el navegador con Supabase, pruebas E2E y CI remoto no ejecutados.
