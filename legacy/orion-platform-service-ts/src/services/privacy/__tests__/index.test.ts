/**
 * Privacy module export verification tests
 */
describe('Privacy module exports', () => {
  it('should export SecretSanitizer', async () => {
    const mod = await import('../index');
    expect(mod.SecretSanitizer).toBeDefined();
    expect(typeof mod.SecretSanitizer).toBe('function');
  });

  it('should export PIISanitizer', async () => {
    const mod = await import('../index');
    expect(mod.PIISanitizer).toBeDefined();
    expect(typeof mod.PIISanitizer).toBe('function');
  });

  it('should export NERModelService', async () => {
    const mod = await import('../index');
    expect(mod.NERModelService).toBeDefined();
    expect(typeof mod.NERModelService).toBe('function');
  });

  it('should export TenantPrivacyPolicyService', async () => {
    const mod = await import('../index');
    expect(mod.TenantPrivacyPolicyService).toBeDefined();
    expect(typeof mod.TenantPrivacyPolicyService).toBe('function');
  });
});
