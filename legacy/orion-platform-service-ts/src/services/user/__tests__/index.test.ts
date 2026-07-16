/**
 * User module export verification tests
 */
describe('User module exports', () => {
  it('should export UserRepository', async () => {
    const mod = await import('../index');
    expect(mod.UserRepository).toBeDefined();
    expect(typeof mod.UserRepository).toBe('function');
  });

  it('should export UserService', async () => {
    const mod = await import('../index');
    expect(mod.UserService).toBeDefined();
    expect(typeof mod.UserService).toBe('function');
  });

  it('should export UserServiceError', async () => {
    const mod = await import('../index');
    expect(mod.UserServiceError).toBeDefined();
    expect(typeof mod.UserServiceError).toBe('function');
  });

  it('should export UserTokenService', async () => {
    const mod = await import('../index');
    expect(mod.UserTokenService).toBeDefined();
    expect(typeof mod.UserTokenService).toBe('function');
  });

  it('should export UserTokenServiceError', async () => {
    const mod = await import('../index');
    expect(mod.UserTokenServiceError).toBeDefined();
    expect(typeof mod.UserTokenServiceError).toBe('function');
  });

  it('should be importable without errors', async () => {
    const mod = await import('../index');
    expect(mod).toBeDefined();
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
