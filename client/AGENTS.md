This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Reglas de Diseño Obligatorias (`DESIGN_RULES.md`)

Antes de crear o modificar cualquier pantalla o componente visual en `client/`, es **OBLIGATORIO** leer y respetar íntegramente [DESIGN_RULES.md](./DESIGN_RULES.md):

1. **Herencia única en `src/ui/` (`@/ui`)**:
   - **Prohibido usar `<TextInput>` directamente** fuera de `src/ui/Field.tsx`. Todos los campos de texto (login, registro, presupuestos, publicar, chat, teléfono, búsqueda, perfil) DEBEN usar `<Field />` con un diseño único estándar: cápsula **redondeada al 100% (`radius.full`) con icono** (`icon`).
   - **Headers no estáticos en pestañas**: `HomeHeader`, `ScreenHeader` y barras superiores dentro de pestañas van dentro del `<ScrollView>` para desplazarse con el contenido.
   - **Prohibido crear píldoras/badges/chips locales**: todo debe heredar de `Pill`, `PillButton`, `PillTab`, `PillBadge`, `PillCarousel`, `Chip`, `ChipRow`, `Badge` (`radius.full = 9999`, `margin: 0`).
   - **Prohibido usar `<Switch />` nativo**: usar siempre `<CustomSwitch />` (`colors.primary = #00B4D8`).
   - **Lienzo abierto y superficies mate sin marco**: fondo `colors.background` (`#FFFFFF` claro / `#000000` oscuro) con `<Divider />` (`#E0E7EF` / `#272C30`), evitando envolver listas o gráficos en tarjetas con borde/sombra; los bloques destacados (`<Card />`) usan superficie mate sin borde (`#F4F2F0` claro / `#141518` oscuro).
   - **Prohibido redefinir botones circulares ad-hoc o bottom sheets**: usar `<IconButton />` y `<Sheet />` de `@/ui`.
   - **Paleta y tipografía visual**: `primary = #00B4D8` (`#E0F7FA` / `#0A2933`), serie comparativa dual `chartSecondary = #F43F5E` / `#FB7185`, fuente `Inter` con títulos en Capital Case natural (sin forzar mayúsculas) y cifras económicas con `tabular` (`fontVariant: ['tabular-nums']`).
   - **Gráficos estándar (`PortfolioBarChart` y `AnalyticsCharts`)**: abiertos sobre fondo sin card (`gutter`), guías verticales/horizontales difuminadas con `LinearGradient`, barras cápsula `radius.full` con degradado descendente y `peakDot`, tooltips anchos en `plotArea`, comparador dinámico vs periodo anterior y en portada solo visible en **Todos**.
   - **Pestañas siempre al 100% del ancho**: usar `<TabStrip />` o `<SegmentedPills />` (`src/ui/Tabs.tsx`).
   - **Carruseles horizontales siempre 100% ancho sin recorte lateral**: usar `<PillCarousel>` / `<ChipRow>` fuera de padres con padding o con `fullBleed`.
   - **Sin `<Modal>` anidados en Android**: usar overlays absolutos (`zIndex: 1000`, `elevation: 10`) con `<Sheet />`.
   - **Tema 100% reactivo**: consumir siempre `useTheme()`; nunca colores estáticos en `StyleSheet.create`.
   - **Cero datos mock hardcodeados** en pantallas o librerías del cliente.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
