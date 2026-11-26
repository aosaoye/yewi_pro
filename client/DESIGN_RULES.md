# Reglas de Diseño e Interfaz (`DESIGN_RULES.md`)

Este documento contiene las restricciones y estándares visuales obligatorios de la aplicación para mantener total coherencia con el modelo de diseño de referencia (`refer/DESIGN_RULES.md`) y las decisiones del proyecto Yewi:

---

## 1. Botones de Píldora (`PillButton` / `Button`)
- **CERO MARGIN EXTERNO**: Los botones con forma de píldora (`borderRadius: 9999` / `radius.pill`) **NO** deben tener margen exterior (`margin: 0`, sin `marginHorizontal`, `marginVertical`, etc.) a menos que sea el espaciado dentro de un contenedor flex (`gap`).
- Deben comportarse e integrarse limpios, alineados al borde del contenedor o con el `flex` correspondiente.
- Alturas estándar:
  - Pequeño / Acción de fila: `minHeight: 32`, `paddingHorizontal: 14-16`, `borderRadius: 9999`.
  - Mediano / Llamado a la acción: `minHeight: 36`, `paddingHorizontal: 16-24`, `borderRadius: 9999`.
  - Grande / Acción principal: `height: 46-50`, `paddingHorizontal: 22-28`, `borderRadius: 9999`.

---

## 2. Chips y Categorías Horizontales (Como en Home)
- La fila horizontal de chips/categorías debe ocupar el **100% del ancho de la pantalla** en su contenedor propio.
- **NO colocar la fila horizontal dentro de un contenedor con `paddingHorizontal` externo** que corte el primer o último pill (usar `PillCarousel` o `ChipRow`, con `fullBleed` si está dentro de un contenedor con padding lateral).
- El espaciado de inicio se da mediante `contentContainerStyle: { paddingHorizontal: space.lg | gutter, gap: space.sm }`, garantizando que el primer chip se vea completo y redondo desde el inicio del scroll.

---

## 3. Pestañas de Cabecera (`TabStrip`)
- Las pestañas deben caber **en una sola línea sin partirse** (`numberOfLines={1}`).
- **NO dejar las pestañas agrupadas con espacio muerto a un lado** ni usar `flex: 1` forzado cuando rompa textos largos; usar `<TabStrip>` (`src/ui/Tabs.tsx`) al 100% del ancho.
- La línea indicadora activa debe estar centrada bajo el texto de la pestaña seleccionada.

---

## 4. Alineación de Cabeceras con Back Button
- En cualquier pantalla con botón de regreso (`←`), el título principal de la pantalla debe estar **en la misma fila horizontal, alineado con el botón de regreso** (`flexDirection: 'row'`, `alignItems: 'center'`), usando `<NavHeader>` de `@/ui`.
- **NUNCA colocar el título en una línea debajo del botón de regreso**.

---

## 5. Tarjetas y Secciones Informativas
- **NO crear tarjetas con fondo ni bordes artificiales** para bloques informativos, listas de ajustes, FAQ o listados planos (usar `ListRow` + `Divider` directamente sobre el lienzo `colors.background`).
- Reservar `<Card>` para tarjetas de resumen real (billetera, servicio Gig, profesional, solicitud, pedido, paquete o promoción).

---

## 6. Flujos de Contactos, Solicitudes y Onboarding
- Mantener pantallas limpias sin cajas intermedias innecesarias en vacíos (`EmptyState`) o errores (`ErrorState`) de `@/ui`.

---

## 7. Switches Personalizados (`CustomSwitch` Obligatorio)
- **PROHIBIDO TERMINANTEMENTE EL USO DE `<Switch />` NATIVO DE REACT NATIVE**.
- Todo switch en la aplicación DEBE utilizar `<CustomSwitch />` (`src/ui/Switch.tsx` exportado en `@/ui`).
- Dimensiones estándar: `width: 52`, `height: 32`, `borderRadius: 16`, `borderWidth: 2`, `thumb: 26`.
- **Estado ON estándar obligatorio en TODO el proyecto**: Pista `colors.primary` / `colors.accent` (`#00B4D8`), thumb blanco `#FFFFFF`.
- **Estado ON específico para silenciar/alerta destructiva**: Pista roja (`#DC2626` / `#EF4444` según tema), thumb blanco `#FFFFFF`.
- **Estado OFF**: Pista neutra/oscura adaptada al tema (`colors.switchTrackOff`), thumb contrastado.
- Animación fluida con `Animated.spring`.
- Todas las cabeceras deben usar `useSafeAreaInsets` / `<Screen edges={...}>` para no montarse jamás sobre la barra de estado del sistema.

