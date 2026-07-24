/**
 * SupplyChainService - 供应链安全核心逻辑
 *
 * 职责:
 * - 依赖树分析 (analyzeDependencies)
 * - SBOM 生成 (generateSbom)
 * - 许可证合规性检查 (checkCompliance)
 *
 * 与现有 security/SupplyChainService 的区别:
 * - 本服务专注于供应链安全的核心算法，不依赖 DatabasePool
 * - 通过 SbomService 统一调用漏洞查询能力
 */

import { SbomService } from './SbomService';
import {
  PackageJsonInput,
  DependencyTree,
  DependencyNode,
  SBOM,
  SBOMComponent,
  LicenseInfo,
  ComplianceResult,
  ComplianceViolation,
  CompliancePolicy,
  SupplyChainReport,
} from './types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('supply-chain');

// 内置合规策略（默认）
const DEFAULT_COMPLIANCE_POLICY: CompliancePolicy = {
  id: 'default',
  name: 'Default Supply Chain Policy',
  blockedLicenseCategories: ['proprietary'],
  maxVulnerabilitySeverity: 'high',
  allowUnknownLicenses: false,
  requireSignature: false,
};

// 已知的许可证映射（简化版）
const KNOWN_LICENSES: Record<string, { category: LicenseInfo['category']; isApproved: boolean }> = {
  'MIT': { category: 'permissive', isApproved: true },
  'Apache-2.0': { category: 'permissive', isApproved: true },
  'BSD-2-Clause': { category: 'permissive', isApproved: true },
  'BSD-3-Clause': { category: 'permissive', isApproved: true },
  'ISC': { category: 'permissive', isApproved: true },
  'GPL-2.0': { category: 'copyleft', isApproved: false },
  'GPL-3.0': { category: 'copyleft', isApproved: false },
  'LGPL-2.1': { category: 'copyleft', isApproved: false },
  'LGPL-3.0': { category: 'copyleft', isApproved: false },
  'AGPL-3.0': { category: 'copyleft', isApproved: false },
  'MPL-2.0': { category: 'copyleft', isApproved: true },
  'CDDL-1.0': { category: 'copyleft', isApproved: true },
  'EPL-1.0': { category: 'copyleft', isApproved: true },
  'Unlicense': { category: 'permissive', isApproved: true },
  'CC0-1.0': { category: 'permissive', isApproved: true },
};

// ==================== SupplyChainService ====================

export class SupplyChainService {
  private sbomService: SbomService;

  constructor(sbomService?: SbomService) {
    this.sbomService = sbomService ?? new SbomService();
  }

  // ==================== Dependency Analysis ====================

  /**
   * 分析 package.json 依赖树
   *
   * @param packageJson - package.json 内容
   * @returns 依赖树分析结果
   */
  async analyzeDependencies(packageJson: PackageJsonInput): Promise<DependencyTree> {
    logger.info(
      { packageName: packageJson.name, version: packageJson.version },
      '[SupplyChain] Analyzing dependency tree',
    );

    const root: DependencyNode = {
      name: packageJson.name,
      version: packageJson.version,
      scope: 'prod',
      children: [],
      depth: 0,
    };

    const allNodes = new Map<string, DependencyNode>();
    const circularDependencies: string[][] = [];
    const visiting = new Set<string>();

    // Add root node to tracking
    const rootKey = `${root.name}@${root.version}`;
    allNodes.set(rootKey, root);

    // Build tree from all dependency scopes
    const allDeps: Array<[string, string]> = [
      ...(Object.entries(packageJson.dependencies ?? {})),
      ...(Object.entries(packageJson.devDependencies ?? {})),
      ...(Object.entries(packageJson.peerDependencies ?? {})),
      ...(Object.entries(packageJson.optionalDependencies ?? {})),
    ];

    // Recursive resolution with circular dependency detection
    const resolveNode = (
      name: string,
      version: string,
      scope: DependencyNode['scope'],
      parentPath: string[],
      depth: number,
    ): DependencyNode => {
      const key = `${name}@${version}`;

      if (allNodes.has(key)) {
        return allNodes.get(key)!;
      }

      if (visiting.has(key)) {
        circularDependencies.push([...parentPath, key]);
        return { name, version, scope, children: [], depth };
      }

      visiting.add(key);

      const node: DependencyNode = {
        name,
        version,
        scope,
        children: [],
        depth,
      };

      allNodes.set(key, node);

      // For leaf nodes (no actual package resolution), just return
      // In production, this would call package registry APIs
      const children: DependencyNode[] = [];
      // Mock: assume each dependency has 2 sub-dependencies for demo
      if (depth < 3) {
        children.push(
          resolveNode(`${name}-dep-a`, '1.0.0', 'prod', [...parentPath, key], depth + 1),
          resolveNode(`${name}-dep-b`, '2.0.0', 'prod', [...parentPath, key], depth + 1),
        );
      }

      node.children = children;
      visiting.delete(key);

      return node;
    };

    // Resolve all top-level dependencies
    for (const [name, version] of allDeps) {
      const scope = packageJson.devDependencies?.[name]
        ? 'dev'
        : packageJson.peerDependencies?.[name]
          ? 'peer'
          : packageJson.optionalDependencies?.[name]
            ? 'optional'
            : 'prod';

      root.children.push(resolveNode(name, version, scope, [root.name], 1));
    }

    const totalNodes = allNodes.size;
    const maxDepth = Math.max(...Array.from(allNodes.values()).map(n => n.depth), 0);

    logger.info(
      { packageName: packageJson.name, totalNodes, maxDepth, circularDeps: circularDependencies.length },
      '[SupplyChain] Dependency tree analysis completed',
    );

    return {
      root,
      totalNodes,
      maxDepth,
      circularDependencies,
      vulnerablePaths: [], // Populated by SbomService integration
    };
  }

