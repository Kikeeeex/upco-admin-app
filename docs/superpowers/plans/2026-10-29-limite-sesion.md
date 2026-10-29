# Límite de sesión — plan de implementación

**Objetivo:** Cerrar la sesión de UPCO Admin tras 30 minutos de inactividad o 8 horas desde el inicio de sesión.

**Causa:** Supabase SSR usa cookies persistentes de hasta 400 días y renueva el token; la aplicación no aplica un plazo propio.

**Diseño:** Dos cookies HttpOnly fijan el inicio de esta sesión (8 horas) y la última actividad (30 minutos). El callback OAuth las crea; solo las peticiones privadas POST renuevan la actividad. El proxy y el contexto de autorización comprueban ambos plazos. Un componente cliente cierra la vista abierta tras 30 minutos sin interacción y sincroniza actividad y nuevos ingresos entre pestañas. Las acciones del servidor siguen protegidas por el proxy y el contexto de autorización.

**Archivos:** `src/features/auth/session-policy.ts` contiene reglas puras; `src/proxy.ts` aplica el límite; callback y signout crean/limpian el marcador; `src/app/auth/activity/route.ts` permite mantener activa una pestaña con interacción; `src/components/session-guard.tsx` gestiona el temporizador visible; layout incorpora el guardia; pruebas en `tests/auth/`.

**Criterios:**

- [x] Caducidad exacta en los límites de 30 minutos y 8 horas.
- [x] Una sesión anterior al despliegue sin marcador vuelve a iniciar sesión.
- [x] Un acceso privado caducado limpia la sesión y redirige a `/login?expired=1`.
- [x] Peticiones de precarga no extienden la inactividad.
- [x] El callback OAuth inicia el plazo; cierre manual y automático limpian los marcadores.
- [x] Otro ingreso en distinto dispositivo no extiende el plazo máximo de esta sesión; otro ingreso en el mismo navegador se sincroniza entre pestañas.
- [x] Pruebas, TypeScript, ESLint y build pasan (76 pruebas).
- [ ] Staging exige login al vencer; prueba autenticada de los plazos reales pendiente.

**Límite:** El cierre afecta la sesión de la app; Microsoft puede conservar su propia sesión SSO y facilitar un nuevo ingreso.
