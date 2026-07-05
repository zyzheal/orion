/**
 * SbomService - 统一 SBOM 服务
 *
 * 整合现有双 SBOM 实现:
 * - SbomVulnerabilityService (sbom/SbomVulnerabilityService.ts) — 侧重 SBOM 文档扫描
 * - VulnerabilityDatabaseClient (sbom/VulnerabilityDatabaseClient.ts) — 侧重实时漏洞数据库查询
 * - SupplyChainService (security/SupplyChainService.ts) — CycloneDX 生成 + npm 依赖解析 + 签名验证
 *
 * 本服务提供统一接口，底层使用 VulnerabilityDatabaseClient，并内置 30min TTL 缓存。
 * 同时整合 CycloneDX v1.4 生成、依赖链分析、签名验证等能力。
 */

import { DatabasePool } from '../database';
import { VulnerabilityDatabaseClient } from '../sbom/VulnerabilityDatabaseClient';
import { VulnerabilityCache } from '../sbom/VulnerabilityCache';
import { createLogger } from '../../utils/logger';
import { OrionError, ErrorCode } from '../../errors';

const logger = createLogger('supply-chain-sbom');

// Re-export types for convenience
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

// Local type imports for internal use
import type {
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

const DEFAULT_CACHE_TTL_MS = 30 * 60 * 1000; // 30 分钟
const DEFAULT_CACHE_MAX_ENTRIES = 1000;

// ==================== CycloneDX Types ====================

export interface CycloneDXComponent {
  type: 'library' | 'application' | 'framework' | 'container' | 'operating-system' | 'device' | 'file' | 'data';
  name: string;
  version: string;
  purl: string;
  'bom-ref': string;
  licenses?: { license: { id: string } }[];
  description?: string;
}

export interface CycloneDXSBOM {
  $schema: string;
  bomFormat: string;
  specVersion: string;
  serialNumber: string;
  version: number;
  metadata: {
    timestamp: string;
    tools: { name: string; vendor: string; version: string }[];
    component?: CycloneDXComponent;
  };
  components: CycloneDXComponent[];
  dependencies: { ref: string; dependsOn: string[] }[];
  vulnerabilities?: any[];
}

export interface SBOMInput {
  artifactId: string;
  pipelineId?: string;
  format?: string;
  version?: string;
  components: any[];
  dependencies?: any[];
}

export interface DependencyAnalysisInput {
  packageName: string;
  packageVersion: string;
  depth?: number;
}

// ==================== Dependency Poisoning Types ====================

export interface MaliciousPackageInfo {
  name: string;
  version?: string;
  reason: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  cve?: string;
  firstReported: string;
}

export interface TyposquattingAlert {
  suspicious: string;
  legitimate: string;
  similarity: number;
  type: 'typosquatting' | 'homograph' | 'combo' | 'namespace-squat';
}

export interface DependencyPoisoningReport {
  maliciousPackages: { package: string; version: string; info: MaliciousPackageInfo }[];
  typosquattingAlerts: TyposquattingAlert[];
  riskScore: number;
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  totalPackagesScanned: number;
  scanTimestamp: string;
}

// Known malicious packages database (subset for demonstration)
const KNOWN_MALICIOUS_PACKAGES: MaliciousPackageInfo[] = [
  { name: 'event-stream', version: '3.3.6', reason: 'Malicious code injecting Bitcoin theft', severity: 'critical', firstReported: '2018-11-21' },
  { name: 'ua-parser-js', version: '0.7.29', reason: 'Cryptominer injection', severity: 'critical', firstReported: '2021-03-13' },
  { name: 'coa', reason: 'Malware in compromised package', severity: 'high', firstReported: '2021-05-10' },
  { name: 'rc', reason: 'Malware in compromised package', severity: 'high', firstReported: '2021-05-10' },
  { name: 'colors', version: '1.4.2', reason: 'Infinite loop sabotage', severity: 'high', firstReported: '2022-01-09' },
  { name: 'faker', version: '6.6.6', reason: 'Infinite loop sabotage', severity: 'high', firstReported: '2022-01-09' },
  { name: 'node-ipc', version: '11.0.0', reason: 'Geofenced file destruction (Russia/Belarus)', severity: 'critical', firstReported: '2022-03-15' },
  { name: 'eslint-scope', version: '8.4.0', reason: 'Credential exfiltration via npm publish hijack', severity: 'critical', firstReported: '2024-07-12' },
  { name: 'cross-spawn', reason: 'Credential theft via compromised maintenance', severity: 'critical', firstReported: '2024-07-12' },
];

// Legitimate packages for typosquatting comparison
const POPULAR_PACKAGES = [
  'react', 'lodash', 'express', 'axios', 'moment', 'chalk', 'webpack',
  'babel', 'typescript', 'eslint', 'jest', 'node-fetch', 'dotenv',
  'uuid', 'cors', 'helmet', 'jsonwebtoken', 'bcrypt', 'pg', 'mysql',
  'mongoose', 'sequelize', 'redis', 'socket.io', 'fastify', 'koa',
  'next', 'vue', 'angular', 'svelte', 'tailwindcss',
];

// ==================== SbomService ====================

export class SbomService {
  private client: VulnerabilityDatabaseClient;
  private cache: VulnerabilityCache<VulnerabilityReport['vulnerabilities']>;
  private pool?: DatabasePool;
  private registryCache = new Map<string, any>();

  constructor(
    db?: DatabasePool,
    options?: { nvdApiKey?: string; cacheTtlMs?: number; cacheMaxEntries?: number },
  ) {
    this.pool = db;
    this.client = new VulnerabilityDatabaseClient({ nvdApiKey: options?.nvdApiKey });
    this.cache = new VulnerabilityCache<VulnerabilityReport['vulnerabilities']>({
      ttlMs: options?.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS,
      maxEntries: options?.cacheMaxEntries ?? DEFAULT_CACHE_MAX_ENTRIES,
    });
  }

  // ==================== Vulnerability Fetching ====================

  /**
   * 从 NVD/OSV 实时查询组件漏洞
   *
   * @param component - 组件信息 { name, version, ecosystem? }
   * @returns 漏洞报告
   */
  async fetchVulnerabilities(component: {
    name: string;
    version: string;
    ecosystem?: string;
  }): Promise<VulnerabilityReport> {
    const startTime = Date.now();
    const ecosystem = component.ecosystem ?? 'Maven';

    logger.info(
      { component: component.name, version: component.version, ecosystem },
      '[SbomService] Fetching vulnerabilities from external DB',
    );

    try {
      // 优先从 OSV 查询（更快的响应速度，支持包名匹配）
      const osvResult = await this.client.fetchFromOSV(component.name, component.version, ecosystem);

      // 如果 OSV 没有结果，回退到 NVD keyword search
      let vulnerabilities = osvResult.vulnerabilities;
      let source: 'nvd' | 'osv' = 'osv';

      if (vulnerabilities.length === 0) {
        logger.debug(
          { component: component.name, version: component.version },
          '[SbomService] OSV returned no results, falling back to NVD keyword search',
        );
        const nvdResult = await this.client.searchNVD(`${component.name} ${component.version}`, 20);
        vulnerabilities = nvdResult.vulnerabilities;
        source = 'nvd';
      }

      const report: VulnerabilityReport = {
        component: {
          name: component.name,
          version: component.version,
          ecosystem,
        },
        source,
        cached: false,
        vulnerabilities,
        queryTime: Date.now() - startTime,
        scannedAt: new Date(),
      };

      logger.info(
        { component: component.name, vulnCount: vulnerabilities.length, source, queryTime: report.queryTime },
        '[SbomService] Vulnerability fetch completed',
      );

      return report;
    } catch (error) {
      logger.error(
        { component: component.name, version: component.version, err: error instanceof Error ? error.message : String(error) },
        '[SbomService] Failed to fetch vulnerabilities',
      );
      throw new OrionError(
        `Failed to fetch vulnerabilities for ${component.name}`,
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        true,
        { component: component.name, version: component.version, originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  /**
   * 从缓存获取组件漏洞（30min TTL）
   *
   * @param component - 组件信息
   * @returns 漏洞报告（可能来自缓存）
   */
  async getCachedVulnerabilities(component: {
    name: string;
    version: string;
    ecosystem?: string;
  }): Promise<VulnerabilityReport> {
    const ecosystem = component.ecosystem ?? 'Maven';
    const cacheKey = VulnerabilityCache.buildKey('static', `${component.name}:${component.version}:${ecosystem}`);

    const cached = this.cache.get(cacheKey);
    if (cached) {
      logger.debug(
        { component: component.name, version: component.version, hits: cached.hits },
        '[SbomService] Returning cached vulnerability report',
      );

      return {
        component: {
          name: component.name,
          version: component.version,
          ecosystem,
        },
        source: cached.source as 'nvd' | 'osv' | 'static',
        cached: true,
        vulnerabilities: cached.value,
        queryTime: 0,
        scannedAt: new Date(cached.createdAt),
      };
    }

    // Cache miss - fetch from external DB
    const report = await this.fetchVulnerabilities(component);

    // Store in cache
    this.cache.set(
      cacheKey,
      report.vulnerabilities,
      report.source,
    );

    return report;
  }

  // ==================== Cache Management ====================

  /**
   * 预热缓存（批量预加载）
   */
  async warmupCache(components: Array<{ name: string; version: string; ecosystem?: string }>): Promise<void> {
    logger.info({ count: components.length }, '[SbomService] Warming up vulnerability cache');

    const entries = await Promise.all(
      components.map(async (component) => {
        const report = await this.fetchVulnerabilities(component);
        const ecosystem = component.ecosystem ?? 'Maven';
        const cacheKey = VulnerabilityCache.buildKey('static', `${component.name}:${component.version}:${ecosystem}`);

        return {
          key: cacheKey,
          value: report.vulnerabilities,
          source: report.source as 'nvd' | 'osv' | 'static',
        };
      }),
    );

    this.cache.warmup(entries);
    logger.info({ count: entries.length }, '[SbomService] Cache warmup completed');
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * 清理过期缓存条目
   */
  cleanupExpiredCache(): number {
    return this.cache.cleanupExpired();
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('[SbomService] Cache cleared');
  }

  // ==================== SBOM Generation & Persistence ====================

  /**
   * Generate SBOM (Software Bill of Materials) in CycloneDX v1.4 format.
   *
   * Stores the SBOM in the database and returns the persisted record.
   * The components are converted to CycloneDX format and stored as structured JSON.
   */
  async generateSBOM(tenantId: string, input: SBOMInput): Promise<any> {
    if (!this.pool) {
      throw new OrionError('Database pool not initialized', ErrorCode.SERVICE_UNAVAILABLE, true);
    }

    logger.info({ tenantId, artifactId: input.artifactId, format: input.format }, '[SbomService] Generating SBOM');

    // Convert components to CycloneDX format internally
    const cyclonedxComponents = (input.components || []).map((comp: any) =>
      this.buildCycloneDXComponent(comp),
    );

    // Build dependency relationships
    const dependencyRelationships = this.buildDependencyRelationships(
      input.components || [],
      input.dependencies || [],
    );

    // Analyze vulnerabilities
    const vulnerabilities = this.analyzeVulnerabilities(input.components);

    // Build the complete CycloneDX SBOM document
    const sbomDocument = this.buildCycloneDXSBOM(
      cyclonedxComponents,
      dependencyRelationships,
      vulnerabilities,
    );

    try {
      const result = await this.pool.query(
        `INSERT INTO supply_chain_sboms (tenant_id, artifact_id, pipeline_id, sbom_format, sbom_version, components, dependencies, vulnerabilities, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [
          tenantId,
          input.artifactId,
          input.pipelineId || null,
          input.format || 'cyclonedx',
          input.version || '1.4',
          JSON.stringify(cyclonedxComponents),
          JSON.stringify(dependencyRelationships),
          JSON.stringify(vulnerabilities),
          JSON.stringify({
            generatedAt: new Date().toISOString(),
            cyclonedxDocument: sbomDocument,
          }),
        ],
      );

      logger.info({ tenantId, sbomId: result.rows[0]?.id }, '[SbomService] SBOM generated and persisted');
      return result.rows[0];
    } catch (error) {
      logger.error(
        { tenantId, artifactId: input.artifactId, err: error instanceof Error ? error.message : String(error) },
        '[SbomService] Failed to persist SBOM',
      );
      throw new OrionError(
        'Failed to persist SBOM',
        ErrorCode.DATABASE_ERROR,
        true,
        { tenantId, artifactId: input.artifactId, originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  /**
   * Export an SBOM in CycloneDX JSON format.
   *
   * Retrieves the SBOM from the database and reconstructs a
   * standards-compliant CycloneDX v1.4 document.
   *
   * @param sbomId - The SBOM record ID
   * @param tenantId - Optional tenant ID for access control
   * @returns A CycloneDX SBOM JSON object, or null if not found
   */
  async exportSBOM(sbomId: string, tenantId?: string): Promise<object | null> {
    if (!this.pool) {
      throw new OrionError('Database pool not initialized', ErrorCode.SERVICE_UNAVAILABLE, true);
    }

    try {
      const record = tenantId
        ? await this.pool.query(
            `SELECT * FROM supply_chain_sboms WHERE id = $1 AND tenant_id = $2`,
            [sbomId, tenantId],
          )
        : await this.pool.query(
            `SELECT * FROM supply_chain_sboms WHERE id = $1`,
            [sbomId],
          );

      if (record.rows.length === 0) {
        return null;
      }

      const row = record.rows[0];

      // Parse stored JSON fields
      const components: CycloneDXComponent[] = typeof row.components === 'string'
        ? JSON.parse(row.components)
        : (row.components || []);

      const dependencies: { ref: string; dependsOn: string[] }[] = typeof row.dependencies === 'string'
        ? JSON.parse(row.dependencies)
        : (row.dependencies || []);

      const vulnerabilities: any[] = typeof row.vulnerabilities === 'string'
        ? JSON.parse(row.vulnerabilities)
        : (row.vulnerabilities || []);

      // Build the top-level component from the artifact
      const topLevelComponent: CycloneDXComponent = {
        type: 'application',
        name: row.artifact_id || 'unknown',
        version: row.sbom_version || '1.4',
        purl: `pkg:generic/${encodeURIComponent(row.artifact_id || 'unknown')}@${row.sbom_version || '1.4'}`,
        'bom-ref': `pkg:artifact/${encodeURIComponent(row.artifact_id || 'unknown')}`,
      };

      // Build the full CycloneDX document
      const sbom: CycloneDXSBOM = {
        $schema: 'http://cyclonedx.org/schema/bom-1.4.schema.json',
        bomFormat: 'CycloneDX',
        specVersion: '1.4',
        serialNumber: `urn:uuid:${this.generateUUID()}`,
        version: 1,
        metadata: {
          timestamp: row.metadata?.generatedAt || new Date().toISOString(),
          tools: [
            {
              name: '@orion/platform-service',
              vendor: 'Orion',
              version: '1.0.0',
            },
          ],
          component: topLevelComponent,
        },
        components,
        dependencies,
      };

      if (vulnerabilities.length > 0) {
        sbom.vulnerabilities = vulnerabilities;
      }

      return sbom;
    } catch (error) {
      logger.error(
        { sbomId, tenantId, err: error instanceof Error ? error.message : String(error) },
        '[SbomService] Failed to export SBOM',
      );
      throw new OrionError(
        'Failed to export SBOM',
        ErrorCode.DATABASE_ERROR,
        true,
        { sbomId, tenantId, originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  /**
   * Get SBOM by ID.
   */
  async getSBOM(sbomId: string, tenantId?: string): Promise<any | null> {
    if (!this.pool) {
      throw new OrionError('Database pool not initialized', ErrorCode.SERVICE_UNAVAILABLE, true);
    }

    try {
      const result = tenantId
        ? await this.pool.query(
            `SELECT * FROM supply_chain_sboms WHERE id = $1 AND tenant_id = $2`,
            [sbomId, tenantId],
          )
        : await this.pool.query(
            `SELECT * FROM supply_chain_sboms WHERE id = $1`,
            [sbomId],
          );
      return result.rows[0] || null;
    } catch (error) {
      logger.error(
        { sbomId, tenantId, err: error instanceof Error ? error.message : String(error) },
        '[SbomService] Failed to get SBOM',
      );
      throw new OrionError(
        'Failed to retrieve SBOM',
        ErrorCode.DATABASE_ERROR,
        true,
        { sbomId, tenantId, originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  // ==================== Dependency Analysis ====================

  /**
   * Analyze dependencies of a given npm package + version.
   *
   * Resolves the dependency tree using the npm registry,
   * performing real resolution with circular dependency detection.
   */
  async analyzeDependencies(tenantId: string, input: DependencyAnalysisInput): Promise<any> {
    if (!this.pool) {
      throw new OrionError('Database pool not initialized', ErrorCode.SERVICE_UNAVAILABLE, true);
    }

    logger.info({ tenantId, package: input.packageName, version: input.packageVersion }, '[SbomService] Analyzing dependencies');

    try {
      // Check for existing analysis
      const existing = await this.pool.query(
        `SELECT * FROM dependency_graphs WHERE tenant_id = $1 AND package_name = $2 AND package_version = $3`,
        [tenantId, input.packageName, input.packageVersion],
      );

      if (existing.rows.length > 0) {
        return existing.rows[0];
      }

      // Perform real dependency resolution via npm registry
      const directDeps = await this.resolveDirectDependencies(input.packageName, input.packageVersion);
      const transitiveDeps = await this.resolveTransitiveDependencies(directDeps, input.depth || 3);
      const vulnerablePaths = this.findVulnerablePaths([...directDeps, ...transitiveDeps]);

      const result = await this.pool.query(
        `INSERT INTO dependency_graphs (tenant_id, package_name, package_version, direct_deps, transitive_deps, vulnerable_paths, depth)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          tenantId,
          input.packageName,
          input.packageVersion,
          JSON.stringify(directDeps),
          JSON.stringify(transitiveDeps),
          JSON.stringify(vulnerablePaths),
          input.depth || 3,
        ],
      );

      logger.info({ tenantId, package: input.packageName, graphId: result.rows[0]?.id }, '[SbomService] Dependency analysis completed');
      return result.rows[0];
    } catch (error) {
      logger.error(
        { tenantId, package: input.packageName, version: input.packageVersion, err: error instanceof Error ? error.message : String(error) },
        '[SbomService] Failed to analyze dependencies',
      );
      throw new OrionError(
        'Failed to analyze dependencies',
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        true,
        { tenantId, package: input.packageName, version: input.packageVersion, originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  // ==================== Compliance Check ====================

  /**
   * Check SBOM compliance against a policy.
   *
   * Validates license categories, vulnerability severity thresholds,
   * and signature requirements.
   */
  async checkCompliance(sbom: any, policy?: CompliancePolicy): Promise<ComplianceResult> {
    logger.info({ sbomId: sbom?.id, policyId: policy?.id }, '[SbomService] Checking SBOM compliance');

    const activePolicy = policy || this.getDefaultCompliancePolicy();
    const components = sbom?.components || [];
    const vulnerabilities = sbom?.vulnerabilities || [];

    const violations: ComplianceViolation[] = [];
    let compliantComponents = 0;
    let licenseViolations = 0;
    let vulnerabilityViolations = 0;
    let signatureMissing = 0;

    for (const comp of components) {
      const compViolations = this.checkComponentCompliance(comp, activePolicy, vulnerabilities);
      violations.push(...compViolations);

      if (compViolations.length === 0) {
        compliantComponents++;
      } else {
        licenseViolations += compViolations.filter(v => v.type === 'license').length;
        vulnerabilityViolations += compViolations.filter(v => v.type === 'vulnerability').length;
        signatureMissing += compViolations.filter(v => v.type === 'signature').length;
      }
    }

    const compliant = violations.length === 0;

    logger.info(
      { sbomId: sbom?.id, compliant, violationCount: violations.length },
      '[SbomService] Compliance check completed',
    );

    return {
      compliant,
      policyId: activePolicy.id,
      violations,
      summary: {
        totalComponents: components.length,
        compliantComponents,
        nonCompliantComponents: components.length - compliantComponents,
        licenseViolations,
        vulnerabilityViolations,
        signatureMissing,
      },
      checkedAt: new Date(),
    };
  }

  private getDefaultCompliancePolicy(): CompliancePolicy {
    return {
      id: 'default',
      name: 'Default Policy',
      blockedLicenseCategories: ['proprietary'],
      maxVulnerabilitySeverity: 'high',
      allowUnknownLicenses: true,
      requireSignature: false,
    };
  }

  private checkComponentCompliance(
    comp: any,
    policy: CompliancePolicy,
    vulnerabilities: any[],
  ): ComplianceViolation[] {
    const violations: ComplianceViolation[] = [];

    // Check license compliance
    if (comp.licenses && comp.licenses.length > 0) {
      for (const lic of comp.licenses) {
        const licenseId = lic.license?.id || 'unknown';
        if (policy.blockedLicenseCategories.includes(this.categorizeLicense(licenseId))) {
          violations.push({
            type: 'license',
            severity: 'high',
            component: comp.name,
            version: comp.version,
            reason: `Blocked license: ${licenseId}`,
            recommendation: `Replace with a permissive alternative or obtain approval`,
          });
        }
      }
    } else if (!policy.allowUnknownLicenses) {
      violations.push({
        type: 'license',
        severity: 'medium',
        component: comp.name,
        version: comp.version,
        reason: 'Unknown license',
        recommendation: 'Declare license or obtain approval for unknown licenses',
      });
    }

    // Check vulnerability severity
    const compVulns = vulnerabilities.filter((v: any) => v.component === comp.name);
    for (const vuln of compVulns) {
      if (this.isSeverityAtLeast(vuln.severity, policy.maxVulnerabilitySeverity)) {
        violations.push({
          type: 'vulnerability',
          severity: vuln.severity,
          component: comp.name,
          version: comp.version,
          reason: `${vuln.cve || 'Unknown CVE'}: ${vuln.description || 'Vulnerability detected'}`,
          recommendation: vuln.remediation || 'Update to a patched version',
        });
      }
    }

    return violations;
  }

  private categorizeLicense(licenseId: string): CompliancePolicy['blockedLicenseCategories'][number] {
    const permissive = ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC'];
    const copyleft = ['GPL-2.0', 'GPL-3.0', 'LGPL-2.1', 'LGPL-3.0', 'AGPL-3.0'];
    const proprietary = [' Proprietary', 'Commercial', 'Custom'];

    if (permissive.includes(licenseId)) return 'permissive';
    if (copyleft.includes(licenseId)) return 'copyleft';
    if (proprietary.some(p => licenseId.includes(p))) return 'proprietary';
    return 'unknown';
  }

  private isSeverityAtLeast(actual: string, threshold: string): boolean {
    const order = ['info', 'low', 'medium', 'high', 'critical'];
    return order.indexOf(actual) >= order.indexOf(threshold);
  }

  // ==================== Artifact Signature ====================

  /**
   * Persist artifact signature.
   */
  async persistArtifactSignature(
    tenantId: string,
    artifactId: string,
    signature: string,
    signedBy: string,
    signatureType = 'sha256',
  ): Promise<any> {
    if (!this.pool) {
      throw new OrionError('Database pool not initialized', ErrorCode.SERVICE_UNAVAILABLE, true);
    }

    try {
      const result = await this.pool.query(
        `INSERT INTO artifact_signatures (tenant_id, artifact_id, signature, signature_type, signed_by, verified)
         VALUES ($1, $2, $3, $4, $5, false) RETURNING *`,
        [tenantId, artifactId, signature, signatureType, signedBy],
      );
      return result.rows[0];
    } catch (error) {
      logger.error(
        { tenantId, artifactId, err: error instanceof Error ? error.message : String(error) },
        '[SbomService] Failed to persist artifact signature',
      );
      throw new OrionError(
        'Failed to persist artifact signature',
        ErrorCode.DATABASE_ERROR,
        true,
        { tenantId, artifactId, originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  /**
   * Verify an artifact signature.
   */
  async verifySignature(artifactId: string, signature: string): Promise<any> {
    if (!this.pool) {
      throw new OrionError('Database pool not initialized', ErrorCode.SERVICE_UNAVAILABLE, true);
    }

    try {
      const result = await this.pool.query(
        `SELECT * FROM artifact_signatures WHERE artifact_id = $1 AND signature = $2`,
        [artifactId, signature],
      );

      if (result.rows.length === 0) {
        logger.warn({ artifactId, signature }, '[SbomService] Signature verification failed: not found');
        return { verified: false, reason: 'Signature not found' };
      }

      const existing = result.rows[0];
      await this.pool.query(
        `UPDATE artifact_signatures SET verified = true, verified_at = NOW() WHERE id = $1`,
        [existing.id],
      );

      logger.info({ artifactId, signedBy: existing.signed_by }, '[SbomService] Signature verified');
      return { verified: true, signedBy: existing.signed_by, signedAt: existing.signed_at };
    } catch (error) {
      logger.error(
        { artifactId, err: error instanceof Error ? error.message : String(error) },
        '[SbomService] Failed to verify signature',
      );
      throw new OrionError(
        'Failed to verify signature',
        ErrorCode.DATABASE_ERROR,
        true,
        { artifactId, originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  /**
   * Get supply chain security report summary.
   */
  async getSupplyChainReport(tenantId: string, pipelineId?: string): Promise<{
    totalSboms: number;
    totalSignatures: number;
    verifiedSignatures: number;
    totalVulnerabilities: number;
  }> {
    if (!this.pool) {
      throw new OrionError('Database pool not initialized', ErrorCode.SERVICE_UNAVAILABLE, true);
    }

    try {
      const sbomQuery = pipelineId
        ? `SELECT COUNT(*) as total_sboms FROM supply_chain_sboms WHERE tenant_id = $1 AND pipeline_id = $2`
        : `SELECT COUNT(*) as total_sboms FROM supply_chain_sboms WHERE tenant_id = $1`;
      const sbomParams = pipelineId ? [tenantId, pipelineId] : [tenantId];
      const sbomRows = await this.pool.query(sbomQuery, sbomParams);
      const totalSboms = parseInt(sbomRows.rows[0]?.total_sboms) || 0;

      const artifactId = pipelineId || '';
      const sigRows = await this.pool.query(
        `SELECT COUNT(*) as total_signatures, COUNT(*) FILTER (WHERE verified = true) as verified_count FROM artifact_signatures WHERE tenant_id = $1 AND artifact_id = $2`,
        [tenantId, artifactId],
      );
      const totalSignatures = parseInt(sigRows.rows[0]?.total_signatures) || 0;
      const verifiedSignatures = parseInt(sigRows.rows[0]?.verified_count) || 0;

      const vulnQuery = pipelineId
        ? `SELECT COUNT(*) as total_vulnerabilities FROM supply_chain_sboms WHERE tenant_id = $1 AND pipeline_id = $2 AND vulnerabilities IS NOT NULL`
        : `SELECT COUNT(*) as total_vulnerabilities FROM supply_chain_sboms WHERE tenant_id = $1 AND vulnerabilities IS NOT NULL`;
      const vulnParams = pipelineId ? [tenantId, pipelineId] : [tenantId];
      const vulnRows = await this.pool.query(vulnQuery, vulnParams);
      const totalVulnerabilities = parseInt(vulnRows.rows[0]?.total_vulnerabilities) || 0;

      return {
        totalSboms,
        totalSignatures,
        verifiedSignatures,
        totalVulnerabilities,
      };
    } catch (error) {
      logger.error(
        { tenantId, pipelineId, err: error instanceof Error ? error.message : String(error) },
        '[SbomService] Failed to get supply chain report',
      );
      throw new OrionError(
        'Failed to retrieve supply chain report',
        ErrorCode.DATABASE_ERROR,
        true,
        { tenantId, pipelineId, originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  // ==================== Dependency Poisoning Detection ====================

  /**
   * Detect known malicious package versions in dependencies.
   */
  detectMaliciousPackages(
    packages: { name: string; version?: string }[],
  ): { package: string; version: string; info: MaliciousPackageInfo }[] {
    const findings: { package: string; version: string; info: MaliciousPackageInfo }[] = [];

    for (const pkg of packages) {
      for (const known of KNOWN_MALICIOUS_PACKAGES) {
        if (pkg.name.toLowerCase() === known.name.toLowerCase()) {
          if (known.version) {
            if (pkg.version === known.version) {
              findings.push({ package: pkg.name, version: pkg.version || 'unknown', info: known });
            }
          } else {
            findings.push({ package: pkg.name, version: pkg.version || 'any', info: known });
          }
        }
      }
    }

    return findings;
  }

  /**
   * Detect typosquatting attempts.
   */
  detectTyposquatting(packageNames: string[]): TyposquattingAlert[] {
    const alerts: TyposquattingAlert[] = [];

    for (const pkgName of packageNames) {
      const normalizedName = pkgName.toLowerCase().trim();

      for (const legit of POPULAR_PACKAGES) {
        if (normalizedName === legit.toLowerCase()) continue;

        const similarity = this.calculateStringSimilarity(normalizedName, legit.toLowerCase());

        if (similarity > 0.75) {
          alerts.push({
            suspicious: pkgName,
            legitimate: legit,
            similarity,
            type: this.classifyTyposquatting(normalizedName, legit.toLowerCase()),
          });
        }
      }
    }

    return alerts;
  }

  /**
   * Full dependency poisoning scan.
   */
  async scanDependencyPoisoning(
    tenantId: string,
    packages: { name: string; version?: string }[],
  ): Promise<DependencyPoisoningReport> {
    if (!this.pool) {
      throw new OrionError('Database pool not initialized', ErrorCode.SERVICE_UNAVAILABLE, true);
    }

    logger.info({ tenantId, packageCount: packages.length }, '[SbomService] Starting dependency poisoning scan');

    const packageNames = packages.map((p) => p.name);

    const maliciousPackages = this.detectMaliciousPackages(packages);
    const typosquattingAlerts = this.detectTyposquatting(packageNames);

    logger.info(
      { tenantId, totalPackages: packages.length, maliciousCount: maliciousPackages.length, typosquattingCount: typosquattingAlerts.length },
      '[SbomService] Dependency poisoning scan completed',
    );

    let riskScore = 0;
    for (const m of maliciousPackages) {
      switch (m.info.severity) {
        case 'critical': riskScore += 40; break;
        case 'high': riskScore += 25; break;
        case 'medium': riskScore += 10; break;
        case 'low': riskScore += 5; break;
      }
    }
    for (const t of typosquattingAlerts) {
      riskScore += Math.round(t.similarity * 15);
    }

    let riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
    if (riskScore === 0) riskLevel = 'safe';
    else if (riskScore < 20) riskLevel = 'low';
    else if (riskScore < 50) riskLevel = 'medium';
    else if (riskScore < 80) riskLevel = 'high';
    else riskLevel = 'critical';

    try {
      await this.pool.query(
        `INSERT INTO dependency_poisoning_scans
          (tenant_id, packages_scanned, malicious_found, typosquatting_found, risk_score, risk_level, scan_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          tenantId,
          packages.length,
          maliciousPackages.length,
          typosquattingAlerts.length,
          riskScore,
          riskLevel,
          JSON.stringify({ maliciousPackages, typosquattingAlerts }),
        ],
      );
    } catch (error) {
      logger.warn(
        { tenantId, err: error instanceof Error ? error.message : String(error) },
        '[SbomService] Failed to persist poisoning scan result',
      );
    }

    return {
      maliciousPackages,
      typosquattingAlerts,
      riskScore: Math.min(100, riskScore),
      riskLevel,
      totalPackagesScanned: packages.length,
      scanTimestamp: new Date().toISOString(),
    };
  }

  /**
   * Get supply chain security score dashboard data.
   */
  async getSecurityScoreDashboard(tenantId: string): Promise<any> {
    if (!this.pool) {
      throw new OrionError('Database pool not initialized', ErrorCode.SERVICE_UNAVAILABLE, true);
    }

    try {
      const sbomCount = await this.pool.query(
        `SELECT COUNT(*) as total FROM supply_chain_sboms WHERE tenant_id = $1`,
        [tenantId],
      );

      const sigCount = await this.pool.query(
        `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE verified = true) as verified FROM artifact_signatures WHERE tenant_id = $1`,
        [tenantId],
      );

      const poisonScans = await this.pool.query(
        `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE risk_level IN ('high', 'critical')) as critical FROM dependency_poisoning_scans WHERE tenant_id = $1`,
        [tenantId],
      );

      const totalSboms = parseInt(sbomCount.rows[0]?.total) || 0;
      const totalSigs = parseInt(sigCount.rows[0]?.total) || 0;
      const verifiedSigs = parseInt(sigCount.rows[0]?.verified) || 0;
      const totalPoisonScans = parseInt(poisonScans.rows[0]?.total) || 0;
      const criticalPoison = parseInt(poisonScans.rows[0]?.critical) || 0;

      const sbomScore = totalSboms > 0 ? 30 : 0;
      const signatureScore = totalSigs > 0 ? (verifiedSigs / totalSigs) * 30 : 0;
      const poisonScore = totalPoisonScans > 0
        ? ((totalPoisonScans - criticalPoison) / totalPoisonScans) * 40
        : 20;

      const overallScore = Math.round(sbomScore + signatureScore + poisonScore);

      logger.info(
        { tenantId, overallScore, sbomScore, signatureScore, poisonScore },
        '[SbomService] Security score dashboard computed',
      );

      return {
        overall_score: overallScore,
        components: {
          sbom_coverage: totalSboms,
          signature_rate: totalSigs > 0 ? Math.round((verifiedSigs / totalSigs) * 100) : 0,
          poison_detection_rate: totalPoisonScans > 0
            ? Math.round(((totalPoisonScans - criticalPoison) / totalPoisonScans) * 100)
            : 0,
        },
        alerts: {
          critical_poison_findings: criticalPoison,
          unsigned_artifacts: totalSigs - verifiedSigs,
        },
        recommendations: this.generateSecurityRecommendations(
          totalSboms, verifiedSigs, totalSigs, criticalPoison,
        ),
      };
    } catch (error) {
      logger.error(
        { tenantId, err: error instanceof Error ? error.message : String(error) },
        '[SbomService] Failed to get security score dashboard',
      );
      throw new OrionError(
        'Failed to retrieve security score dashboard',
        ErrorCode.DATABASE_ERROR,
        true,
        { tenantId, originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  private generateSecurityRecommendations(
    sbomCount: number,
    verifiedSigs: number,
    totalSigs: number,
    criticalPoison: number,
  ): string[] {
    const recs: string[] = [];
    if (sbomCount === 0) recs.push('Enable SBOM generation for all pipelines');
    if (totalSigs === 0) recs.push('Enable artifact signing');
    if (totalSigs > 0 && verifiedSigs < totalSigs) {
      recs.push(`Verify ${totalSigs - verifiedSigs} unsigned artifacts`);
    }
    if (criticalPoison > 0) {
      recs.push(`Investigate ${criticalPoison} critical dependency poisoning findings`);
    }
    if (recs.length === 0) recs.push('Supply chain security posture is healthy');
    return recs;
  }

  // ==================== Private: CycloneDX Builders ====================

  /**
   * Build a CycloneDX component from a generic component descriptor.
   */
  private buildCycloneDXComponent(comp: any): CycloneDXComponent {
    const name = comp.name || 'unknown';
    const version = comp.version || '0.0.0';
    const purl = this.buildPURL(name, version);

    const component: CycloneDXComponent = {
      type: 'library',
      name,
      version,
      purl,
      'bom-ref': purl,
    };

    // Override type if explicitly provided
    if (comp.type && ['library', 'application', 'framework', 'container'].includes(comp.type)) {
      component.type = comp.type as CycloneDXComponent['type'];
    }

    // Include license if available
    if (comp.license) {
      component.licenses = [{ license: { id: comp.license } }];
    }

    if (comp.description) {
      component.description = comp.description;
    }

    return component;
  }

  /**
   * Build dependency relationships from components and their dependencies.
   */
  private buildDependencyRelationships(
    components: any[],
    dependencies: any[],
  ): { ref: string; dependsOn: string[] }[] {
    const depMap = new Map<string, Set<string>>();

    for (const comp of components) {
      const ref = this.buildPURL(comp.name || 'unknown', comp.version || '0.0.0');
      if (!depMap.has(ref)) {
        depMap.set(ref, new Set());
      }
    }

    for (const dep of dependencies) {
      const parentRef = this.buildPURL(
        dep.parent?.name || 'unknown',
        dep.parent?.version || '0.0.0',
      );
      const childRef = this.buildPURL(dep.name || 'unknown', dep.version || '0.0.0');

      if (!depMap.has(parentRef)) {
        depMap.set(parentRef, new Set());
      }
      depMap.get(parentRef)!.add(childRef);
    }

    return Array.from(depMap.entries()).map(([ref, deps]) => ({
      ref,
      dependsOn: Array.from(deps),
    }));
  }

  /**
   * Build the complete CycloneDX SBOM document.
   */
  private buildCycloneDXSBOM(
    components: CycloneDXComponent[],
    dependencies: { ref: string; dependsOn: string[] }[],
    vulnerabilities: any[],
  ): CycloneDXSBOM {
    const sbom: CycloneDXSBOM = {
      $schema: 'http://cyclonedx.org/schema/bom-1.4.schema.json',
      bomFormat: 'CycloneDX',
      specVersion: '1.4',
      serialNumber: `urn:uuid:${this.generateUUID()}`,
      version: 1,
      metadata: {
        timestamp: new Date().toISOString(),
        tools: [
          {
            name: '@orion/platform-service',
            vendor: 'Orion',
            version: '1.0.0',
          },
        ],
      },
      components,
      dependencies,
    };

    if (vulnerabilities.length > 0) {
      sbom.vulnerabilities = vulnerabilities;
    }

    return sbom;
  }

  /**
   * Build a Package URL (purl) from name and version.
   *
   * Format: pkg:npm/{name}@{version}
   */
  private buildPURL(name: string, version: string): string {
    const encodedName = encodeURIComponent(name).replace(/%2F/g, '/');
    return `pkg:npm/${encodedName}@${encodeURIComponent(version)}`;
  }

  /**
   * Generate a v4 UUID for CycloneDX serial numbers.
   */
  private generateUUID(): string {
    const hex = '0123456789abcdef';
    let uuid = '';
    for (let i = 0; i < 36; i++) {
      if (i === 8 || i === 13 || i === 18 || i === 23) {
        uuid += '-';
      } else if (i === 14) {
        uuid += '4';
      } else if (i === 19) {
        uuid += hex[(Math.random() * 4) | 8];
      } else {
        uuid += hex[(Math.random() * 16) | 0];
      }
    }
    return uuid;
  }

  // ==================== Private: NPM Registry Resolution ====================

  /**
   * Resolve direct dependencies of a package from the npm registry.
   */
  private async resolveDirectDependencies(
    packageName: string,
    packageVersion: string,
  ): Promise<DependencyNode[]> {
    try {
      const manifest = await this.fetchNpmPackageMetadata(packageName, packageVersion);

      const deps: DependencyNode[] = [];
      const rawDeps: Record<string, string> = manifest.dependencies || {};
      const rawDevDeps: Record<string, string> = manifest.devDependencies || {};

      // Sort for deterministic output
      const depEntries = Object.entries(rawDeps).sort(([a], [b]) => a.localeCompare(b));
      for (const [name, versionSpec] of depEntries) {
        const resolved = await this.resolveSemverVersion(name, versionSpec);
        deps.push({
          name,
          version: versionSpec,
          resolvedVersion: resolved,
          scope: 'prod',
          children: [],
          depth: 0,
          type: 'dependency',
        });
      }

      const devDepEntries = Object.entries(rawDevDeps).sort(([a], [b]) => a.localeCompare(b));
      for (const [name, versionSpec] of devDepEntries) {
        const resolved = await this.resolveSemverVersion(name, versionSpec);
        deps.push({
          name,
          version: versionSpec,
          resolvedVersion: resolved,
          scope: 'dev',
          children: [],
          depth: 0,
          type: 'devDependency',
        });
      }

      return deps;
    } catch {
      logger.warn({ packageName, packageVersion }, '[SbomService] Failed to resolve direct dependencies');
      return [];
    }
  }

  /**
   * Resolve transitive dependencies recursively.
   */
  private async resolveTransitiveDependencies(
    deps: DependencyNode[],
    depth: number,
    visited?: Set<string>,
  ): Promise<DependencyNode[]> {
    const transitive: DependencyNode[] = [];
    const seen = visited || new Set<string>();

    // Safety cap to prevent runaway recursion
    const effectiveDepth = Math.min(depth, 10);
    if (effectiveDepth <= 0) return transitive;

    for (const dep of deps) {
      const resolvedVersion = dep.resolvedVersion || dep.version;
      const key = `${dep.name}@${resolvedVersion}`;

      if (seen.has(key)) continue;
      seen.add(key);

      try {
        const subDeps = await this.resolveDirectDependencies(dep.name, resolvedVersion);

        if (subDeps.length > 0) {
          transitive.push(...subDeps);

          const subTransitive = await this.resolveTransitiveDependencies(
            subDeps, effectiveDepth - 1, seen,
          );
          transitive.push(...subTransitive);
        }
      } catch {
        // Skip packages that can't be resolved
      }
    }

    return transitive;
  }

  /**
   * Fetch package metadata from the npm registry via HTTPS.
   */
  private fetchNpmPackageMetadata(name: string, version: string): Promise<any> {
    const cacheKey = `${name}@${version}`;

    const cached = this.registryCache.get(cacheKey);
    if (cached) return Promise.resolve(cached);

    const encodedName = encodeURIComponent(name).replace(/%40/g, '@');
    const url = `https://registry.npmjs.org/${encodedName}/${encodeURIComponent(version)}`;

    return new Promise<any>((resolve, reject) => {
      const https = require('https');
      const req = https.get(url, { headers: { Accept: 'application/json' } }, (res: any) => {
        let data = '';
        res.on('data', (chunk: string) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode === 404) {
            reject(new Error(`Package not found: ${name}@${version}`));
            return;
          }
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`npm registry returned ${res.statusCode} for ${name}@${version}`));
            return;
          }
          try {
            const parsed = JSON.parse(data);
            this.registryCache.set(cacheKey, parsed);
            resolve(parsed);
          } catch (e) {
            reject(new Error(`Failed to parse response for ${name}@${version}: ${e}`));
          }
        });
      });

      req.on('error', (err: Error) => {
        reject(new Error(`HTTPS request failed for ${name}@${version}: ${err.message}`));
      });

      req.setTimeout(15000, () => {
        req.destroy();
        reject(new Error(`Request timed out for ${name}@${version}`));
      });
    });
  }

  /**
   * Resolve a semver version spec to a concrete version using the npm registry.
   */
  private async resolveSemverVersion(name: string, versionSpec: string): Promise<string> {
    // If already a concrete version, use it directly
    if (/^\d+\.\d+\.\d+/.test(versionSpec)) {
      const match = versionSpec.match(/^(\d+\.\d+\.\d+)/);
      if (match) return match[1];
    }

    // Otherwise, fetch all versions and find the best match
    try {
      const encodedName = encodeURIComponent(name).replace(/%40/g, '@');
      const url = `https://registry.npmjs.org/${encodedName}`;

      const metadata = await this.fetchUrl(url);
      const allVersions: Record<string, any> = metadata.versions || {};

      if (versionSpec === 'latest' || versionSpec === '*') {
        const distTags = metadata['dist-tags'];
        if (distTags?.latest) return distTags.latest;
      }

      // Find the latest version matching the spec
      const versions = Object.keys(allVersions).sort((a, b) => this.compareVersions(a, b));

      // Simple range matching
      const cleaned = versionSpec.replace(/[\^~>=< ]/g, '').split(' ')[0];
      if (/^\d+\.\d+\.\d+$/.test(cleaned)) return cleaned;

      // Fallback: return the latest version
      return versions[versions.length - 1] || versionSpec;
    } catch {
      return versionSpec.replace(/[\^~]/g, '');
    }
  }

  /**
   * Simple semver comparison (ascending order).
   */
  private compareVersions(a: string, b: string): number {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      const na = pa[i] || 0;
      const nb = pb[i] || 0;
      if (na !== nb) return na - nb;
    }
    return 0;
  }

  /**
   * Generic HTTPS GET helper returning parsed JSON.
   */
  private fetchUrl(url: string): Promise<any> {
    const cached = this.registryCache.get(url);
    if (cached) return Promise.resolve(cached);

    return new Promise<any>((resolve, reject) => {
      const https = require('https');
      const req = https.get(url, { headers: { Accept: 'application/json' } }, (res: any) => {
        let data = '';
        res.on('data', (chunk: string) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode} for ${url}`));
            return;
          }
          try {
            const parsed = JSON.parse(data);
            this.registryCache.set(url, parsed);
            resolve(parsed);
          } catch (e) {
            reject(new Error(`Failed to parse ${url}: ${e}`));
          }
        });
      });
      req.on('error', reject);
      req.setTimeout(15000, () => {
        req.destroy();
        reject(new Error(`Request timed out: ${url}`));
      });
    });
  }

  // ==================== Private: Tree Building ====================

  /**
   * Recursively build a dependency tree node with nested sub-dependencies.
   */
  private async buildTreeNode(
    dep: DependencyNode,
    visited: Set<string>,
    currentDepth = 0,
    maxDepth = 3,
  ): Promise<DependencyNode> {
    if (currentDepth >= maxDepth) return { ...dep, dependencies: [] };

    const resolvedVersion = dep.resolvedVersion || dep.version;
    const node: DependencyNode = { ...dep, dependencies: [] };

    try {
      const subDeps = await this.resolveDirectDependencies(dep.name, resolvedVersion);
      const children: DependencyNode[] = [];

      for (const sub of subDeps) {
        const subKey = `${sub.name}@${sub.resolvedVersion || sub.version}`;
        if (!visited.has(subKey)) {
          visited.add(subKey);
          children.push(await this.buildTreeNode(sub, visited, currentDepth + 1, maxDepth));
        }
      }

      node.dependencies = children;
    } catch {
      node.dependencies = [];
    }

    return node;
  }

  // ==================== Private: Vulnerability / Misc Helpers ====================

  private analyzeVulnerabilities(components: any[]): any[] {
    const vulnerabilities: any[] = [];
    for (const component of components) {
      if (component.version?.includes('0.') || component.knownVulnerabilities) {
        vulnerabilities.push({
          component: component.name,
          version: component.version,
          severity: component.knownVulnerabilities ? 'high' : 'medium',
          cve: component.cve || 'unknown',
          description: `Potentially vulnerable component: ${component.name}`,
        });
      }
    }
    return vulnerabilities;
  }

  private findVulnerablePaths(deps: any[]): any[] {
    return deps.filter((d) => d.version.startsWith('0.') || d.name.includes('vulnerable'));
  }

  /**
   * Calculate Levenshtein-based string similarity.
   */
  private calculateStringSimilarity(a: string, b: string): number {
    const lenA = a.length;
    const lenB = b.length;
    if (lenA === 0 || lenB === 0) return 0;

    const matrix: number[][] = [];
    for (let i = 0; i <= lenA; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= lenB; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= lenA; i++) {
      for (let j = 1; j <= lenB; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost,
        );
      }
    }

    const distance = matrix[lenA][lenB];
    const maxLen = Math.max(lenA, lenB);
    return 1 - distance / maxLen;
  }

  /**
   * Classify the type of typosquatting.
   */
  private classifyTyposquatting(
    suspicious: string,
    legitimate: string,
  ): TyposquattingAlert['type'] {
    if (suspicious.includes('-') && legitimate.split('-').every((p) => suspicious.includes(p))) {
      return 'namespace-squat';
    }
    if (suspicious.length > legitimate.length && suspicious.startsWith(legitimate)) {
      return 'combo';
    }
    if (Math.abs(suspicious.length - legitimate.length) <= 1) {
      return 'homograph';
    }
    return 'typosquatting';
  }
}

export default SbomService;
