import { useMemo } from 'react';
import { useAppStore } from '@/stores/appStore';
import { colors } from '@/tokens/colors';
type ThemeMode = 'light' | 'dark';

export interface UseThemeReturn {
  isDark: boolean;
  theme: ThemeMode;
  bg: {
    primary: string;
    secondary: string;
    tertiary: string;
    elevated: string;
  };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    disabled: string;
  };
  border: {
    default: string;
    light: string;
    heavy: string;
  };
}

/**
 * useTheme — reactive hook that reads the current theme from appStore
 * and returns the correct background / text / border design tokens.
 *
 * Consumers should prefer this over hard-coding colors.light.* or
 * colors.dark.*, so that page components automatically re-render when
 * the user toggles between light and dark mode.
 */
export function useTheme(): UseThemeReturn {
  const theme = useAppStore((state) => state.theme);

  return useMemo<UseThemeReturn>(() => {
    const isDark = theme === 'dark';
    const palette = isDark ? colors.dark : colors.light;

    return {
      isDark,
      theme,
      bg: {
        primary: palette.bg.primary,
        secondary: palette.bg.secondary,
        tertiary: palette.bg.tertiary,
        elevated: palette.bg.elevated,
      },
      text: {
        primary: palette.text.primary,
        secondary: palette.text.secondary,
        tertiary: palette.text.tertiary,
        disabled: palette.text.disabled,
      },
      border: {
        default: palette.border.default,
        light: palette.border.light,
        heavy: palette.border.heavy,
      },
    };
  }, [theme]);
}
