/**
 * Cost Tracking module export verification tests
 */
describe('Cost Tracking module exports', () => {
  it('should export CostTrackingService', async () => {
    const mod = await import('../index');
    expect(mod.CostTrackingService).toBeDefined();
    expect(typeof mod.CostTrackingService).toBe('function');
  });

  it('should be importable without errors', async () => {
    const mod = await import('../index');
    expect(mod).toBeDefined();
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
