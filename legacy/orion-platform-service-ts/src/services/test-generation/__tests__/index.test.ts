/**
 * Test Generation module export verification tests
 */
describe('Test Generation module exports', () => {
  it('should export TestGeneratorService', async () => {
    const mod = await import('../index');
    expect(mod.TestGeneratorService).toBeDefined();
    expect(typeof mod.TestGeneratorService).toBe('function');
  });

  it('should export ChangeAnalyzer', async () => {
    const mod = await import('../index');
    expect(mod.ChangeAnalyzer).toBeDefined();
    expect(typeof mod.ChangeAnalyzer).toBe('function');
  });

  it('should export TestTemplateEngine', async () => {
    const mod = await import('../index');
    expect(mod.TestTemplateEngine).toBeDefined();
    expect(typeof mod.TestTemplateEngine).toBe('function');
  });

  it('should be importable without errors', async () => {
    const mod = await import('../index');
    expect(mod).toBeDefined();
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
