# Sistema de diseño visual (`client/`)

Guía viva de diseño y patrones UI para la aplicación Expo / React Native. Todos los tokens proceden de [`src/ui/theme.ts`](./src/ui/theme.ts).

## 1. Principios de superficie y limpieza

- **Lienzo abierto sin tarjetas innecesarias**: las secciones principales (gráficas, listas de clientes, histórico de tarifas, métricas de reportes, FAQ) se renderizan directamente sobre `colors.background` (`#FFFFFF` en claro, `#000000` en oscuro) separadas por `<Divider />` de ancho completo (`#E0E7EF` / `#272C30`), evitando envolver todo en `<Card>` con bordes y sombras.
- **Superficie mate sutil para bloques destacados**: cuando se necesita destacar una pieza sin marco (catálogo, asistente en portada, resumen de márgenes en reportes), se usa `<Card />` con fondo mate sin borde (`#F4F2F0` en modo claro, `#141518` en modo oscuro) y esquinas redondeadas generosas (`radius.lg` / `radius.full`).
- **Botones redondeados**: acciones y botones secundarios/primarios en formato píldora (`radius.full` / `radius.pill`), nunca rectangulares duros.

## 2. Paleta y tipografía

- **Acento principal**: `primary = #00B4D8` (`primarySoft = #E0F7FA` claro / `#0A2933` oscuro).
- **Estados semánticos**: `success` (`#16A34A` / `#22C55E`), `danger` (`#DC2626` / `#EF4444`), `warning` (`#D97706` / `#F59E0B`), `info` (`#2563EB` / `#3B82F6`).
- **Serie comparativa secundaria en gráficos duales**: acento cálido `chartSecondary` (`#F43F5E` / `#FB7185`) degradado a transparente para contrastar visualmente con `primary`.
- **Tipografía**: familia `Inter` (`Inter_400Regular`, `Inter_500Medium`, `Inter_600SemiBold`, `Inter_700Bold`), títulos en Capital Case natural (sin forzar mayúsculas sostenidas) y cifras económicas con `tabular` (`fontVariant: ['tabular-nums']`).

## 3. Estándar de gráficos (`PortfolioBarChart` y `AnalyticsCharts`)

1. **Sin contenedor card**: el gráfico vive abierto sobre el fondo de pantalla con relleno horizontal `gutter`. En la portada (`(tabs)/index.tsx`), el gráfico de balance solo aparece en la pestaña **Todos**.
2. **Guías difuminadas en los extremos**:
   - Raíles verticales por columna usando `LinearGradient` (`rgba(..., 0)` → trazo sutil → `rgba(..., 0)`) para desaparecer suavemente arriba y abajo.
   - Líneas horizontales (media o rejilla) también con `LinearGradient` horizontal que desaparece en ambos bordes laterales.
3. **Barras en cápsula con degradado descendente**:
   - Bordes totalmente redondeados (`borderRadius: radius.full`), degradando el color de mayor intensidad arriba a tono suave/transparente en la base.
   - La cápsula activa muestra un punto interior superior de foco (`peakDot`).
4. **Tooltips flotantes íntegros**:
   - Posicionados en el contenedor ancho completo del área de trazado (`plotArea`), nunca restringidos al ancho estrecho de una sola columna, para mostrar siempre el importe completo sin recortes ni saltos de línea.
5. **Comparador dinámico**:
   - El indicador porcentual y su etiqueta comparan dinámicamente el periodo/mes seleccionado con el inmediatamente anterior (ej. mayo vs abril, junio vs mayo), ajustando color e icono según sea variación positiva, negativa o neutra.
