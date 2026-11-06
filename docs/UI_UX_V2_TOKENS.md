# Tokens y componentes UPCO v2

## Marca y fuentes

Los valores oficiales son verde `#0B4B32`, verde oscuro `#041914` y gris `#EDEDED`. Satoshi local se usa en títulos; el texto mantiene Helvetica Neue si está instalada y la alternativa del sistema en otros equipos. La fuente comercial no se publica. Los valores restantes son **derivados para la interfaz**, no nuevos colores oficiales.

| Rol CSS | Valor | Uso | Contraste medido |
|---|---|---|---|
| `--upco-brand` | `#0B4B32` | Acción principal, foco, enlaces | 10.16:1 sobre blanco |
| `--upco-brand-dark` | `#041914` | Texto y navegación oscura | 15.54:1 sobre gris oficial |
| `--upco-neutral` | `#EDEDED` | Fondo neutro | Texto oscuro 15.54:1 |
| `--upco-surface` | `#FFFFFF` | Tarjetas y menús | Texto verde 10.16:1 |
| `--upco-surface-subtle` | `#F5F7F5` | Hover y superficies secundarias | Solo fondo |
| `--upco-text-muted` | `#40584F` | Texto secundario | 7.70:1 sobre blanco |
| `--upco-border` | `#718279` | Borde de controles significativos | 4.06:1 sobre blanco |
| `--upco-danger` | `#A1253D` | Error y eliminación | 7.38:1 sobre blanco |
| `--upco-warning` | `#8A4D00` | Advertencia | 6.68:1 sobre blanco |
| `--upco-info` | `#235274` | Información | 8.30:1 sobre blanco |

Los cocientes se calcularon con la fórmula de luminancia relativa de WCAG para sRGB. No sustituyen una prueba visual de estados y tamaños en navegador. `@theme inline` en `globals.css` expone los roles semánticos a Tailwind 4; `tokens.css` define sus valores. Los estilos antiguos siguen en `globals.css`/`brand.css` mientras se migran por pantalla.

## Componentes disponibles

- `Button` de shadcn/ui (`src/components/ui/button.tsx`): variantes principal, contorno, secundaria, discreta, destructiva y enlace; tamaños normal, pequeño e icono. El shell utiliza la variante discreta para abrir el menú móvil. Un botón solo con icono debe tener `aria-label`.
- `Sheet` de shadcn/ui (`src/components/ui/sheet.tsx`): menú lateral móvil con cierre por Escape y retorno de foco gestionados por Radix. El contenido tiene título accesible y botón «Cerrar menú».
- La navegación compartida conserva los nueve destinos, ambos logos, el estado contraído de escritorio y el cierre de sesión. `aria-current="page"` marca la sección activa.

Se integró shadcn/ui con su CLI para el proyecto existente, alias `@/*` y Tailwind 4. Se descartaron las modificaciones automáticas a Geist, modo oscuro y paleta gris de la CLI porque contradicen la identidad actual. Solo se añadieron `Button` y `Sheet`; no se generó un catálogo sin consumidores. Dependencias de cliente nuevas: `class-variance-authority`, `cn`, `lucide-react`, `radix-ui` y `tw-animate-css`; la CLI `shadcn` se mantiene solo como dependencia de desarrollo.

## Aplicación gradual

Mantener los campos HTML nativos y acciones de servidor cuando ya sean accesibles. Para una vista nueva, reutilizar los tokens y los componentes anteriores antes de añadir variantes. No cambiar nombres de `FormData`, valores, consultas, paginación ni límites de acceso por un ajuste visual.
