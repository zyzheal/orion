/**
 * Agent module export verification tests
 */
describe('Agent module exports', () => {
  it('should export AgentRepository', async () => {
    const mod = await import('../index');
    expect(mod.AgentRepository).toBeDefined();
    expect(typeof mod.AgentRepository).toBe('function');
  });

  it('should export AgentService', async () => {
    const mod = await import('../index');
    expect(mod.AgentService).toBeDefined();
    expect(typeof mod.AgentService).toBe('function');
  });

  it('should export AgentServiceError', async () => {
    const mod = await import('../index');
    expect(mod.AgentServiceError).toBeDefined();
    expect(typeof mod.AgentServiceError).toBe('function');
  });

  it('should be importable without errors', async () => {
    const mod = await import('../index');
    expect(mod).toBeDefined();
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
