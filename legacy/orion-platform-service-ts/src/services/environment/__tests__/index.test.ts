/**
 * Environment module export verification tests
 */
describe('Environment module exports', () => {
  it('should export EnvironmentRepository', async () => {
    const mod = await import('../index');
    expect(mod.EnvironmentRepository).toBeDefined();
    expect(typeof mod.EnvironmentRepository).toBe('function');
  });

  it('should export EnvironmentService', async () => {
    const mod = await import('../index');
    expect(mod.EnvironmentService).toBeDefined();
    expect(typeof mod.EnvironmentService).toBe('function');
  });

  it('should export EnvironmentServiceError', async () => {
    const mod = await import('../index');
    expect(mod.EnvironmentServiceError).toBeDefined();
    expect(typeof mod.EnvironmentServiceError).toBe('function');
  });

  it('should be importable without errors', async () => {
    const mod = await import('../index');
    expect(mod).toBeDefined();
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
