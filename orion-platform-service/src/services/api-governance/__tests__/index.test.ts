/**
 * API Governance module export verification tests
 */
describe('API Governance module exports', () => {
  it('should export APISpecRegistryService', async () => {
    const mod = await import('../index');
    expect(mod.APISpecRegistryService).toBeDefined();
    expect(typeof mod.APISpecRegistryService).toBe('function');
  });

  it('should export APIGovernanceRepository', async () => {
    const mod = await import('../index');
    expect(mod.APIGovernanceRepository).toBeDefined();
    expect(typeof mod.APIGovernanceRepository).toBe('function');
  });

  it('should export APIGovernanceError', async () => {
    const mod = await import('../index');
    expect(mod.APIGovernanceError).toBeDefined();
    expect(typeof mod.APIGovernanceError).toBe('function');
  });

  it('should be importable without errors', async () => {
    const mod = await import('../index');
    expect(mod).toBeDefined();
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
