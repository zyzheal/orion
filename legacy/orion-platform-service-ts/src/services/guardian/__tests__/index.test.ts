/**
 * Guardian module export verification tests
 */
describe('Guardian module exports', () => {
  it('should export ExecutionGuardian', async () => {
    const mod = await import('../index');
    expect(mod.ExecutionGuardian).toBeDefined();
    expect(typeof mod.ExecutionGuardian).toBe('function');
  });

  it('should export DEFAULT_GUARDIAN_CONFIG', async () => {
    const mod = await import('../index');
    expect(mod.DEFAULT_GUARDIAN_CONFIG).toBeDefined();
    expect(typeof mod.DEFAULT_GUARDIAN_CONFIG).toBe('object');
  });

  it('should export HeartbeatWatchdog', async () => {
    const mod = await import('../index');
    expect(mod.HeartbeatWatchdog).toBeDefined();
    expect(typeof mod.HeartbeatWatchdog).toBe('function');
  });

  it('should export ProcessKiller', async () => {
    const mod = await import('../index');
    expect(mod.ProcessKiller).toBeDefined();
    expect(typeof mod.ProcessKiller).toBe('function');
  });
});
