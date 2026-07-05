/**
 * Model Version module export verification tests
 */
describe('Model Version module exports', () => {
  it('should export ModelVersionService', async () => {
    const mod = await import('../index');
    expect(mod.ModelVersionService).toBeDefined();
    expect(typeof mod.ModelVersionService).toBe('function');
  });

  it('should export ModelVersionRepository', async () => {
    const mod = await import('../index');
    expect(mod.ModelVersionRepository).toBeDefined();
    expect(typeof mod.ModelVersionRepository).toBe('function');
  });

  it('should export ModelVersionServiceError', async () => {
    const mod = await import('../index');
    expect(mod.ModelVersionServiceError).toBeDefined();
    expect(typeof mod.ModelVersionServiceError).toBe('function');
  });
});
