/**
 * SupplyChainService - 供应链安全管理
 *
 * SBOM 管理、依赖链分析、签名验证、依赖投毒检测
 */

import { DatabasePool } from '../database';

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
  constructor(private pool: DatabasePool) {}

  /**
   * 生成 SBOM
   */
  async generateSBOM(tenantId: string, input: SBOMInput): Promise<any> {
    const vulnerabilities = this.analyzeVulnerabilities(input.components);

    const result = await this.pool.query(
      `INSERT INTO supply_chain_sboms (tenant_id, artifact_id, pipeline_id, sbom_format, sbom_version, components, dependencies, vulnerabilities, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        tenantId,
        input.artifactId,
        input.pipelineId || null,
        input.format || 'cyclonedx',
        input.version || '1.4',
        JSON.stringify(input.components),
        JSON.stringify(input.dependencies || []),
        JSON.stringify(vulnerabilities),
        JSON.stringify({ generatedAt: new Date().toISOString() }),
      ],
    );

    return result.rows[0];
  }

  /**
   * 获取 SBOM
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
   * 依赖链分析
   */
  async analyzeDependencies(tenantId: string, input: DependencyAnalysisInput): Promise<any> {
    // 查询现有依赖图
    const existing = await this.pool.query(
      `SELECT * FROM dependency_graphs WHERE tenant_id = $1 AND package_name = $2 AND package_version = $3`,
      [tenantId, input.packageName, input.packageVersion],
    );

    if (existing.rows.length > 0) {
      return existing.rows[0];
    }

    // 构建依赖关系图
    const directDeps = this.resolveDirectDependencies(input.packageName, input.packageVersion);
    const transitiveDeps = this.resolveTransitiveDependencies(directDeps, input.depth || 3);
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
   * 持久化制品签名
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
   * 签名验证
   */
  async verifySignature(artifactId: string, signature: string): Promise<any> {
    const result = await this.pool.query(
      `SELECT * FROM artifact_signatures WHERE artifact_id = $1 AND signature = $2`,
      [artifactId, signature],
    );

    if (result.rows.length === 0) {
      return { verified: false, reason: 'Signature not found' };
    }

    const existing = result.rows[0];
    await this.pool.query(
      `UPDATE artifact_signatures SET verified = true, verified_at = NOW() WHERE id = $1`,
      [existing.id],
    );

    return { verified: true, signedBy: existing.signed_by, signedAt: existing.signed_at };
  }

  /**
   * 供应链安全报告 — 统计汇总
   * 返回格式: { totalSboms, totalSignatures, verifiedSignatures, totalVulnerabilities }
   */
  async getSupplyChainReport(tenantId: string, pipelineId?: string): Promise<{
    totalSboms: number;
    totalSignatures: number;
    verifiedSignatures: number;
    totalVulnerabilities: number;
  }> {
    // Query SBOM count (with optional pipeline_id filter)
    const sbomQuery = pipelineId
      ? `SELECT COUNT(*) as total_sboms FROM supply_chain_sboms WHERE tenant_id = $1 AND pipeline_id = $2`
      : `SELECT COUNT(*) as total_sboms FROM supply_chain_sboms WHERE tenant_id = $1`;
    const sbomParams = pipelineId ? [tenantId, pipelineId] : [tenantId];
    const sbomRows = await this.pool.query(sbomQuery, sbomParams);
    const totalSboms = parseInt(sbomRows.rows[0]?.total_sboms) || 0;

    // Query signature count and verified count
    const artifactId = pipelineId || '';
    const sigRows = await this.pool.query(
      `SELECT COUNT(*) as total_signatures, COUNT(*) FILTER (WHERE verified = true) as verified_count FROM artifact_signatures WHERE tenant_id = $1 AND artifact_id = $2`,
      [tenantId, artifactId],
    );
    const totalSignatures = parseInt(sigRows.rows[0]?.total_signatures) || 0;
    const verifiedSignatures = parseInt(sigRows.rows[0]?.verified_count) || 0;

    // Query vulnerability count from SBOMs
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
   * Detect known malicious package versions in dependencies
   */
  detectMaliciousPackages(packages: { name: string; version?: string }[]): { package: string; version: string; info: MaliciousPackageInfo }[] {
    const findings: { package: string; version: string; info: MaliciousPackageInfo }[] = [];

    for (const pkg of packages) {
      for (const known of KNOWN_MALICIOUS_PACKAGES) {
        if (pkg.name.toLowerCase() === known.name.toLowerCase()) {
          // If a specific version is listed, check version match
          if (known.version) {
            if (pkg.version === known.version) {
              findings.push({ package: pkg.name, version: pkg.version || 'unknown', info: known });
            }
          } else {
            // Package is always malicious regardless of version
            findings.push({ package: pkg.name, version: pkg.version || 'any', info: known });
          }
        }
      }
    }

    return findings;
  }

  /**
   * Detect typosquatting attempts - packages with names similar to popular packages
   */
  detectTyposquatting(packageNames: string[]): TyposquattingAlert[] {
    const alerts: TyposquattingAlert[] = [];

    for (const pkgName of packageNames) {
      const normalizedName = pkgName.toLowerCase().trim();

      for (const legit of POPULAR_PACKAGES) {
        if (normalizedName === legit.toLowerCase()) continue; // Exact match, not typosquatting

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
   * Full dependency poisoning scan
   */
  async scanDependencyPoisoning(tenantId: string, packages: { name: string; version?: string }[]): Promise<DependencyPoisoningReport> {
    const packageNames = packages.map((p) => p.name);

    // Check for known malicious packages
    const maliciousPackages = this.detectMaliciousPackages(packages);

    // Check for typosquatting
    const typosquattingAlerts = this.detectTyposquatting(packageNames);

    // Calculate risk score
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

    // Determine risk level
    let riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
    if (riskScore === 0) riskLevel = 'safe';
    else if (riskScore < 20) riskLevel = 'low';
    else if (riskScore < 50) riskLevel = 'medium';
    else if (riskScore < 80) riskLevel = 'high';
    else riskLevel = 'critical';

    // Store scan results
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
   * Get supply chain security score dashboard data
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

    // Calculate overall score
    const sbomScore = totalSboms > 0 ? 30 : 0;
    const signatureScore = totalSigs > 0 ? (verifiedSigs / totalSigs) * 30 : 0;
    const poisonScore = totalPoisonScans > 0 ? ((totalPoisonScans - criticalPoison) / totalPoisonScans) * 40 : 20;

    const overallScore = Math.round(sbomScore + signatureScore + poisonScore);

    return {
      overall_score: overallScore,
      components: {
        sbom_coverage: totalSboms,
        signature_rate: totalSigs > 0 ? Math.round((verifiedSigs / totalSigs) * 100) : 0,
        poison_detection_rate: totalPoisonScans > 0 ? Math.round(((totalPoisonScans - criticalPoison) / totalPoisonScans) * 100) : 0,
      },
      alerts: {
        critical_poison_findings: criticalPoison,
        unsigned_artifacts: totalSigs - verifiedSigs,
      },
      recommendations: this.generateSecurityRecommendations(totalSboms, verifiedSigs, totalSigs, criticalPoison),
    };
  }

  private generateSecurityRecommendations(sbomCount: number, verifiedSigs: number, totalSigs: number, criticalPoison: number): string[] {
    const recs: string[] = [];
    if (sbomCount === 0) recs.push('Enable SBOM generation for all pipelines');
    if (totalSigs === 0) recs.push('Enable artifact signing');
    if (totalSigs > 0 && verifiedSigs < totalSigs) recs.push(`Verify ${totalSigs - verifiedSigs} unsigned artifacts`);
    if (criticalPoison > 0) recs.push(`Investigate ${criticalPoison} critical dependency poisoning findings`);
    if (recs.length === 0) recs.push('Supply chain security posture is healthy');
    return recs;
  }

  // ==================== Private Helpers ====================

  private analyzeVulnerabilities(components: any[]): any[] {
    // 简化实现：标记已知脆弱组件
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

  private resolveDirectDependencies(packageName: string, packageVersion: string): any[] {
    // 简化实现：返回模拟依赖
    return [
      { name: `${packageName}-dep-a`, version: '1.0.0' },
      { name: `${packageName}-dep-b`, version: '2.0.0' },
    ];
  }

  private resolveTransitiveDependencies(directDeps: any[], depth: number): any[] {
    const transitive: any[] = [];
    for (const dep of directDeps) {
      for (let i = 0; i < depth; i++) {
        transitive.push({ name: `${dep.name}-transitive-${i}`, version: `${i + 1}.0.0` });
      }
    }
    return transitive;
  }

  private findVulnerablePaths(deps: any[]): any[] {
    return deps.filter((d) => d.version.startsWith('0.') || d.name.includes('vulnerable'));
  }

  /**
   * Calculate Levenshtein-based string similarity
   */
  private calculateStringSimilarity(a: string, b: string): number {
    const lenA = a.length;
    const lenB = b.length;
    if (lenA === 0 || lenB === 0) return 0;

    // Simple Levenshtein distance
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
   * Classify the type of typosquatting
   */
  private classifyTyposquatting(suspicious: string, legitimate: string): TyposquattingAlert['type'] {
    // Namespace squatting: @legit-something vs @legit
    if (suspicious.includes('-') && legitimate.split('-').every((p) => suspicious.includes(p))) {
      return 'namespace-squat';
    }
    // Combo attack: legit + common suffix
    if (suspicious.length > legitimate.length && suspicious.startsWith(legitimate)) {
      return 'combo';
    }
    // Homograph: similar characters
    if (Math.abs(suspicious.length - legitimate.length) <= 1) {
      return 'homograph';
    }
    return 'typosquatting';
  }
}
