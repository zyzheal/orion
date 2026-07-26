/**
 * TenantContext - Simplified stub for ChatOps service
 *
 * Provides basic tenant context without full RLS integration.
 */

class TenantContext {
  private currentTenantId: number | null = null;
  private enabled: boolean = false;

  getCurrentTenantId(): number | null {
    return this.currentTenantId;
  }

  setCurrentTenantId(tenantId: number | null): void {
    this.currentTenantId = tenantId;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  validateResourceTenant(resourceTenantId: number): boolean {
    if (!this.currentTenantId) return true;
    return resourceTenantId === this.currentTenantId;
  }
}

export const tenantContext = new TenantContext();
