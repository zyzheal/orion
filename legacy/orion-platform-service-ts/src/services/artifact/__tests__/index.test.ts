/**
 * Artifact module export verification tests
 */
describe('Artifact module exports', () => {
  it('should export ArtifactRepository', async () => {
    const mod = await import('../index');
    expect(mod.ArtifactRepository).toBeDefined();
    expect(typeof mod.ArtifactRepository).toBe('function');
  });

  it('should export ArtifactService', async () => {
    const mod = await import('../index');
    expect(mod.ArtifactService).toBeDefined();
    expect(typeof mod.ArtifactService).toBe('function');
  });

  it('should export ArtifactServiceError', async () => {
    const mod = await import('../index');
    expect(mod.ArtifactServiceError).toBeDefined();
    expect(typeof mod.ArtifactServiceError).toBe('function');
  });

  it('should be importable without errors', async () => {
    const mod = await import('../index');
    expect(mod).toBeDefined();
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
