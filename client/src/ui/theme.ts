// src/ui/theme.ts
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Appearance,
  StyleSheet,
  useColorScheme as useSystemColorScheme,
  type ColorSchemeName,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationLightTheme,
  Theme as NavigationTheme,
} from '@react-navigation/native';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export interface ColorPalette {
  // Fondos y superficies
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceSubtle: string;
  overlay: string;

  // Textos y jerarquía tipográfica
  text: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;

  // Bordes y divisores
  border: string;
  borderStrong: string;
  divider: string;

  // Marca / Acciones principales
  primary: string;
  primaryForeground: string;
  primarySoft: string;

  // Estados semánticos
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
  chartSecondary: string;

  // Inputs y controles
  inputBackground: string;
  inputBorder: string;
  inputPlaceholder: string;
  switchTrackOff: string;

  // Compatibilidad con la app existente
  bg: string;
  surfaceAlt: string;
  tabBar: string;
  tabActive: string;
  ink: string;
  muted: string;
  faint: string;
  line: string;
  accent: string;
  accentSoft: string;
  warn: string;
  warnSoft: string;
  onInk: string;
  onInkSecondary: string;
}

export type ColorName = keyof ColorPalette;
export type Palette = ColorPalette;

export const lightColors: ColorPalette = {
  // Fondos y superficies
  background: '#FFFFFF',       // Lienzo abierto blanco puro
  surface: '#F4F2F0',          // Superficie mate sutil sin marco para bloques destacados
  surfaceElevated: '#FFFFFF',  // Modales, sheets, tooltips y barras flotantes
  surfaceSubtle: '#F4F2F0',    // Fondos mate secundarios, chips inactivos, avatares
  overlay: 'rgba(15, 23, 42, 0.45)',

  // Textos
  text: '#0F172A',             // Alto contraste
  textSecondary: '#475569',    // Subtítulos y descripciones
  textMuted: '#94A3B8',        // Metadatos, fechas, contadores
  textInverse: '#FFFFFF',      // Texto sobre botones oscuros/primarios

  // Bordes y divisores
  border: '#E0E7EF',           // Trazo limpio de ancho completo
  borderStrong: '#CBD5E1',     // Borde enfatizado
  divider: '#E0E7EF',          // <Divider /> de ancho completo en modo claro

  // Marca
  primary: '#00B4D8',          // Acento principal cyan
  primaryForeground: '#FFFFFF',
  primarySoft: '#E0F7FA',

  // Estados semánticos
  success: '#16A34A',
  successSoft: '#DCFCE7',
  warning: '#D97706',
  warningSoft: '#FEF3C7',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  info: '#2563EB',
  infoSoft: '#DBEAFE',
  chartSecondary: '#F43F5E',   // Serie comparativa secundaria en gráficos duales

  // Controles
  inputBackground: '#FFFFFF',
  inputBorder: '#E0E7EF',
  inputPlaceholder: '#94A3B8',
  switchTrackOff: '#E0E7EF',

  // Tokens heredados
  bg: '#FFFFFF',
  surfaceAlt: '#F4F2F0',
  tabBar: '#FFFFFF',
  tabActive: '#E0F7FA',
  ink: '#0F172A',
  muted: '#475569',
  faint: '#94A3B8',
  line: '#E0E7EF',
  accent: '#00B4D8',
  accentSoft: '#E0F7FA',
  warn: '#D97706',
  warnSoft: '#FEF3C7',
  onInk: '#FFFFFF',
  onInkSecondary: '#D1D5DB',
};

