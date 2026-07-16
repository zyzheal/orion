/**
 * FinOps module export verification tests
 */
describe('FinOps module exports', () => {
  it('should export FinOpsRepository', async () => {
    const mod = await import('../index');
    expect(mod.FinOpsRepository).toBeDefined();
    expect(typeof mod.FinOpsRepository).toBe('function');
  });

  it('should export FinOpsService', async () => {
    const mod = await import('../index');
    expect(mod.FinOpsService).toBeDefined();
    expect(typeof mod.FinOpsService).toBe('function');
  });

  it('should export FinOpsServiceError', async () => {
    const mod = await import('../index');
    expect(mod.FinOpsServiceError).toBeDefined();
    expect(typeof mod.FinOpsServiceError).toBe('function');
  });

  it('should export CloudCostCollector', async () => {
    const mod = await import('../index');
    expect(mod.CloudCostCollector).toBeDefined();
    expect(typeof mod.CloudCostCollector).toBe('function');
  });

  it('should export K8sCostAllocator', async () => {
    const mod = await import('../index');
    expect(mod.K8sCostAllocator).toBeDefined();
    expect(typeof mod.K8sCostAllocator).toBe('function');
  });

  it('should export SaaSCostTracker', async () => {
    const mod = await import('../index');
    expect(mod.SaaSCostTracker).toBeDefined();
    expect(typeof mod.SaaSCostTracker).toBe('function');
  });

  it('should export CostEventPublisher', async () => {
    const mod = await import('../index');
    expect(mod.CostEventPublisher).toBeDefined();
    expect(typeof mod.CostEventPublisher).toBe('function');
  });

  it('should export CostService', async () => {
    const mod = await import('../index');
    expect(mod.CostService).toBeDefined();
    expect(typeof mod.CostService).toBe('function');
  });

  it('should export CostTrackingService', async () => {
    const mod = await import('../index');
    expect(mod.CostTrackingService).toBeDefined();
    expect(typeof mod.CostTrackingService).toBe('function');
  });

  it('should export ROIAnalyzer', async () => {
    const mod = await import('../index');
    expect(mod.ROIAnalyzer).toBeDefined();
    expect(typeof mod.ROIAnalyzer).toBe('function');
  });

  it('should export BudgetService', async () => {
    const mod = await import('../index');
    expect(mod.BudgetService).toBeDefined();
    expect(typeof mod.BudgetService).toBe('function');
  });

  it('should export CostOptimizer', async () => {
    const mod = await import('../index');
    expect(mod.CostOptimizer).toBeDefined();
    expect(typeof mod.CostOptimizer).toBe('function');
  });
});
