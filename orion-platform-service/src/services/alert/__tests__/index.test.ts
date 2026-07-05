/**
 * Alert module export verification tests
 */
describe('Alert module exports', () => {
  it('should export AlertCorrelationService', async () => {
    const mod = await import('../index');
    expect(mod.AlertCorrelationService).toBeDefined();
    expect(typeof mod.AlertCorrelationService).toBe('function');
  });

  it('should be importable without errors', async () => {
    const mod = await import('../index');
    expect(mod).toBeDefined();
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
