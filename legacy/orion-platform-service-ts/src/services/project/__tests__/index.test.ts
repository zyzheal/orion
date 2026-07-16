/**
 * Project module export verification tests
 */
describe('Project module exports', () => {
  it('should export ProjectRepository', async () => {
    const mod = await import('../index');
    expect(mod.ProjectRepository).toBeDefined();
    expect(typeof mod.ProjectRepository).toBe('function');
  });

  it('should export ProjectService', async () => {
    const mod = await import('../index');
    expect(mod.ProjectService).toBeDefined();
    expect(typeof mod.ProjectService).toBe('function');
  });

  it('should export ProjectServiceError', async () => {
    const mod = await import('../index');
    expect(mod.ProjectServiceError).toBeDefined();
    expect(typeof mod.ProjectServiceError).toBe('function');
  });

  it('should be importable without errors', async () => {
    const mod = await import('../index');
    expect(mod).toBeDefined();
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
