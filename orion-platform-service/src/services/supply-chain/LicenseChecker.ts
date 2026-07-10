/**
 * LicenseChecker - Compliance checking, poisoning detection, security scoring
 *
 * Handles:
 * - SBOM compliance validation (license + vulnerability + signature checks)
 * - Dependency poisoning detection (known malicious packages + typosquatting)
 * - Security score dashboard computation
 */

import { DatabasePool } from '../database';
import { OrionError, ErrorCode } from '../../errors';
import { createLogger } from '../../utils/logger';

import type {
  CompliancePolicy,
  ComplianceResult,
  ComplianceViolation,
  DependencyPoisoningReport,
  MaliciousPackageInfo,
  TyposquattingAlert,
  SupplyChainReport,
} from './types';

import { calculateStringSimilarity, classifyTyposquatting } from './SbomUtils';

const logger = createLogger('sbom-license-checker');

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

const POPULAR_PACKAGES = [
  'react', 'lodash', 'express', 'axios', 'moment', 'chalk', 'webpack',
  'babel', 'typescript', 'eslint', 'jest', 'node-fetch', 'dotenv',
  'uuid', 'cors', 'helmet', 'jsonwebtoken', 'bcrypt', 'pg', 'mysql',
  'mongoose', 'sequelize', 'redis', 'socket.io', 'fastify', 'koa',
  'next', 'vue', 'angular', 'svelte', 'tailwindcss',
];

// ==================== LicenseChecker ====================

export class LicenseChecker {
  constructor(private pool?: DatabasePool) {}

  // ==================== Compliance Check ====================

  async checkCompliance(sbom: any, policy?: CompliancePolicy): Promise<ComplianceResult> {
    logger.info({ sbomId: sbom?.id, policyId: policy?.id }, '[LicenseChecker] Checking SBOM compliance');

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
      '[LicenseChecker] Compliance check completed',
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

  // ==================== Dependency Poisoning Detection ====================

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

  detectTyposquatting(packageNames: string[]): TyposquattingAlert[] {
    const alerts: TyposquattingAlert[] = [];

    for (const pkgName of packageNames) {
      const normalizedName = pkgName.toLowerCase().trim();

      for (const legit of POPULAR_PACKAGES) {
        if (normalizedName === legit.toLowerCase()) continue;

        const similarity = calculateStringSimilarity(normalizedName, legit.toLowerCase());

        if (similarity > 0.75) {
          alerts.push({
            suspicious: pkgName,
            legitimate: legit,
            similarity,
            type: classifyTyposquatting(normalizedName, legit.toLowerCase()),
          });
        }
      }
    }

    return alerts;
  }

  async scanDependencyPoisoning(
    tenantId: string,
    packages: { name: string; version?: string }[],
  ): Promise<DependencyPoisoningReport> {
    if (!this.pool) {
      throw new OrionError('Database pool not initialized', ErrorCode.SERVICE_UNAVAILABLE, true);
    }

    logger.info({ tenantId, packageCount: packages.length }, '[LicenseChecker] Starting dependency poisoning scan');

    const packageNames = packages.map((p) => p.name);

    const maliciousPackages = this.detectMaliciousPackages(packages);
    const typosquattingAlerts = this.detectTyposquatting(packageNames);

    logger.info(
      { tenantId, totalPackages: packages.length, maliciousCount: maliciousPackages.length, typosquattingCount: typosquattingAlerts.length },
      '[LicenseChecker] Dependency poisoning scan completed',
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
        '[LicenseChecker] Failed to persist poisoning scan result',
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

  // ==================== Security Score Dashboard ====================

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
        '[LicenseChecker] Security score dashboard computed',
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
        '[LicenseChecker] Failed to get security score dashboard',
      );
      throw new OrionError(
        'Failed to retrieve security score dashboard',
        ErrorCode.DATABASE_ERROR,
        true,
        { tenantId, originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  // ==================== Private: Compliance Helpers ====================

  private checkComponentCompliance(
    comp: any,
    policy: CompliancePolicy,
    vulnerabilities: any[],
  ): ComplianceViolation[] {
    const violations: ComplianceViolation[] = [];

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
    const proprietary = ['Proprietary', 'Commercial', 'Custom'];

    if (permissive.includes(licenseId)) return 'permissive';
    if (copyleft.includes(licenseId)) return 'copyleft';
    if (proprietary.some(p => licenseId.includes(p))) return 'proprietary';
    return 'unknown';
  }

  private isSeverityAtLeast(actual: string, threshold: string): boolean {
    const order = ['info', 'low', 'medium', 'high', 'critical'];
    return order.indexOf(actual) >= order.indexOf(threshold);
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
}