  // ==================== SBOM Generation ====================

  /**
   * 生成 SBOM (SPDX JSON 格式)
   *
   * @param artifactId - 制品 ID
   * @param components - 组件列表
   * @returns SPDX JSON SBOM
   */
  async generateSbom(artifactId: string, components: SBOMComponent[]): Promise<SBOM> {
    logger.info(
      { artifactId, componentCount: components.length },
      '[SupplyChain] Generating SBOM (SPDX JSON)',
    );

    const now = new Date();
    const sbom: SBOM = {
      id: `sbom-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      artifactId,
      format: 'spdx',
      specVersion: 'SPDX-2.3',
      components,
      dependencies: [], // Would be populated by analyzeDependencies
      createdAt: now,
      expiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000), // 1 year
      metadata: {
        tool: 'orion-supply-chain',
        generatedAt: now.toISOString(),
      },
    };

    logger.info({ sbomId: sbom.id, artifactId }, '[SupplyChain] SBOM generated');

    return sbom;
  }

  /**
   * 将 SBOM 序列化为 SPDX JSON 字符串
   */
  serializeSbom(sbom: SBOM): string {
    return JSON.stringify(
      {
        spdxVersion: sbom.specVersion,
        dataLicense: 'CC0-1.0',
        SPDXID: 'SPDXRef-DOCUMENT',
        name: `${sbom.artifactId}-sbom`,
        documentNamespace: `https://orion.io/sbom/${sbom.id}`,
        creationInfo: {
          created: sbom.createdAt.toISOString(),
          creators: ['Tool: orion-supply-chain'],
        },
        packages: sbom.components.map((comp, idx) => ({
          SPDXID: `SPDXRef-Package-${idx + 1}`,
          name: comp.name,
          versionInfo: comp.version,
          downloadLocation: 'NOASSERTION',
          licenseConcluded: comp.license.id,
          licenseDeclared: comp.license.id,
          copyrightText: 'NOASSERTION',
          supplier: comp.supplier ? `Person: ${comp.supplier}` : 'NOASSERTION',
          ...(comp.purl
            ? {
                externalRefs: [
                  {
                    referenceCategory: 'PACKAGE-MANAGER',
                    referenceType: 'purl',
                    referenceLocator: comp.purl,
                  },
                ],
              }
            : {}),
        })),
        relationships: sbom.dependencies.map((dep, idx) => ({
          spdxElementId: `SPDXRef-Package-${idx + 1}`,
          relationshipType: 'DEPENDS_ON',
          relatedSpdxElement: dep.children.map(() => 'NOASSERTION').join(', ') || 'NOASSERTION',
        })),
      },
      null,
      2,
    );
  }

  // ==================== Compliance Checking ====================

  /**
   * 检查 SBOM 许可证合规性
   *
   * @param sbom - SBOM 文档
   * @param policy - 合规策略（可选，默认使用内置策略）
   * @returns 合规检查结果
   */
  async checkCompliance(sbom: SBOM, policy?: CompliancePolicy): Promise<ComplianceResult> {
    const activePolicy = policy ?? DEFAULT_COMPLIANCE_POLICY;
    const violations: ComplianceViolation[] = [];

    logger.info(
      { sbomId: sbom.id, policyId: activePolicy.id, componentCount: sbom.components.length },
      '[SupplyChain] Checking compliance',
    );

    // Check each component
    for (const component of sbom.components) {
      // License check
      if (activePolicy.blockedLicenseCategories.includes(component.license.category)) {
        violations.push({
          type: 'license',
          severity: 'high',
          component: component.name,
          version: component.version,
          reason: `License ${component.license.id} is blocked by policy (category: ${component.license.category})`,
          recommendation: `Replace with a permissive-licensed alternative or obtain legal approval`,
        });
      }

      // Check if license is approved
      if (!component.license.isApproved && !activePolicy.allowUnknownLicenses) {
        violations.push({
          type: 'license',
          severity: 'medium',
          component: component.name,
          version: component.version,
          reason: `License ${component.license.id} is not approved`,
          recommendation: `Review license ${component.license.id} and update approval status`,
        });
      }

      // Vulnerability check via SbomService
      try {
        const vulnReport = await this.sbomService.getCachedVulnerabilities({
          name: component.name,
          version: component.version,
        });

        for (const vuln of vulnReport.vulnerabilities) {
          // Map 'info' severity to 'low' since ComplianceViolation doesn't support 'info'
          const normalizedVulnSeverity = vuln.severity === 'info' ? 'low' : vuln.severity;
          if (this.isSeverityAtLeast(normalizedVulnSeverity, activePolicy.maxVulnerabilitySeverity)) {
            violations.push({
              type: 'vulnerability',
              severity: normalizedVulnSeverity,
              component: component.name,
              version: component.version,
              reason: `CVE ${vuln.cveId}: ${vuln.description}`,
              recommendation: vuln.remediation ?? 'Upgrade to a patched version',
            });
          }
        }
      } catch (error) {
        logger.warn(
          { component: component.name, version: component.version, err: error instanceof Error ? error.message : String(error) },
          '[SupplyChain] Failed to check vulnerabilities for component',
        );
      }
    }

    const totalComponents = sbom.components.length;
    const licenseViolations = violations.filter(v => v.type === 'license').length;
    const vulnerabilityViolations = violations.filter(v => v.type === 'vulnerability').length;
    const signatureMissing = activePolicy.requireSignature ? totalComponents : 0; // Simplified

    const result: ComplianceResult = {
      compliant: violations.length === 0,
      policyId: activePolicy.id,
      violations,
      summary: {
        totalComponents,
        compliantComponents: totalComponents - new Set(violations.map(v => v.component)).size,
        nonCompliantComponents: new Set(violations.map(v => v.component)).size,
        licenseViolations,
        vulnerabilityViolations,
        signatureMissing,
      },
      checkedAt: new Date(),
    };

    logger.info(
      { sbomId: sbom.id, compliant: result.compliant, violationCount: violations.length },
      '[SupplyChain] Compliance check completed',
    );

    return result;
  }

  // ==================== Supply Chain Report ====================

  /**
   * 生成供应链安全报告
   */
  async generateReport(artifactId: string, sbom: SBOM): Promise<SupplyChainReport> {
    const compliance = await this.checkCompliance(sbom);

    const vulnerabilitySummary = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      total: 0,
    };

    for (const component of sbom.components) {
      try {
        const vulnReport = await this.sbomService.getCachedVulnerabilities({
          name: component.name,
          version: component.version,
        });

        for (const vuln of vulnReport.vulnerabilities) {
          // Map 'info' severity to 'low' since vulnerabilitySummary doesn't have 'info' key
          const sev = vuln.severity === 'info' ? 'low' : vuln.severity;
          vulnerabilitySummary[sev]++;
          vulnerabilitySummary.total++;
        }
      } catch {
        // Skip failed vulnerability checks
      }
    }

    // Calculate risk score (0-100)
    let riskScore = 0;
    riskScore += vulnerabilitySummary.critical * 15;
    riskScore += vulnerabilitySummary.high * 10;
    riskScore += vulnerabilitySummary.medium * 5;
    riskScore += vulnerabilitySummary.low * 2;
    riskScore += compliance.violations.filter(v => v.type === 'license').length * 10;
    riskScore = Math.min(100, riskScore);

    const report: SupplyChainReport = {
      artifactId,
      sbomCount: 1,
      componentCount: sbom.components.length,
      vulnerabilitySummary,
      complianceStatus: compliance.compliant ? 'compliant' : 'non-compliant',
      riskScore,
      generatedAt: new Date(),
    };

    logger.info(
      { artifactId, riskScore, compliant: compliance.compliant },
      '[SupplyChain] Supply chain report generated',
    );

    return report;
  }

  // ==================== Private Helpers ====================

  /**
   * 判断 severity A 是否大于等于 severity B
   */
  private isSeverityAtLeast(a: 'critical' | 'high' | 'medium' | 'low', b: 'critical' | 'high' | 'medium' | 'low' | 'info'): boolean {
    // Map 'info' to 'low' since it's the lowest meaningful severity
    const normalizedB = b === 'info' ? 'low' : b;
    const order: ('low' | 'medium' | 'high' | 'critical')[] = ['low', 'medium', 'high', 'critical'];
    return order.indexOf(a) >= order.indexOf(normalizedB);
  }
}

export default SupplyChainService;
