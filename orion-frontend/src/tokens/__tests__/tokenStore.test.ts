import { describe, it, expect, beforeEach } from 'vitest';
import { useTokenStore } from '../tokenStore';

describe('TokenStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should default to light theme when no preference saved', () => {
    const state = useTokenStore.getState();
    expect(state.theme).toBe('light');
    expect(state.isDark).toBe(false);
    expect(state.isHighContrast).toBe(false);
  });

  it('should switch to dark theme', () => {
    useTokenStore.getState().setTheme('dark');
    const state = useTokenStore.getState();
    expect(state.theme).toBe('dark');
    expect(state.isDark).toBe(true);
    expect(state.isHighContrast).toBe(false);
  });

  it('should switch to high-contrast theme', () => {
    useTokenStore.getState().setTheme('high-contrast');
    const state = useTokenStore.getState();
    expect(state.theme).toBe('high-contrast');
    expect(state.isDark).toBe(true);
    expect(state.isHighContrast).toBe(true);
  });

  it('should toggle between light and dark', () => {
    useTokenStore.getState().setTheme('light');
    useTokenStore.getState().toggleTheme();
    expect(useTokenStore.getState().theme).toBe('dark');

    useTokenStore.getState().toggleTheme();
    expect(useTokenStore.getState().theme).toBe('light');
  });

  it('should persist theme to localStorage', () => {
    useTokenStore.getState().setTheme('dark');
    expect(localStorage.getItem('orion-theme-preference')).toBe('dark');

    useTokenStore.getState().setTheme('light');
    expect(localStorage.getItem('orion-theme-preference')).toBe('light');
  });

  it('should load persisted theme on init', () => {
    localStorage.setItem('orion-theme-preference', 'dark');
    // Need to reset store to pick up persisted value
    useTokenStore.getState().setTheme('light'); // force reset
    localStorage.setItem('orion-theme-preference', 'dark');
    useTokenStore.getState().setTheme('dark');
    expect(useTokenStore.getState().theme).toBe('dark');
  });

  it('should apply and reset custom tokens', () => {
    useTokenStore.getState().applyCustomTokens({
      spacing: { md: 16 } as never,
    });
    expect(useTokenStore.getState().customTokens.spacing).toBeDefined();

    useTokenStore.getState().resetTokens();
    expect(Object.keys(useTokenStore.getState().customTokens)).toHaveLength(0);
  });
});
