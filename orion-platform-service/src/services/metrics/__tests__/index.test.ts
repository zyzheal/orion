/**
 * metrics module index tests
 */

describe('metrics module exports', () => {
  it('should export MetricsRepository', async () => {
    const mod = await import('../index');
    expect(mod.MetricsRepository).toBeDefined();
    expect(typeof mod.MetricsRepository).toBe('function');
  });

  it('should export MetricsService', async () => {
    const mod = await import('../index');
    expect(mod.MetricsService).toBeDefined();
    expect(typeof mod.MetricsService).toBe('function');
  });

  it('should be able to instantiate MetricsRepository', async () => {
    const { MetricsRepository } = await import('../index');
    const repo = new MetricsRepository();
    expect(repo).toBeDefined();
    expect(repo.constructor.name).toBe('MetricsRepository');
  });

  it('should be able to instantiate MetricsService', async () => {
    const { MetricsService } = await import('../index');
    const service = new MetricsService();
    expect(service).toBeDefined();
    expect(service.constructor.name).toBe('MetricsService');
  });
});
