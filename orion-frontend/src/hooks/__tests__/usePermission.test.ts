import { describe, it, expect } from 'vitest';
import { ROLE_PERMISSIONS, checkPermission } from '../usePermission';

// PERM-6 conservative slice: security_admin gains ai:read + ai-security:* +
// ai-review:* and nothing else. The test asserts the exact three strings
// are present, and that the umbrella `ai` resource is still read-only for
// this role (no write/execute/delete/admin).
describe('PERM-6 security_admin AI permissions', () => {
  const perms = ROLE_PERMISSIONS['security_admin'];

  it('grants ai:read', () => {
    expect(perms).toContain('ai:read');
  });

  it('grants ai-security:*', () => {
    expect(perms).toContain('ai-security:*');
  });

  it('grants ai-review:*', () => {
    expect(perms).toContain('ai-review:*');
  });

  it.each(['write', 'execute', 'delete', 'admin'])(
    'does NOT grant ai:%s (conservative scope)',
    (action) => {
      expect(perms).not.toContain(`ai:${action}`);
    }
  );

  it('resolves ai:read via checkPermission for security_admin role', () => {
    expect(checkPermission(['security_admin'], 'ai', 'read')).toBe(true);
  });

  it('resolves ai-security:write via wildcard for security_admin role', () => {
    expect(checkPermission(['security_admin'], 'ai-security', 'write')).toBe(true);
  });

  it('resolves ai-review:delete via wildcard for security_admin role', () => {
    expect(checkPermission(['security_admin'], 'ai-review', 'delete')).toBe(true);
  });

  it('does NOT resolve ai:execute for security_admin', () => {
    expect(checkPermission(['security_admin'], 'ai', 'execute')).toBe(false);
  });
});
