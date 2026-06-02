/**
 * Queue module export verification tests
 */
describe('Queue module exports', () => {
  it('should export QueueRepository', async () => {
    const mod = await import('../index');
    expect(mod.QueueRepository).toBeDefined();
    expect(typeof mod.QueueRepository).toBe('function');
  });

  it('should export QueueService', async () => {
    const mod = await import('../index');
    expect(mod.QueueService).toBeDefined();
    expect(typeof mod.QueueService).toBe('function');
  });

  it('should export QueueServiceError', async () => {
    const mod = await import('../index');
    expect(mod.QueueServiceError).toBeDefined();
    expect(typeof mod.QueueServiceError).toBe('function');
  });

  it('should be importable without errors', async () => {
    const mod = await import('../index');
    expect(mod).toBeDefined();
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
