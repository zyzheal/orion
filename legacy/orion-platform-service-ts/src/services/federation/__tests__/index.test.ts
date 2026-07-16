/**
 * Federation module export verification tests
 */
describe('Federation module exports', () => {
  it('should export FederationAdvancedService', async () => {
    const mod = await import('../index');
    expect(mod.FederationAdvancedService).toBeDefined();
    expect(typeof mod.FederationAdvancedService).toBe('function');
  });

  it('should export FederationSchedulerService', async () => {
    const mod = await import('../index');
    expect(mod.FederationSchedulerService).toBeDefined();
    expect(typeof mod.FederationSchedulerService).toBe('function');
  });

  it('should export FederationService', async () => {
    const mod = await import('../index');
    expect(mod.FederationService).toBeDefined();
    expect(typeof mod.FederationService).toBe('function');
  });

  it('should export ClusterHealthMonitor', async () => {
    const mod = await import('../index');
    expect(mod.ClusterHealthMonitor).toBeDefined();
    expect(typeof mod.ClusterHealthMonitor).toBe('function');
  });
});
