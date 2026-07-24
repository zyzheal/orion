/**
 * Backup module export verification tests
 */
describe('Backup module exports', () => {
  it('should export BackupRepository', async () => {
    const mod = await import('../index');
    expect(mod.BackupRepository).toBeDefined();
    expect(typeof mod.BackupRepository).toBe('function');
  });

  it('should export BackupPlanRepository', async () => {
    const mod = await import('../index');
    expect(mod.BackupPlanRepository).toBeDefined();
    expect(typeof mod.BackupPlanRepository).toBe('function');
  });

  it('should export RecoveryRepository', async () => {
    const mod = await import('../index');
    expect(mod.RecoveryRepository).toBeDefined();
    expect(typeof mod.RecoveryRepository).toBe('function');
  });

  it('should export BackupService', async () => {
    const mod = await import('../index');
    expect(mod.BackupService).toBeDefined();
    expect(typeof mod.BackupService).toBe('function');
  });

  it('should export BackupServiceError', async () => {
    const mod = await import('../index');
    expect(mod.BackupServiceError).toBeDefined();
    expect(typeof mod.BackupServiceError).toBe('function');
  });

  it('should export BackupScheduler', async () => {
    const mod = await import('../index');
    expect(mod.BackupScheduler).toBeDefined();
    expect(typeof mod.BackupScheduler).toBe('function');
  });

  it('should export BackupStorage', async () => {
    const mod = await import('../index');
    expect(mod.BackupStorage).toBeDefined();
    expect(typeof mod.BackupStorage).toBe('function');
  });

  it('should export BackupVerifier', async () => {
    const mod = await import('../index');
    expect(mod.BackupVerifier).toBeDefined();
    expect(typeof mod.BackupVerifier).toBe('function');
  });

  it('should export RecoveryService', async () => {
    const mod = await import('../index');
    expect(mod.RecoveryService).toBeDefined();
    expect(typeof mod.RecoveryService).toBe('function');
  });

  it('should export getNextCronTime', async () => {
    const mod = await import('../index');
    expect(mod.getNextCronTime).toBeDefined();
    expect(typeof mod.getNextCronTime).toBe('function');
  });
});