export const darkColors: ColorPalette = {
  // Fondos y superficies
  background: '#000000',       // Lienzo abierto negro puro
  surface: '#141518',          // Superficie mate sutil sin marco en modo oscuro
  surfaceElevated: '#1C1D22',  // Modales, sheets, tooltips elevados
  surfaceSubtle: '#141518',    // Chips inactivos, bloques mate, avatares
  overlay: 'rgba(0, 0, 0, 0.72)',

  // Textos
  text: '#FAFAFA',             // Blanco nítido
  textSecondary: '#A1A1AA',    // Gris medio legible sobre negro
  textMuted: '#71717A',        // Metadatos y textos deshabilitados
  textInverse: '#000000',      // Texto oscuro sobre botones claros

  // Bordes y divisores
  border: '#272C30',           // Borde / trazo en modo oscuro
  borderStrong: '#383E44',     // Borde enfatizado
  divider: '#272C30',          // <Divider /> de ancho completo en modo oscuro

  // Marca
  primary: '#00B4D8',
  primaryForeground: '#FFFFFF',
  primarySoft: '#0A2933',

  // Estados semánticos
  success: '#22C55E',
  successSoft: 'rgba(34, 197, 94, 0.16)',
  warning: '#F59E0B',
  warningSoft: 'rgba(245, 158, 11, 0.16)',
  danger: '#EF4444',
  dangerSoft: 'rgba(239, 68, 68, 0.16)',
  info: '#3B82F6',
  infoSoft: 'rgba(59, 130, 246, 0.16)',
  chartSecondary: '#FB7185',   // Serie comparativa secundaria en gráficos duales

  // Controles
  inputBackground: '#141518',
  inputBorder: '#272C30',
  inputPlaceholder: '#71717A',
  switchTrackOff: '#272C30',

  // Tokens heredados
  bg: '#000000',
  surfaceAlt: '#141518',
  tabBar: '#000000',
  tabActive: '#0A2933',
  ink: '#FAFAFA',
  muted: '#A1A1AA',
  faint: '#71717A',
  line: '#272C30',
  accent: '#00B4D8',
  accentSoft: '#0A2933',
  warn: '#F59E0B',
  warnSoft: 'rgba(245, 158, 11, 0.16)',
  onInk: '#000000',
  onInkSecondary: '#A1A1AA',
};

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

export const gutter = space.xl;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  full: 9999,
  pill: 9999,
} as const;

export const fonts = {
  light: 'Inter_300Light',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  brand: 'Chomsky',
} as const;

export const typography = {
  xs: { fontSize: 12, lineHeight: 16 },
  sm: { fontSize: 14, lineHeight: 20 },
  base: { fontSize: 16, lineHeight: 24 },
  lg: { fontSize: 18, lineHeight: 26 },
  xl: { fontSize: 22, lineHeight: 30 },
  xxl: { fontSize: 28, lineHeight: 36 },
} as const;

export const type = {
  display: { fontFamily: fonts.bold, fontSize: 34, lineHeight: 40, letterSpacing: -1.1 },
  title: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.8 },
  heading: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 23, letterSpacing: -0.3 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  label: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
  kicker: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20 },
} satisfies Record<string, TextStyle>;
export type TypeVariant = keyof typeof type;

export const defaultColor: Record<TypeVariant, ColorName> = {
  display: 'ink',
  title: 'ink',
  heading: 'ink',
  body: 'muted',
  label: 'ink',
  caption: 'muted',
  kicker: 'accent',
};

export interface Theme {
  mode: ThemeMode;
  scheme: ResolvedTheme;
  isDark: boolean;
  colors: ColorPalette;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  navigationTheme: NavigationTheme;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const THEME_STORAGE_KEY = '@cashbank_theme_mode';
const THEME_STORAGE_KEY_LEGACY = 'cashbank_theme_preference';

let currentThemeMode: ThemeMode = 'system';
let currentSystemScheme: ColorSchemeName | null | undefined = Appearance.getColorScheme();

function computeIsDark(mode: ThemeMode, sysScheme: ColorSchemeName | null | undefined): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return sysScheme === 'dark';
}

export let isDark = computeIsDark(currentThemeMode, currentSystemScheme);

export function getActiveColors(): ColorPalette {
  return isDark ? darkColors : lightColors;
}

export function getThemeMode(): ThemeMode {
  return currentThemeMode;
}

/** Proxy reactivo: leer colors.bg o cualquier token devuelve siempre el color activo */
export const colors: ColorPalette = new Proxy({} as ColorPalette, {
  get(_target, prop: string) {
    const palette = getActiveColors();
    return (palette as any)[prop];
  },
});

