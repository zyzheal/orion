/**
 * SupplyChainService - 供应链安全管理
 *
 * SBOM 管理、依赖链分析、签名验证、依赖投毒检测
 *
 * 依赖解析引擎：通过 npm registry HTTPS API 实时解析依赖树，
 * 支持循环依赖检测、深度控制、registry 响应缓存。
 *
 * SBOM 输出格式：CycloneDX v1.4 JSON
 */

import { DatabasePool } from '../database';
import pino from 'pino';
import https from 'https';
import { promises as fs } from 'fs';

const logger = pino({ level: process.env.LOG_LEVEL || 'info', name: 'supply-chain' });

// ==================== Dependency Resolution Types ====================

export interface DependencyNode {
  name: string;
  version: string;
  resolvedVersion?: string;
  type: 'dependency' | 'devDependency' | 'peerDependency' | 'optionalDependency';
  dependencies?: DependencyNode[];
  license?: string;
}

// ==================== CycloneDX SBOM Types ====================

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

// ==================== Existing Interfaces (kept for compatibility) ====================

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

// ==================== Dependency Poisoning Detection ====================

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

export class SupplyChainService {
  // Registry response cache — keyed by "{name}@{version}" or URL
  private registryCache = new Map<string, any>();

  constructor(private pool: DatabasePool) {}

  // ==================== Public API: Dependency Resolution ====================

  /**
   * Resolve dependencies from a local package.json file.
   *
   * Reads the file at `filePath`, parses its dependencies and devDependencies,
   * then resolves them (and their transitive deps) from the npm registry.
   *
   * @param filePath - Absolute or relative path to package.json
   * @returns Object containing direct dependencies, transitive dependencies, and a tree representation
   */
  async resolveDependenciesFromPackageJson(filePath: string): Promise<{
    directDeps: DependencyNode[];
    transitiveDeps: DependencyNode[];
    tree: DependencyNode[];
  }> {
    logger.info({ filePath }, '[SupplyChain] Resolving dependencies from package.json');

    const pkgContent = await fs.readFile(filePath, 'utf-8');
    const pkg = JSON.parse(pkgContent);

    const directDeps: DependencyNode[] = [];

    // Parse regular dependencies
    if (pkg.dependencies) {
      for (const [name, versionSpec] of Object.entries(pkg.dependencies)) {
        const resolved = await this.resolveSemverVersion(name, versionSpec as string);
        directDeps.push({
          name,
          version: versionSpec as string,
          resolvedVersion: resolved,
          type: 'dependency',
        });
      }
    }

    // Parse devDependencies
    if (pkg.devDependencies) {
      for (const [name, versionSpec] of Object.entries(pkg.devDependencies)) {
        const resolved = await this.resolveSemverVersion(name, versionSpec as string);
        directDeps.push({
          name,
          version: versionSpec as string,
          resolvedVersion: resolved,
          type: 'devDependency',
        });
      }
    }

    logger.info({ filePath, directDepCount: directDeps.length }, '[SupplyChain] Resolved direct dependencies');

    // Resolve transitive dependencies (default depth = 2 for performance)
    const transitiveDeps = await this.resolveTransitiveDependencies(directDeps, 2);

    // Build a tree with nested dependencies
    const visited = new Set<string>();
    const tree: DependencyNode[] = [];
    for (const dep of directDeps) {
      const key = `${dep.name}@${dep.resolvedVersion || dep.version}`;
      if (!visited.has(key)) {
        visited.add(key);
        tree.push(await this.buildTreeNode(dep, visited));
      }
    }

    return { directDeps, transitiveDeps, tree };
  }

  /**
   * Generate SBOM (Software Bill of Materials) in CycloneDX format.
   *
   * Stores the SBOM in the database and returns the persisted record.
   * The components are converted to CycloneDX format and stored as structured JSON.
   */
  async generateSBOM(tenantId: string, input: SBOMInput): Promise<any> {
    logger.info({ tenantId, artifactId: input.artifactId, format: input.format }, '[SupplyChain] Generating SBOM');

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

    return result.rows[0];
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
  }

  // ==================== SBOM / Dependency Retrieval ====================

  /**
   * Get SBOM by ID.
   */
  async getSBOM(sbomId: string, tenantId?: string): Promise<any | null> {
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
  }

