import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { applyThemeVariables, initThemeEngine } from '../themeEngine';

describe('ThemeEngine', () => {
  let styles: HTMLStyleElement[] = [];

  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    styles = Array.from(document.querySelectorAll('style[id^="orion-tokens"]'));
    styles.forEach((s) => s.remove());
  });

  afterEach(() => {
    styles = Array.from(document.querySelectorAll('style[id^="orion-tokens"]'));
    styles.forEach((s) => s.remove());
  });

  it('should apply light theme CSS variables', () => {
    applyThemeVariables('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    const css = getComputedStyle(document.documentElement);
    expect(css.getPropertyValue('--bg-primary')).toBe('#ffffff');
    expect(css.getPropertyValue('--text-primary')).toBe('#1f1f1f');
  });

  it('should apply dark theme CSS variables', () => {
    applyThemeVariables('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    const css = getComputedStyle(document.documentElement);
    expect(css.getPropertyValue('--bg-primary')).toBe('#141414');
    expect(css.getPropertyValue('--text-primary')).toBe('#ffffff');
  });

  it('should apply high-contrast theme CSS variables', () => {
    applyThemeVariables('high-contrast');
    expect(document.documentElement.getAttribute('data-theme')).toBe('high-contrast');

    const css = getComputedStyle(document.documentElement);
    expect(css.getPropertyValue('--bg-primary')).toBe('#141414');
    expect(css.getPropertyValue('--text-primary')).toBe('#FFFFFF');
  });

  it('should be idempotent (same theme applied twice)', () => {
    applyThemeVariables('dark');
    const styleCount1 = document.querySelectorAll('style[id^="orion-tokens"]').length;
    applyThemeVariables('dark');
    const styleCount2 = document.querySelectorAll('style[id^="orion-tokens"]').length;
    expect(styleCount1).toBe(styleCount2);
  });

  it('should apply custom tokens', () => {
    applyThemeVariables('light', {
      spacing: { md: 16, lg: 24 } as never,
    });
    const customEl = document.getElementById('orion-tokens-custom');
    expect(customEl).not.toBeNull();
    expect(customEl?.textContent).toContain('--spacing-md: 16px');
  });
});
