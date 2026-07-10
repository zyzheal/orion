/**
 * SbomService - 统一 SBOM 服务 (Facade)
 *
 * 按职责拆分为三个子服务:
 * - SbomGenerator: SBOM 生成/持久化/签名/报告查询
 * - ComponentAnalyzer: 漏洞查询/缓存/npm 依赖分析
 * - LicenseChecker: 合规检查/投毒检测/安全评分
 *
 * 保持原有公开 API 不变，所有调用委托给子服务。
 */

import { DatabasePool } from '../database';
import { VulnerabilityDatabaseClient } from '../sbom/VulnerabilityDatabaseClient';
import { VulnerabilityCache } from '../sbom/VulnerabilityCache';
import { OrionError, ErrorCode } from '../../errors';
import { createLogger } from '../../utils/logger';

import { SbomGenerator } from './SbomGenerator';
import { ComponentAnalyzer } from './ComponentAnalyzer';
import { LicenseChecker } from './LicenseChecker';

// Re-export types for backward compatibility
export type {
  VulnerabilityReport,
  SBOMComponent,
  SBOM,
  LicenseInfo,
  DependencyTree,
  DependencyNode,
  ComplianceResult,
  ComplianceViolation,
  CompliancePolicy,
  SupplyChainReport,
  PackageJsonInput,
} from './types';

// Re-export CycloneDX types used by consumers
export type { CycloneDXComponent, CycloneDXSBOM, SBOMInput, DependencyAnalysisInput } from './SbomService-types';

// Re-export poisoning detection types
export type {
  MaliciousPackageInfo,
  TyposquattingAlert,
  DependencyPoisoningReport,
} from './SbomService';

// Re-export SbomServiceError for backward compatibility
export class SbomServiceError extends Error {
  constructor(message?: string) { super(message); this.name = 'SbomServiceError'; }
}

const logger = createLogger('supply-chain-sbom');

const DEFAULT_CACHE_TTL_MS = 30 * 60 * 1000;
const DEFAULT_CACHE_MAX_ENTRIES = 1000;

// ==================== SbomService (Facade) ====================

export class SbomService {
  private componentAnalyzer: ComponentAnalyzer;
  private sbomGenerator: SbomGenerator;
  private licenseChecker: LicenseChecker;
  private db?: DatabasePool;

  constructor(
    db?: DatabasePool,
    options?: { nvdApiKey?: string; cacheTtlMs?: number; cacheMaxEntries?: number },
  ) {
    this.db = db;
    this.componentAnalyzer = new ComponentAnalyzer(options);
    this.sbomGenerator = new SbomGenerator(db);
    this.licenseChecker = new LicenseChecker(db);
  }

  // ==================== Vulnerability Fetching ====================

  async fetchVulnerabilities(component: {
    name: string;
    version: string;
    ecosystem?: string;
  }): Promise<import('./types').VulnerabilityReport> {
    return this.componentAnalyzer.fetchVulnerabilities(component);
  }

  async getCachedVulnerabilities(component: {
    name: string;
    version: string;
    ecosystem?: string;
  }): Promise<import('./types').VulnerabilityReport> {
    return this.componentAnalyzer.getCachedVulnerabilities(component);
  }

  // ==================== Cache Management ====================

  async warmupCache(components: Array<{ name: string; version: string; ecosystem?: string }>): Promise<void> {
    return this.componentAnalyzer.warmupCache(components);
  }

  getCacheStats() {
    return this.componentAnalyzer.getCacheStats();
  }

  cleanupExpiredCache(): number {
    return this.componentAnalyzer.cleanupExpiredCache();
  }

  clearCache(): void {
    this.componentAnalyzer.clearCache();
  }

  // ==================== SBOM Generation & Persistence ====================

  async generateSBOM(tenantId: string, input: import('./SbomService').SBOMInput): Promise<any> {
    const vulnerabilities = this.componentAnalyzer.analyzeVulnerabilities(input.components || []);
    return this.sbomGenerator.generateSBOM(tenantId, input, vulnerabilities);
  }

  async exportSBOM(sbomId: string, tenantId?: string): Promise<object | null> {
    return this.sbomGenerator.exportSBOM(sbomId, tenantId);
  }

  async getSBOM(sbomId: string, tenantId?: string): Promise<any | null> {
    return this.sbomGenerator.getSBOM(sbomId, tenantId);
  }

  // ==================== Dependency Analysis ====================

  async analyzeDependencies(tenantId: string, input: import('./SbomService').DependencyAnalysisInput): Promise<any> {
    return this.componentAnalyzer.analyzeDependencies(tenantId, input, this.db);
  }

  // ==================== Compliance Check ====================

  async checkCompliance(sbom: any, policy?: import('./types').CompliancePolicy): Promise<import('./types').ComplianceResult> {
    return this.licenseChecker.checkCompliance(sbom, policy);
  }

  // ==================== Artifact Signature ====================

  async persistArtifactSignature(
    tenantId: string,
    artifactId: string,
    signature: string,
    signedBy: string,
    signatureType = 'sha256',
  ): Promise<any> {
    return this.sbomGenerator.persistArtifactSignature(tenantId, artifactId, signature, signedBy, signatureType);
  }

  async verifySignature(artifactId: string, signature: string): Promise<any> {
    return this.sbomGenerator.verifySignature(artifactId, signature);
  }

  // ==================== Supply Chain Report ====================

  async getSupplyChainReport(tenantId: string, pipelineId?: string): Promise<{
    totalSboms: number;
    totalSignatures: number;
    verifiedSignatures: number;
    totalVulnerabilities: number;
  }> {
    return this.sbomGenerator.getSupplyChainReport(tenantId, pipelineId);
  }

  // ==================== Dependency Poisoning Detection ====================

  detectMaliciousPackages(
    packages: { name: string; version?: string }[],
  ): { package: string; version: string; info: import('./SbomService').MaliciousPackageInfo }[] {
    return this.licenseChecker.detectMaliciousPackages(packages);
  }

  detectTyposquatting(packageNames: string[]): import('./SbomService').TyposquattingAlert[] {
    return this.licenseChecker.detectTyposquatting(packageNames);
  }

  async scanDependencyPoisoning(
    tenantId: string,
    packages: { name: string; version?: string }[],
  ): Promise<import('./types').DependencyPoisoningReport> {
    return this.licenseChecker.scanDependencyPoisoning(tenantId, packages);
  }

  // ==================== Security Score Dashboard ====================

  async getSecurityScoreDashboard(tenantId: string): Promise<any> {
    return this.licenseChecker.getSecurityScoreDashboard(tenantId);
  }
}
