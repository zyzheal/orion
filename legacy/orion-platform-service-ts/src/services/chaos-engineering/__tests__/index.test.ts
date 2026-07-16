/**
 * Chaos Engineering module export verification tests
 */
describe('Chaos Engineering module exports', () => {
  it('should export ChaosExperimentService', async () => {
    const mod = await import('../index');
    expect(mod.ChaosExperimentService).toBeDefined();
    expect(typeof mod.ChaosExperimentService).toBe('function');
  });

  it('should export ChaosExperimentRepository', async () => {
    const mod = await import('../index');
    expect(mod.ChaosExperimentRepository).toBeDefined();
    expect(typeof mod.ChaosExperimentRepository).toBe('function');
  });

  it('should export ChaosExperimentServiceError', async () => {
    const mod = await import('../index');
    expect(mod.ChaosExperimentServiceError).toBeDefined();
    expect(typeof mod.ChaosExperimentServiceError).toBe('function');
  });

  it('should export FaultInjector', async () => {
    const mod = await import('../index');
    expect(mod.FaultInjector).toBeDefined();
    expect(typeof mod.FaultInjector).toBe('function');
  });

  it('should export FaultInjectorError', async () => {
    const mod = await import('../index');
    expect(mod.FaultInjectorError).toBeDefined();
    expect(typeof mod.FaultInjectorError).toBe('function');
  });

  it('should export ResilienceScoreCalculator', async () => {
    const mod = await import('../index');
    expect(mod.ResilienceScoreCalculator).toBeDefined();
    expect(typeof mod.ResilienceScoreCalculator).toBe('function');
  });

  it('should export ResilienceScoreRepository', async () => {
    const mod = await import('../index');
    expect(mod.ResilienceScoreRepository).toBeDefined();
    expect(typeof mod.ResilienceScoreRepository).toBe('function');
  });

  it('should export ResilienceScoreCalculatorError', async () => {
    const mod = await import('../index');
    expect(mod.ResilienceScoreCalculatorError).toBeDefined();
    expect(typeof mod.ResilienceScoreCalculatorError).toBe('function');
  });

  it('should export ResilienceScoringService', async () => {
    const mod = await import('../index');
    expect(mod.ResilienceScoringService).toBeDefined();
    expect(typeof mod.ResilienceScoringService).toBe('function');
  });
});
