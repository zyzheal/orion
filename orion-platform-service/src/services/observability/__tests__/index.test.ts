/**
 * Observability module export verification tests
 */
describe('Observability module exports', () => {
  it('should export ExecutionTimelineService', async () => {
    const mod = await import('../index');
    expect(mod.ExecutionTimelineService).toBeDefined();
    expect(typeof mod.ExecutionTimelineService).toBe('function');
  });
});
