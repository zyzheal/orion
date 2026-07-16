/**
 * Config Management module export verification tests
 */
describe('Config Management module exports', () => {
  it('should export ConfigRepository', async () => {
    const mod = await import('../index');
    expect(mod.ConfigRepository).toBeDefined();
    expect(typeof mod.ConfigRepository).toBe('function');
  });

  it('should export ConfigService', async () => {
    const mod = await import('../index');
    expect(mod.ConfigService).toBeDefined();
    expect(typeof mod.ConfigService).toBe('function');
  });

  it('should export ConfigServiceError', async () => {
    const mod = await import('../index');
    expect(mod.ConfigServiceError).toBeDefined();
    expect(typeof mod.ConfigServiceError).toBe('function');
  });

  it('should export ConfigApprovalService', async () => {
    const mod = await import('../index');
    expect(mod.ConfigApprovalService).toBeDefined();
    expect(typeof mod.ConfigApprovalService).toBe('function');
  });

  it('should export ConfigDiffService', async () => {
    const mod = await import('../index');
    expect(mod.ConfigDiffService).toBeDefined();
    expect(typeof mod.ConfigDiffService).toBe('function');
  });

  it('should export GitOpsService', async () => {
    const mod = await import('../index');
    expect(mod.GitOpsService).toBeDefined();
    expect(typeof mod.GitOpsService).toBe('function');
  });

  it('should export ConfigChangeService', async () => {
    const mod = await import('../index');
    expect(mod.ConfigChangeService).toBeDefined();
    expect(typeof mod.ConfigChangeService).toBe('function');
  });

  it('should export ConfigDriftDetector', async () => {
    const mod = await import('../index');
    expect(mod.ConfigDriftDetector).toBeDefined();
    expect(typeof mod.ConfigDriftDetector).toBe('function');
  });

  it('should be importable without errors', async () => {
    const mod = await import('../index');
    expect(mod).toBeDefined();
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
