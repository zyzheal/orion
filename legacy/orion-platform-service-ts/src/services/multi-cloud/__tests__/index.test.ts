/**
 * Multi-Cloud module export verification tests
 */
describe('Multi-Cloud module exports', () => {
  it('should export MultiCloudAdvancedService', async () => {
    const mod = await import('../index');
    expect(mod.MultiCloudAdvancedService).toBeDefined();
    expect(typeof mod.MultiCloudAdvancedService).toBe('function');
  });

  it('should export MultiCloudManagerService', async () => {
    const mod = await import('../index');
    expect(mod.MultiCloudManagerService).toBeDefined();
    expect(typeof mod.MultiCloudManagerService).toBe('function');
  });

  it('should export CloudProviderService', async () => {
    const mod = await import('../index');
    expect(mod.CloudProviderService).toBeDefined();
    expect(typeof mod.CloudProviderService).toBe('function');
  });

  it('should export ResourceAbstractionLayer', async () => {
    const mod = await import('../index');
    expect(mod.ResourceAbstractionLayer).toBeDefined();
    expect(typeof mod.ResourceAbstractionLayer).toBe('function');
  });
});
