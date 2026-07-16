/**
 * Build module export verification tests
 */
describe('Build module exports', () => {
  it('should export BuildRepository', async () => {
    const mod = await import('../index');
    expect(mod.BuildRepository).toBeDefined();
    expect(typeof mod.BuildRepository).toBe('function');
  });

  it('should export BuildService', async () => {
    const mod = await import('../index');
    expect(mod.BuildService).toBeDefined();
    expect(typeof mod.BuildService).toBe('function');
  });

  it('should export BuildServiceError', async () => {
    const mod = await import('../index');
    expect(mod.BuildServiceError).toBeDefined();
    expect(typeof mod.BuildServiceError).toBe('function');
  });

  it('should be importable without errors', async () => {
    const mod = await import('../index');
    expect(mod).toBeDefined();
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