---

## 8. Distribución al 100% del Ancho de Pantalla en Pestañas (`TabStrip` / `SegmentedPills`)
- Las barras de pestañas y selectores segmentados **DEBEN OCUPAR SIEMPRE EL 100% DEL ANCHO DE LA PANTALLA**.
- **PROHIBIDO** dejar las pestañas agrupadas a la izquierda dejando espacio vacío a la derecha.

---

## 9. Hojas Inferiores y Prohibición de `<Modal>` Anidados en Android
- **PROHIBIDO el uso de `<Modal>` dentro de otro `<Modal>`** en Android (y evitar `<Modal>` nativos cuando una capa absoluta sea más estable).
- Los sheets inferiores de selección (p. ej. cámara / galería con `expo-image-picker`) deben renderizarse mediante superposiciones absolutas (`zIndex: 1000`, `elevation: 10`) envolviendo `<Sheet>` de `@/ui`.

---

## 10. Cabecera del Perfil, Avatares y Nombres
- Separación holgada entre portada superior y avatar solapado (`marginTop: -38` sobre portada con `height >= 116 + top`) para que los botones superiores nunca toquen ni pisen el avatar.
- Sin duplicar nombres ni sufijos artificiales.

---

## 11. Carruseles Horizontales y Acciones Fuera de Tarjetas
- Los enlaces/acciones de sección ("Ver todos", "Directorio", etc.) nunca van pegados dentro de una tarjeta del carrusel, sino en la cabecera de `Section` o debajo del carrusel.

---

## 12. Menús de Opciones / Ajustes y Prohibición de `border-bottom` en `last-child`
- **Heredar siempre `<ListGroup />` (`src/ui/Rows.tsx`)**: Toda lista o sección de opciones (Ajustes, Apariencia, Legal, Ayuda, Perfil, Info profesional, Sheets) **DEBE** envolver sus elementos con `<ListGroup title="...">` en lugar de insertar `<Divider />` manuales.
- **PROHIBIDO poner `border-bottom` o `<Divider />` en el último elemento (`last-child`)** de una lista o sección. `<ListGroup />` inserta divisores únicamente *entre* hijos consecutivos (`idx > 0`).

---

## 13. Sistema de Temas Claro/Oscuro Reactivo
- **Regla de Oro de Reactividad**: Todo componente o pantalla DEBE consumir el hook `useTheme()` (`const { isDark, colors } = useTheme();`).
- **PROHIBIDO** importar `colors` estático en llamadas a `StyleSheet.create` para elementos dependientes del tema.
- **Modo Oscuro**: fondo abierto `#000000`, superficies mate sin borde `#141518`, divisores `#272C30`, primario `#00B4D8` (`primarySoft: #0A2933`), texto `#FAFAFA` / `#FFFFFF`.
- **Modo Claro**: fondo abierto `#FFFFFF`, superficies mate sin borde `#F4F2F0`, divisores `#E0E7EF`, primario `#00B4D8` (`primarySoft: #E0F7FA`), texto `#0F172A`.

---

## 14. Composición de Contenidos y Medios
- Portadas y vistas previas usan `<Cover>` de `@/ui` sin duplicar descripciones ni resúmenes idénticos.

---

## 15–16. Selectores, Fechas y Teclado Activo
- Todo formulario o compositor con teclado debe usar `<FormScroll>` o `<KeyboardAvoidingView>` con `useSafeAreaInsets().bottom` en barras inferiores para que la barra de acciones y botones permanezcan accesibles por encima del teclado.

---

