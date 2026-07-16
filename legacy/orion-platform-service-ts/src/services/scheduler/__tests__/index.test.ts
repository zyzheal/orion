/**
 * Scheduler module export verification tests
 */
describe('Scheduler module exports', () => {
  it('should export CronSchedulerService', async () => {
    const mod = await import('../index');
    expect(mod.CronSchedulerService).toBeDefined();
    expect(typeof mod.CronSchedulerService).toBe('function');
  });

  it('should export DistributedLockService', async () => {
    const mod = await import('../index');
    expect(mod.DistributedLockService).toBeDefined();
    expect(typeof mod.DistributedLockService).toBe('function');
  });
});