type ThemeListener = () => void;
const themeListeners = new Set<ThemeListener>();

function notifyThemeListeners() {
  themeListeners.forEach((fn) => fn());
}

export async function setThemeMode(mode: ThemeMode): Promise<void> {
  currentThemeMode = mode;
  isDark = computeIsDark(currentThemeMode, currentSystemScheme);
  try {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    await AsyncStorage.setItem(THEME_STORAGE_KEY_LEGACY, mode);
  } catch {}
  notifyThemeListeners();
}

export async function hydrateTheme(): Promise<void> {
  try {
    const saved =
      (await AsyncStorage.getItem(THEME_STORAGE_KEY)) ||
      (await AsyncStorage.getItem(THEME_STORAGE_KEY_LEGACY));
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      currentThemeMode = saved as ThemeMode;
    }
  } catch {}
  currentSystemScheme = Appearance.getColorScheme();
  isDark = computeIsDark(currentThemeMode, currentSystemScheme);
  notifyThemeListeners();
}

Appearance.addChangeListener(({ colorScheme }) => {
  currentSystemScheme = colorScheme;
  isDark = computeIsDark(currentThemeMode, currentSystemScheme);
  notifyThemeListeners();
});

const ThemeContext = createContext<Theme | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useSystemColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(currentThemeMode);

  useEffect(() => {
    hydrateTheme().then(() => {
      setModeState(currentThemeMode);
    });

    const listener = () => {
      setModeState(currentThemeMode);
    };
    themeListeners.add(listener);
    return () => {
      themeListeners.delete(listener);
    };
  }, []);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    setThemeMode(newMode);
  }, []);

  const resolvedScheme: ResolvedTheme = useMemo(() => {
    if (mode === 'system') {
      return systemScheme === 'dark' ? 'dark' : 'light';
    }
    return mode;
  }, [mode, systemScheme]);

  const activeIsDark = resolvedScheme === 'dark';
  const activeColors = activeIsDark ? darkColors : lightColors;

  useEffect(() => {
    isDark = activeIsDark;
  }, [activeIsDark]);

  const toggleTheme = useCallback(() => {
    setMode(activeIsDark ? 'light' : 'dark');
  }, [activeIsDark, setMode]);

  const navigationTheme: NavigationTheme = useMemo(() => {
    const base = activeIsDark ? NavigationDarkTheme : NavigationLightTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: activeColors.primary,
        background: activeColors.background,
        card: activeColors.surface,
        text: activeColors.text,
        border: activeColors.border,
        notification: activeColors.danger,
      },
    };
  }, [activeIsDark, activeColors]);

  const value = useMemo<Theme>(
    () => ({
      mode,
      scheme: resolvedScheme,
      isDark: activeIsDark,
      colors: activeColors,
      spacing,
      radius,
      typography,
      navigationTheme,
      setMode,
      toggleTheme,
    }),
    [mode, resolvedScheme, activeIsDark, activeColors, navigationTheme, setMode, toggleTheme]
  );

  return React.createElement(ThemeContext.Provider, { value }, children);
};

export function useTheme(): Theme {
  const context = useContext(ThemeContext);
  if (!context) {
    // Si se usa fuera del Provider, fallback al valor global
    return {
      mode: currentThemeMode,
      scheme: isDark ? 'dark' : 'light',
      isDark,
      colors: getActiveColors(),
      spacing,
      radius,
      typography,
      navigationTheme: isDark ? NavigationDarkTheme : NavigationLightTheme,
      setMode: (m) => {
        setThemeMode(m);
      },
      toggleTheme: () => {
        setThemeMode(isDark ? 'light' : 'dark');
      },
    };
  }
  return context;
}

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * Hook para crear StyleSheets reactivos al tema actual con memorización.
 */
export function useThemedStyles<T extends NamedStyles<T> | NamedStyles<any>>(
  factory: (theme: Theme) => T
): T {
  const theme = useTheme();
  return useMemo(() => StyleSheet.create(factory(theme)), [theme, factory]);
}
