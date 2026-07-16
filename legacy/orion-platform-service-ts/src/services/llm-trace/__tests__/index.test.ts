/**
 * LLM Trace module export verification tests
 */
describe('LLM Trace module exports', () => {
  it('should export LLMTraceService', async () => {
    const mod = await import('../index');
    expect(mod.LLMTraceService).toBeDefined();
    expect(typeof mod.LLMTraceService).toBe('function');
  });

  it('should export MODEL_PRICING', async () => {
    const mod = await import('../index');
    expect(mod.MODEL_PRICING).toBeDefined();
    expect(typeof mod.MODEL_PRICING).toBe('object');
  });

  it('should export TokenCounter', async () => {
    const mod = await import('../index');
    expect(mod.TokenCounter).toBeDefined();
    expect(typeof mod.TokenCounter).toBe('function');
  });

  it('should export CostCalculator', async () => {
    const mod = await import('../index');
    expect(mod.CostCalculator).toBeDefined();
    expect(typeof mod.CostCalculator).toBe('function');
  });
});
