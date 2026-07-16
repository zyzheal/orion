/**
 * ChatOps module export verification tests
 */
describe('ChatOps module exports', () => {
  it('should export CommandService', async () => {
    const mod = await import('../index');
    expect(mod.CommandService).toBeDefined();
    expect(typeof mod.CommandService).toBe('function');
  });

  it('should export ExecutionService', async () => {
    const mod = await import('../index');
    expect(mod.ExecutionService).toBeDefined();
    expect(typeof mod.ExecutionService).toBe('function');
  });

  it('should be importable without errors', async () => {
    const mod = await import('../index');
    expect(mod).toBeDefined();
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