## 17. Sistema Único de Píldoras (`Pill`), Carruseles Full-Width y Editores
1. **Regla de Lectura Previa**: Antes de escribir o modificar código de interfaz, revisar `DESIGN_RULES.md` y verificar el cumplimiento de cada regla.
2. **Píldoras 100% Redondeadas y Herencia Única (`src/ui/Pill.tsx`)**:
   - Toda píldora, botón píldora (`PillButton`), pestaña píldora (`PillTab`), chip (`Chip`) y badge (`PillBadge` / `Badge`) DEBE tener `borderRadius: 9999` (`radius.full` / `radius.pill`) y `margin: 0`. Queda **PROHIBIDO** usar radios parciales en badges/pills/botones de acción.
   - **Un solo componente base**: **PROHIBIDO** crear estilos o componentes de píldora locales en pantallas o componentes de features. Todo `PillButton`, `PillTab`, `PillBadge`, `Chip` y `Badge` DEBE heredar de `Pill` (`src/ui/Pill.tsx`).
3. **Carrusel Horizontal Full-Width (`PillCarousel` / `ChipRow`)**: `width: '100%'` sin márgenes/paddings padre que recorten el primer elemento.

---

## 18. Herencia Única de Primitivos en `@/ui` (SIN COMPONENTES DUPLICADOS)
- **UN SOLO DISEÑO POR PRIMITIVO EN TODA LA APP — PROHIBIDO CREAR VARIANTES O ESTILOS DUPLICADOS**:
  - **Entradas de texto (`<Field>` en `src/ui/Field.tsx`)**: **PROHIBIDO** usar `<TextInput>` directamente en `src/app/` o `src/components/`.
    - **Inputs de una línea**: cápsula redondeada al 100% (`borderRadius: radius.full`), icono izquierdo (`icon`), `borderWidth: 1` (`1.5` en foco o error), `minHeight: 50`, `backgroundColor: colors.inputBackground`.
    - **Validación inline estilo Google (SIN alerts/banners tipo Bootstrap)**: Al pulsar enviar/continuar, validar **todos** los campos del formulario/paso a la vez; cada `<Field />` incompleto o inválido cambia su borde a rojo (`colors.danger`) y muestra debajo un hint rojo con icono `alert-circle` indicando la razón exacta. Prohibido usar `<Banner tone="danger">` para errores de validación de campos.
    - **Textareas multilínea (`<Field multiline />`)**: **SIN BORDES ni fondo de caja** (`borderWidth: 0`, `backgroundColor: 'transparent'`, `paddingHorizontal: 0`, tipografía abierta `17px`), integrados directamente sobre el lienzo `colors.background` (biografía, opinión pública, descripciones).
  - **Perfil único heredado (`<ProfileShell>` en `src/components/ProfileShell.tsx`)**: Tanto el perfil propio (`(tabs)/profile/index.tsx`) como el perfil público de un profesional (`professional-profile.tsx`) **DEBEN** heredar el mismo componente `<ProfileShell />`, cambiando únicamente las acciones/pestañas según si es propio o ajeno.
  - **Tarjetas de servicios (`<GigCard>` y `<GigGrid>` en `src/components/YewiCards.tsx`)**:
    - `variant="default"` (listado completo): foto protagonista redondeada (`borderRadius: 28`), píldora flotante superior izquierda `★ rating`, píldora flotante inferior izquierda `Desde XXX €` (`tabular`) y botón circular flotante `↗` inferior derecha, seguido de 1 línea de título y 1 línea de profesional.
    - `variant="compact"` + `<GigGrid />` (miniaturas en cuadrícula de 2 columnas): formato vertical (`borderRadius: 22`) con los mismos flotantes más botón circular de guardado (`bookmark`) arriba-derecha.
  - **Comentarios / Reseñas (`<ReviewCard>` en `src/components/YewiCards.tsx` y compositor `create-review.tsx`)**:
    - Al publicar comentario/reseña: cabecera limpia `✕` izquierda + píldora `Publicar` derecha, avatar del usuario junto al `<Field multiline hideIcon />` abierto sin bordes y selector de estrellas en la base.
    - En cada comentario publicado (`<ReviewCard />`): barra de acciones con **ÚNICAMENTE** 3 controles: **Responder**, **Like** y **Audiencia** (ignorar retweet, guardar o compartir).
  - **Listas y secciones (`<ListGroup>`, `<ListRow>`, `<Divider>` en `src/ui/Rows.tsx`)**: Heredar siempre `<ListGroup />` para que los divisores aparezcan únicamente entre elementos consecutivos y **nunca en el último elemento (`last-child`)**.
  - **Iconografía obligatoria (`lucide-react-native` / `<AppIcon>` en `src/ui/Icon.tsx`)**: **PROHIBIDO TERMINANTEMENTE** importar `@expo/vector-icons`, `Feather`, `Ionicons`, `MaterialIcons` o cualquier otra librería de iconos. Todo icono del proyecto DEBE usar `lucide-react-native` a través de `<AppIcon />` (`@/ui`).
  - **Datos personales inmutables**: En la actualización de perfil (`(tabs)/profile/account.tsx` y `PATCH /users/profile`), el usuario **NO puede modificar su nombre (`firstName`) ni apellidos (`lastName`)**; deben mostrarse bloqueados (`editable={false}`) y ser ignorados en actualizaciones en backend.
  - **Copy conciso e intuitivo y sin Estados 24h**: Mantener textos mínimos y directos sin subtítulos redundantes ni jerga técnica innecesaria. **NO incluir la función de Estados 24h / Stories** en la interfaz del cliente.
  - **Cabeceras en `<ScrollView>`**: Los headers principales de catálogo/pestañas (`HomeHeader`, `ScreenHeader`, `TabStrip` en tabs) deben ir **dentro del `<ScrollView>`** para acompañar el scroll y no quedar congelados estáticamente encima del contenido.
  - **Botones (`<Button>`, `<IconButton>`, `<PillButton>`)**: Todos los botones de acción y botones circulares con icono deben heredar de `Button`, `IconButton` (`src/ui/Button.tsx`) o `PillButton` (`src/ui/Pill.tsx`) en formato píldora (`radius.full`), nunca rectangulares duros. Prohibido construir botones circulares o píldoras ad-hoc con `<Pressable>`.
  - **Tarjetas mate sin marco (`<Card>` en `src/ui/Layout.tsx`)**: Toda pieza destacada (`GigCard`, `ProfessionalCard`, `LeadOpportunityCard`, `OrderRowCard`, `PromotionCard` y bloques destacados) **DEBE** heredar de `<Card>` (`src/ui/Layout.tsx`) sobre superficie mate sin bordes ni sombras (`#F4F2F0` claro / `#141518` oscuro).
  - **Hojas inferiores (`<Sheet>` en `src/ui/Layout.tsx`)**: Todo bottom sheet **DEBE** usar `<Sheet>` de `@/ui`.
  - **Filas y divisores (`<ListRow>`, `<Divider>` en `src/ui/Rows.tsx`)**: Toda fila estándar de menú, listado plano, histórico o FAQ debe vivir abierta sobre `colors.background` separada con `<Divider />` (`#E0E7EF` / `#272C30`), sin envolver listas en `<Card>`.
  - **Switches (`<CustomSwitch>` en `src/ui/Switch.tsx`)**: Prohibido `<Switch>` nativo.
  - **Datos reales**: **PROHIBIDO** incluir datos de prueba hardcodeados en el frontend; usar siempre respuestas reales de la API con `<SkeletonRows>`, `<ErrorState>` y `<EmptyState>`.

