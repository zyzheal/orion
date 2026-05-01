import React, { createContext, useContext, useMemo } from 'react';
import { colors } from '@/tokens/colors';

export interface ChartThemeConfig {
  palette: string[];
  success: string;
  warning: string;
  error: string;
  info: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  fontSize: number;
  fontFamily: string;
}

export function extractColorPalette(): string[] {
  return [
    colors.primary[500],
    colors.success[500],
    colors.warning[500],
    colors.error[500],
    colors.info[500],
    colors.purple[500],
    colors.primary[400],
    colors.success[400],
    colors.warning[400],
    colors.info[300],
  ];
}

export function getChartTheme(dark = false): Record<string, unknown> {
  const themeColors = dark ? colors.dark : colors.light;
  const palette = extractColorPalette();

  return {
    color: palette,
    backgroundColor: themeColors.bg.primary,
    textStyle: {
      color: themeColors.text.primary,
      fontSize: 12,
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
    title: {
      textStyle: {
        color: themeColors.text.primary,
        fontSize: 14,
        fontWeight: 600,
      },
    },
    categoryAxis: {
      axisLine: { lineStyle: { color: themeColors.border.default } },
      axisLabel: { color: themeColors.text.secondary },
      splitLine: { show: false },
    },
    valueAxis: {
      axisLine: { lineStyle: { color: themeColors.border.default } },
      axisLabel: { color: themeColors.text.secondary },
      splitLine: { lineStyle: { color: themeColors.border.light } },
    },
    legend: {
      textStyle: { color: themeColors.text.secondary },
    },
    tooltip: {
      backgroundColor: dark ? colors.dark.bg.elevated : colors.light.bg.elevated,
      borderColor: themeColors.border.default,
      textStyle: { color: themeColors.text.primary },
    },
  };
}

const ChartContext = createContext<ChartThemeConfig | null>(null);

export const ChartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const config = useMemo<ChartThemeConfig>(() => {
    const palette = extractColorPalette();
    return {
      palette,
      success: colors.success[500],
      warning: colors.warning[500],
      error: colors.error[500],
      info: colors.info[500],
      backgroundColor: colors.light.bg.primary,
      textColor: colors.light.text.primary,
      borderColor: colors.light.border.default,
      fontSize: 12,
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    };
  }, []);

  return <ChartContext.Provider value={config}>{children}</ChartContext.Provider>;
};

export function useChartTheme(): ChartThemeConfig {
  const ctx = useContext(ChartContext);
  if (!ctx) {
    throw new Error('useChartTheme must be used within ChartProvider');
  }
  return ctx;
}
