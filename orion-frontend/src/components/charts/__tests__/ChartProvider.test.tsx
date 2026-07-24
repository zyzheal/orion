import { describe, it, expect } from 'vitest';
import { getChartTheme, extractColorPalette } from '../ChartProvider';
import { colors } from '@/tokens/colors';

describe('ChartProvider', () => {
  describe('getChartTheme', () => {
    it('returns theme with correct structure', () => {
      const theme = getChartTheme();
      expect(theme).toHaveProperty('color');
      expect(theme).toHaveProperty('backgroundColor');
      expect(theme).toHaveProperty('textStyle');
      expect(Array.isArray(theme.color)).toBe(true);
    });

    it('maps success/warning/error colors from Design Tokens', () => {
      const theme = getChartTheme();
      expect(theme.color).toContain(colors.success[500]);
      expect(theme.color).toContain(colors.warning[500]);
      expect(theme.color).toContain(colors.error[500]);
    });

    it('generates 10-color palette', () => {
      const palette = extractColorPalette();
      expect(palette.length).toBe(10);
    });

    it('uses light mode background by default', () => {
      const theme = getChartTheme();
      expect(theme.backgroundColor).toBe(colors.light.bg.primary);
    });
  });
});