---

## 19. Sistema de Diseño Visual: Paleta, Tipografía y Gráficos (`PortfolioBarChart` y `AnalyticsCharts`)
1. **Lienzo abierto y superficies mate**:
   - Secciones principales (gráficas, listados, históricos, métricas, FAQ) abiertas sobre `colors.background` (`#FFFFFF` / `#000000`) con `<Divider />` de ancho completo (`#E0E7EF` / `#272C30`).
   - Bloques destacados en superficie mate sin borde (`#F4F2F0` claro / `#141518` oscuro) y esquinas redondeadas generosas (`radius.lg` / `radius.full`).
2. **Paleta y tipografía (`src/ui/theme.ts`)**:
   - `primary = #00B4D8` (`primarySoft = #E0F7FA` claro / `#0A2933` oscuro).
   - Semánticos: `success` (`#16A34A` / `#22C55E`), `danger` (`#DC2626` / `#EF4444`), `warning` (`#D97706` / `#F59E0B`), `info` (`#2563EB` / `#3B82F6`).
   - Serie comparativa secundaria en gráficos duales: `chartSecondary` (`#F43F5E` / `#FB7185` degradado a transparente).
   - Familia `Inter` (`Inter_400Regular`, `Inter_500Medium`, `Inter_600SemiBold`, `Inter_700Bold`), **títulos en Capital Case natural** (sin forzar mayúsculas sostenidas) y **cifras económicas con `tabular` (`fontVariant: ['tabular-nums']`)**.
