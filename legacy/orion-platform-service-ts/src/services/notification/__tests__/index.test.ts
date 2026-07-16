/**
 * Notification module export verification tests
 */
describe('Notification module exports', () => {
  it('should export NotificationRepository', async () => {
    const mod = await import('../index');
    expect(mod.NotificationRepository).toBeDefined();
    expect(typeof mod.NotificationRepository).toBe('function');
  });

  it('should export NotificationService', async () => {
    const mod = await import('../index');
    expect(mod.NotificationService).toBeDefined();
    expect(typeof mod.NotificationService).toBe('function');
  });

  it('should export NotificationServiceError', async () => {
    const mod = await import('../index');
    expect(mod.NotificationServiceError).toBeDefined();
    expect(typeof mod.NotificationServiceError).toBe('function');
  });

  it('should export NotificationSettingsRepository', async () => {
    const mod = await import('../index');
    expect(mod.NotificationSettingsRepository).toBeDefined();
    expect(typeof mod.NotificationSettingsRepository).toBe('function');
  });

  it('should export NotificationSettingsService', async () => {
    const mod = await import('../index');
    expect(mod.NotificationSettingsService).toBeDefined();
    expect(typeof mod.NotificationSettingsService).toBe('function');
  });

  it('should be importable without errors', async () => {
    const mod = await import('../index');
    expect(mod).toBeDefined();
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
