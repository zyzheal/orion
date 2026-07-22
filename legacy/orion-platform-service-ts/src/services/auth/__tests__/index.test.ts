/**
 * Auth module export verification tests
 */

// Mock openid-client (ESM-only package)
jest.mock('openid-client', () => ({
  discovery: jest.fn(),
  buildAuthorizationUrl: jest.fn(),
  authorizationCodeGrant: jest.fn(),
  randomNonce: jest.fn().mockReturnValue('test-nonce'),
  randomState: jest.fn().mockReturnValue('test-state'),
  ClientSecretPost: jest.fn().mockReturnValue(() => 'client-auth'),
}));

// Mock SsoStateRepository
jest.mock('../../../repositories/SsoStateRepository', () => ({
  SsoStateRepository: jest.fn().mockImplementation(() => ({
    create: jest.fn(),
    findByState: jest.fn(),
    deleteByState: jest.fn(),
  })),
}));

describe('Auth module exports', () => {
  it('should export JwtKeyRotationService', async () => {
    const mod = await import('../index');
    expect(mod.JwtKeyRotationService).toBeDefined();
    expect(typeof mod.JwtKeyRotationService).toBe('function');
  });

  it('should export TokenBlacklistService', async () => {
    const mod = await import('../index');
    expect(mod.TokenBlacklistService).toBeDefined();
    expect(typeof mod.TokenBlacklistService).toBe('function');
  });

  it('should export K8sSecretKeyStorage', async () => {
    const mod = await import('../index');
    expect(mod.K8sSecretKeyStorage).toBeDefined();
    expect(typeof mod.K8sSecretKeyStorage).toBe('function');
  });

  it('should export k8sSecretStorage singleton', async () => {
    const mod = await import('../index');
    expect(mod.k8sSecretStorage).toBeDefined();
  });

  it('should export SsoService', async () => {
    const mod = await import('../index');
    expect(mod.SsoService).toBeDefined();
    expect(typeof mod.SsoService).toBe('function');
  });

  it('should export LdapService', async () => {
    const mod = await import('../index');
    expect(mod.LdapService).toBeDefined();
    expect(typeof mod.LdapService).toBe('function');
  });

  it('should export ldapService singleton', async () => {
    const mod = await import('../index');
    expect(mod.ldapService).toBeDefined();
  });

  it('should export WechatWorkService', async () => {
    const mod = await import('../index');
    expect(mod.WechatWorkService).toBeDefined();
    expect(typeof mod.WechatWorkService).toBe('function');
  });

  it('should export wechatWorkService singleton', async () => {
    const mod = await import('../index');
    expect(mod.wechatWorkService).toBeDefined();
  });

  it('should export JwtKeyManager', async () => {
    const mod = await import('../index');
    expect(mod.JwtKeyManager).toBeDefined();
    expect(typeof mod.JwtKeyManager).toBe('function');
  });

  it('should export jwtKeyManager singleton', async () => {
    const mod = await import('../index');
    expect(mod.jwtKeyManager).toBeDefined();
  });

  it('should be importable without errors', async () => {
    const mod = await import('../index');
    expect(mod).toBeDefined();
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
