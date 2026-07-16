/**
 * Cache module export verification tests
 */
describe('Cache module exports', () => {
  it('should export CacheRepository', async () => {
    const mod = await import('../index');
    expect(mod.CacheRepository).toBeDefined();
    expect(typeof mod.CacheRepository).toBe('function');
  });

  it('should export CacheService', async () => {
    const mod = await import('../index');
    expect(mod.CacheService).toBeDefined();
    expect(typeof mod.CacheService).toBe('function');
  });

  it('should export CacheServiceError', async () => {
    const mod = await import('../index');
    expect(mod.CacheServiceError).toBeDefined();
    expect(typeof mod.CacheServiceError).toBe('function');
  });

  it('should be importable without errors', async () => {
    const mod = await import('../index');
    expect(mod).toBeDefined();
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
