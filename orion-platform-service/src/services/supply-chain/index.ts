/**
 * Supply Chain Security Module
 *
 * Provides unified supply chain security capabilities:
 * - SupplyChainService: Dependency analysis, SBOM generation, compliance checking
 * - SbomService: Unified vulnerability fetching (NVD/OSV) with 30min TTL cache
 *
 * Integration with existing modules:
 * - Wraps VulnerabilityDatabaseClient (sbom/VulnerabilityDatabaseClient.ts)
 * - Unifies SbomVulnerabilityService (sbom/SbomVulnerabilityService.ts)
 */

export { SupplyChainService } from './SupplyChainService';
export { SbomService } from './SbomService';

export type {
  // Core types
  SBOMComponent,
  SBOM,
  LicenseInfo,
  DependencyNode,
  DependencyTree,
  VulnerabilityReport,
  // Compliance types
  CompliancePolicy,
  ComplianceResult,
  ComplianceViolation,
  // Report types
  SupplyChainReport,
  PackageJsonInput,
} from './types';
