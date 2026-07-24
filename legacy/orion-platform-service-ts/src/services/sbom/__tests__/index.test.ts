/**
 * SBOM module export verification tests
 */
describe('SBOM module exports', () => {
  it('should export SBOMGeneratorService', async () => {
    const mod = await import('../index');
    expect(mod.SBOMGeneratorService).toBeDefined();
    expect(typeof mod.SBOMGeneratorService).toBe('function');
  });

  it('should be importable without errors', async () => {
    const mod = await import('../index');
    expect(mod).toBeDefined();
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
