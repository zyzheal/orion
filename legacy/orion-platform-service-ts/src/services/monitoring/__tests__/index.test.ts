/**
 * Monitoring module export verification tests
 */
describe('Monitoring module exports', () => {
  it('should export MonitoringRepository', async () => {
    const mod = await import('../index');
    expect(mod.MonitoringRepository).toBeDefined();
    expect(typeof mod.MonitoringRepository).toBe('function');
  });

  it('should export MonitoringService', async () => {
    const mod = await import('../index');
    expect(mod.MonitoringService).toBeDefined();
    expect(typeof mod.MonitoringService).toBe('function');
  });

  it('should export MonitoringServiceError', async () => {
    const mod = await import('../index');
    expect(mod.MonitoringServiceError).toBeDefined();
    expect(typeof mod.MonitoringServiceError).toBe('function');
  });

  it('should export MetricCollector', async () => {
    const mod = await import('../index');
    expect(mod.MetricCollector).toBeDefined();
    expect(typeof mod.MetricCollector).toBe('function');
  });

  it('should export AlertRuleEngine', async () => {
    const mod = await import('../index');
    expect(mod.AlertRuleEngine).toBeDefined();
    expect(typeof mod.AlertRuleEngine).toBe('function');
  });

  it('should export AlertNotificationService', async () => {
    const mod = await import('../index');
    expect(mod.AlertNotificationService).toBeDefined();
    expect(typeof mod.AlertNotificationService).toBe('function');
  });

  it('should export MonitoringDashboard', async () => {
    const mod = await import('../index');
    expect(mod.MonitoringDashboard).toBeDefined();
    expect(typeof mod.MonitoringDashboard).toBe('function');
  });

  it('should export PostgresMetricStorageRepository', async () => {
    const mod = await import('../index');
    expect(mod.PostgresMetricStorageRepository).toBeDefined();
    expect(typeof mod.PostgresMetricStorageRepository).toBe('function');
  });
});