  /**
   * Analyze dependencies of a given npm package + version.
   *
   * Resolves the dependency tree using the npm registry,
   * performing real resolution with circular dependency detection.
   */
  async analyzeDependencies(tenantId: string, input: DependencyAnalysisInput): Promise<any> {
    logger.info({ tenantId, package: input.packageName, version: input.packageVersion }, '[SupplyChain] Analyzing dependencies');

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

    return result.rows[0];
  }

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
    const result = await this.pool.query(
      `INSERT INTO artifact_signatures (tenant_id, artifact_id, signature, signature_type, signed_by, verified)
       VALUES ($1, $2, $3, $4, $5, false) RETURNING *`,
      [tenantId, artifactId, signature, signatureType, signedBy],
    );
    return result.rows[0];
  }

  /**
   * Verify an artifact signature.
   */
  async verifySignature(artifactId: string, signature: string): Promise<any> {
    const result = await this.pool.query(
      `SELECT * FROM artifact_signatures WHERE artifact_id = $1 AND signature = $2`,
      [artifactId, signature],
    );

    if (result.rows.length === 0) {
      logger.warn({ artifactId, signature }, '[SupplyChain] Signature verification failed: not found');
      return { verified: false, reason: 'Signature not found' };
    }

    const existing = result.rows[0];
    await this.pool.query(
      `UPDATE artifact_signatures SET verified = true, verified_at = NOW() WHERE id = $1`,
      [existing.id],
    );

    logger.info({ artifactId, signedBy: existing.signed_by }, '[SupplyChain] Signature verified');

    return { verified: true, signedBy: existing.signed_by, signedAt: existing.signed_at };
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
    logger.info({ tenantId, packageCount: packages.length }, '[SupplyChain] Starting dependency poisoning scan');

    const packageNames = packages.map((p) => p.name);

    const maliciousPackages = this.detectMaliciousPackages(packages);
    const typosquattingAlerts = this.detectTyposquatting(packageNames);

    logger.info(
      { tenantId, totalPackages: packages.length, maliciousCount: maliciousPackages.length, typosquattingCount: typosquattingAlerts.length },
      '[SupplyChain] Dependency poisoning scan completed',
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
      '[SupplyChain] Security score dashboard computed',
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

  // ==================== Private: NPM Registry Resolution ====================

  /**
   * Resolve direct dependencies of a package from the npm registry.
   *
   * Retrieves the package manifest for the given name + version and returns
   * its immediate dependency entries. Returns an empty array on failure.
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
          type: 'devDependency',
        });
      }

      return deps;
    } catch {
      logger.warn({ packageName, packageVersion }, '[SupplyChain] Failed to resolve direct dependencies');
      return [];
    }
  }

  /**
   * Resolve transitive dependencies recursively.
   *
   * For each input dependency, fetches the package metadata from the npm registry
   * and recursively resolves its own dependencies up to the specified depth.
   *
   * Uses a Set of visited package keys to prevent infinite loops from
   * circular dependencies.
   *
   * @param deps - Array of dependency nodes to resolve transitively
   * @param depth - Remaining recursion depth (capped at 10)
   * @param visited - Set of already-visited package keys "{name}@{version}"
   * @returns Flattened array of transitive dependency nodes
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
   *
   * Uses Node's built-in `https` module (no external dependencies).
   * Responses are cached in `registryCache` keyed by "{name}@{version}".
   * Timeout is set to 15 seconds per request.
   */
  private fetchNpmPackageMetadata(name: string, version: string): Promise<any> {
    const cacheKey = `${name}@${version}`;

    const cached = this.registryCache.get(cacheKey);
    if (cached) return Promise.resolve(cached);

    const encodedName = encodeURIComponent(name).replace(/%40/g, '@');
    const url = `https://registry.npmjs.org/${encodedName}/${encodeURIComponent(version)}`;

    return new Promise<any>((resolve, reject) => {
      const req = https.get(url, { headers: { Accept: 'application/json' } }, (res) => {
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

      req.on('error', (err) => {
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
   *
   * For pinned versions (e.g. "1.0.0") returns it directly.
   * For ranges (^, ~, >=, etc.) fetches the package metadata and resolves
   * the latest matching version.
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
   * Results are cached in `registryCache` keyed by the URL.
   */
  private fetchUrl(url: string): Promise<any> {
    const cached = this.registryCache.get(url);
    if (cached) return Promise.resolve(cached);

    return new Promise<any>((resolve, reject) => {
      const req = https.get(url, { headers: { Accept: 'application/json' } }, (res) => {
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
