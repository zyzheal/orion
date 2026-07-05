/**
 * Capability module export verification tests
 */
describe('Capability module exports', () => {
  it('should export CapabilityRepository', async () => {
    const mod = await import('../index');
    expect(mod.CapabilityRepository).toBeDefined();
    expect(typeof mod.CapabilityRepository).toBe('function');
  });

  it('should export CapabilityService', async () => {
    const mod = await import('../index');
    expect(mod.CapabilityService).toBeDefined();
    expect(typeof mod.CapabilityService).toBe('function');
  });

  it('should export CapabilityServiceError', async () => {
    const mod = await import('../index');
    expect(mod.CapabilityServiceError).toBeDefined();
    expect(typeof mod.CapabilityServiceError).toBe('function');
  });
});
