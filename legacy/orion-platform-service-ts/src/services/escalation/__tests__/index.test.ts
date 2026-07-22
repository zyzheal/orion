/**
 * Escalation module export verification tests
 */
describe('Escalation module exports', () => {
  it('should export EscalationConfigService', async () => {
    const mod = await import('../index');
    expect(mod.EscalationConfigService).toBeDefined();
    expect(typeof mod.EscalationConfigService).toBe('function');
  });

  it('should export escalationConfigService singleton', async () => {
    const mod = await import('../index');
    expect(mod.escalationConfigService).toBeDefined();
  });

  it('should export EscalationScheduler', async () => {
    const mod = await import('../index');
    expect(mod.EscalationScheduler).toBeDefined();
    expect(typeof mod.EscalationScheduler).toBe('function');
  });

  it('should export escalationScheduler singleton', async () => {
    const mod = await import('../index');
    expect(mod.escalationScheduler).toBeDefined();
  });

  it('should be importable without errors', async () => {
    const mod = await import('../index');
    expect(mod).toBeDefined();
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
