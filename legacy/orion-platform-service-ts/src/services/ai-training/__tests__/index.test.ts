/**
 * ai-training module index tests
 */

describe('ai-training module exports', () => {
  it('should export DualEngineRepository', async () => {
    const mod = await import('../index');
    expect(mod.DualEngineRepository).toBeDefined();
    expect(typeof mod.DualEngineRepository).toBe('function');
  });

  it('should export DualEngineService', async () => {
    const mod = await import('../index');
    expect(mod.DualEngineService).toBeDefined();
    expect(typeof mod.DualEngineService).toBe('function');
  });

  it('should be able to instantiate DualEngineRepository', async () => {
    const { DualEngineRepository } = await import('../index');
    const repo = new DualEngineRepository();
    expect(repo).toBeDefined();
    expect(repo.constructor.name).toBe('DualEngineRepository');
  });

  it('should be able to instantiate DualEngineService', async () => {
    const { DualEngineService } = await import('../index');
    const service = new DualEngineService();
    expect(service).toBeDefined();
    expect(service.constructor.name).toBe('DualEngineService');
  });
});
