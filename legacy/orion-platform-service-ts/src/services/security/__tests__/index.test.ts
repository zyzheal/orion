/**
 * Security module export verification tests
 */
describe('Security module exports', () => {
  it('should export SecurityScannerService', async () => {
    const mod = await import('../index');
    expect(mod.SecurityScannerService).toBeDefined();
    expect(typeof mod.SecurityScannerService).toBe('function');
  });

  it('should export SecretSanitizer (re-export from privacy)', async () => {
    const mod = await import('../index');
    expect(mod.SecretSanitizer).toBeDefined();
    expect(typeof mod.SecretSanitizer).toBe('function');
  });

  it('should not export ComplianceFrameworkService (merged into compliance/ComplianceService)', async () => {
    const mod = await import('../index');
    expect(mod.ComplianceFrameworkService).toBeUndefined();
  });

  it('should export SecurityAuditService', async () => {
    const mod = await import('../index');
    expect(mod.SecurityAuditService).toBeDefined();
    expect(typeof mod.SecurityAuditService).toBe('function');
  });

  it('should export SupplyChainService', async () => {
    const mod = await import('../index');
    expect(mod.SupplyChainService).toBeDefined();
    expect(typeof mod.SupplyChainService).toBe('function');
  });
});