3. **Estándar de gráficos (`PortfolioBarChart` y `AnalyticsCharts`)**:
   - **Sin contenedor card**: el gráfico vive abierto sobre `colors.background` con relleno horizontal `gutter`. En portada (`(tabs)/index.tsx`), el gráfico de balance solo aparece en la pestaña **Todos**.
   - **Guías difuminadas en los extremos**: raíles verticales por columna usando `LinearGradient` (`rgba(..., 0)` → trazo sutil → `rgba(..., 0)`) y líneas horizontales (media o rejilla) también con `LinearGradient` horizontal difuminado en ambos bordes laterales.
   - **Barras en cápsula con degradado descendente**: `borderRadius: radius.full` degradando arriba a tono suave/transparente en la base; la cápsula activa muestra punto interior superior de foco (`peakDot`).
   - **Tooltips flotantes íntegros**: posicionados sobre todo el área de trazado (`plotArea`), nunca restringidos al ancho estrecho de una columna, mostrando el importe completo sin recortes.
   - **Comparador dinámico**: el indicador porcentual y su etiqueta comparan dinámicamente el periodo/mes seleccionado con el inmediatamente anterior (ej. May vs Abr), ajustando color e icono según sea variación positiva, negativa o neutra.

12. **Cero botones o acciones duplicadas en pantalla**
   - **PROHIBIDO** mostrar dos botones o accesos simultáneos en la misma pantalla/pestaña que realicen exactamente la misma acción (p. ej., un botón superior `+ Añadir...` visible al mismo tiempo que el CTA de `<EmptyState />` o menús de opciones redundantes). Cada acción principal debe tener un único punto de entrada claro para no desconcentrar al usuario.

---

## 20. Bloqueo Obligatorio Anti-Doble Envío y Anti-Doble Cobro
- **PROHIBIDO** permitir múltiples pulsaciones o solicitudes simultáneas en botones de publicación, creación, compra, pago, recarga, retiro, suscripción o liberación de Escrow.
- **Primitivos UI bloqueantes (`Button`, `IconButton`, `Pill` / `PillButton`)**: Todo botón interactivo debe bloquear nuevas pulsaciones de forma síncrona mediante `useRef` + estado `loading` / `disabled` mientras la promesa de `onPress` esté en curso.
- **Candado síncrono en pantallas críticas**: Toda pantalla de envío, compra o pago debe usar además un candado `useRef(false)` activado **antes** del primer `await`, mantener el botón con `loading` + `disabled` durante toda la operación, **no liberar el candado tras un éxito que navega fuera de la pantalla** (liberándolo únicamente en `catch` o si el usuario permanece en la vista), y deshabilitar simultáneamente todos los botones de pago hermanos (por ejemplo `Saldo` y `Pagar tarjeta`).

---

## 21. Animaciones Fluidas en Pestañas y Steppers sin Elementos Duplicados
- **PROHIBIDO animar propiedades de layout (`width`, `marginLeft`, `marginRight`, `padding`) o cambiar el peso de fuente (`fontFamily: medium → bold`) al activar pestañas horizontales o `ScrollView` de categorías**, porque provoca recálculos de layout por fotograma y hace que las pestañas adyacentes salten o choquen entre sí como bloques.
- Toda barra de pestañas (`AppHeader`, `TabStrip`) debe mantener **anchos 100% estables** en sus ítems (`fontFamily` constante, iconos con espacio fijo) y animar el **indicador inferior deslizante exclusivamente por GPU (`transform: [{ translateX }, { scaleX }]` sobre un nodo de `width: 1`)** con `react-native-reanimated` (`withTiming` en el hilo UI).
- Comprobar siempre `key === undefined` (nunca `!key`) para que pestañas con clave vacía como `Todos` (`key: ''`) también animen el indicador.
- En flujos con `<Stepper />` (`1 --- 2 --- 3`), **PROHIBIDO** añadir una barra de progreso lineal encima de los círculos numerados para evitar mostrar dos steppers duplicados.
