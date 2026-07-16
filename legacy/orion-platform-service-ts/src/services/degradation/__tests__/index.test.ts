/**
 * Degradation module export verification tests
 */
describe('Degradation module exports', () => {
  it('should export AutoRecoveryService', async () => {
    const mod = await import('../index');
    expect(mod.AutoRecoveryService).toBeDefined();
    expect(typeof mod.AutoRecoveryService).toBe('function');
  });
});
