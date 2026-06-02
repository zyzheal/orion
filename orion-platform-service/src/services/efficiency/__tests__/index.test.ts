/**
 * Efficiency module export verification tests
 */
describe('Efficiency module exports', () => {
  it('should export DoraMetricsService', async () => {
    const mod = await import('../index');
    expect(mod.DoraMetricsService).toBeDefined();
    expect(typeof mod.DoraMetricsService).toBe('function');
  });

  it('should export DORACalculator', async () => {
    const mod = await import('../index');
    expect(mod.DORACalculator).toBeDefined();
    expect(typeof mod.DORACalculator).toBe('function');
  });

  it('should export WeeklyReportService', async () => {
    const mod = await import('../index');
    expect(mod.WeeklyReportService).toBeDefined();
    expect(typeof mod.WeeklyReportService).toBe('function');
  });

  it('should export ClickHouseSync', async () => {
    const mod = await import('../index');
    expect(mod.ClickHouseSync).toBeDefined();
    expect(typeof mod.ClickHouseSync).toBe('function');
  });

  it('should export EfficiencyEventHandler', async () => {
    const mod = await import('../index');
    expect(mod.EfficiencyEventHandler).toBeDefined();
    expect(typeof mod.EfficiencyEventHandler).toBe('function');
  });

  it('should export InMemoryLocalStorage', async () => {
    const mod = await import('../index');
    expect(mod.InMemoryLocalStorage).toBeDefined();
    expect(typeof mod.InMemoryLocalStorage).toBe('function');
  });

  it('should export EfficiencyReportService', async () => {
    const mod = await import('../index');
    expect(mod.EfficiencyReportService).toBeDefined();
    expect(typeof mod.EfficiencyReportService).toBe('function');
  });
});
