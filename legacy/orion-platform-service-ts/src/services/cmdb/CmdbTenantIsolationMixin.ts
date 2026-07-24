/**
 * CMDB Tenant Isolation Mixin
 *
 * Provides utilities for enforcing tenant isolation in CMDB operations.
 * Ensures that CI data from different tenants is properly separated
 * and cross-tenant access is blocked.
 */

import { CI, CIRelation } from './CmdbTypes';
import { OrionError, ErrorCode } from '../../errors';

/**
 * CMDB Tenant Isolation Mixin
 *
 * Static utility class for tenant isolation operations:
 * - Assert CI belongs to tenant
 * - Filter CI lists by tenant
 * - Get all CIs for a specific tenant
 */
export class CmdbTenantIsolationMixin {
  /**
   * Assert that a CI belongs to the specified tenant.
   * Throws FORBIDDEN error if tenant mismatch detected.
   *
   * @param ci - The CI to verify
   * @param tenantId - The expected tenant ID
   * @throws OrionError with ErrorCode.FORBIDDEN if CI does not belong to tenant
   */
  static assertTenantAccess(ci: CI, tenantId: bigint): void {
    if (ci.tenantId !== tenantId) {
      throw new OrionError(
        `CI '${ci.ciId}' does not belong to tenant ${tenantId} (actual: ${ci.tenantId})`,
        ErrorCode.FORBIDDEN,
      );
    }
  }

  /**
   * Filter a list of CIs to only include those belonging to the specified tenant.
   *
   * @param cis - Array of CIs to filter
   * @param tenantId - The tenant ID to filter by
   * @returns Filtered array containing only CIs for the specified tenant
   */
  static filterByTenant(cis: CI[], tenantId: bigint): CI[] {
    return cis.filter(ci => ci.tenantId === tenantId);
  }

  /**
   * Get all CIs belonging to a specific tenant from a list.
   * Alias for filterByTenant with more explicit naming.
   *
   * @param cis - Array of CIs to search
   * @param tenantId - The tenant ID to filter by
   * @returns Array of CIs for the specified tenant
   */
  static getTenantCis(cis: CI[], tenantId: bigint): CI[] {
    return this.filterByTenant(cis, tenantId);
  }

  /**
   * Verify that a CI list contains only CIs from the specified tenant.
   * Throws if any CI belongs to a different tenant.
   *
   * @param cis - Array of CIs to verify
   * @param tenantId - The expected tenant ID
   * @throws OrionError with ErrorCode.FORBIDDEN if any CI belongs to a different tenant
   */
  static verifyTenantIsolation(cis: CI[], tenantId: bigint): void {
    for (const ci of cis) {
      this.assertTenantAccess(ci, tenantId);
    }
  }

  /**
   * Verify tenant isolation for a relation.
   * Both source and target CIs must belong to the same tenant.
   *
   * @param fromCI - Source CI
   * @param toCI - Target CI
   * @param tenantId - The expected tenant ID
   * @throws OrionError with ErrorCode.FORBIDDEN if either CI belongs to a different tenant
   */
  static assertRelationTenantAccess(fromCI: CI, toCI: CI, tenantId: bigint): void {
    this.assertTenantAccess(fromCI, tenantId);
    this.assertTenantAccess(toCI, tenantId);
  }

  /**
   * Filter relations by tenant.
   * Checks that both fromCi and toCi belong to the specified tenant.
   *
   * @param relations - Array of relations to filter
   * @param tenantCis - Map of CI IDs to CIs for the tenant
   * @returns Filtered relations where both endpoints belong to the tenant
   */
  static filterRelationsByTenant(relations: CIRelation[], tenantCis: Map<string, CI>): CIRelation[] {
    return relations.filter(relation => {
      const fromCI = tenantCis.get(relation.fromCiId);
      const toCI = tenantCis.get(relation.toCiId);
      return fromCI !== undefined && toCI !== undefined;
    });
  }
}
