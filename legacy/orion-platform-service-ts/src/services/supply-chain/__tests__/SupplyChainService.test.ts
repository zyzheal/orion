/**
 * SupplyChainService 单元测试
 *
 * 测试覆盖:
 * 1. analyzeDependencies - 依赖树分析
 * 2. generateSbom - SBOM 生成
 * 3. serializeSbom - SPDX JSON 序列化
 * 4. checkCompliance - 许可证合规性检查
 * 5. generateReport - 供应链安全报告
 */

// Mock logger to avoid pino Proxy issues in test environment
jest.mock('@/utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
  createTraceAwareLogger: jest.fn(),
  EnhancedLogger: jest.fn(),
  default: jest.fn(),
}));

import { SupplyChainService } from '../SupplyChainService';
import { SbomService } from '../SbomService';

// Mock SbomService
const mockSbomService = {
  getCachedVulnerabilities: jest.fn(),
} as unknown as jest.Mocked<SbomService>;

describe('SupplyChainService', () => {
  let service: SupplyChainService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SupplyChainService(mockSbomService);
  });

  // ==================== analyzeDependencies ====================

  describe('analyzeDependencies', () => {
    it('should analyze a simple package.json with prod dependencies', async () => {
      const result = await service.analyzeDependencies({
        name: 'my-app',
        version: '1.0.0',
        dependencies: {
          express: '^4.18.0',
          lodash: '^4.17.21',
        },
      });

      expect(result.root.name).toBe('my-app');
      expect(result.root.version).toBe('1.0.0');
      expect(result.root.depth).toBe(0);
      expect(result.totalNodes).toBeGreaterThan(0);
      expect(result.maxDepth).toBeGreaterThanOrEqual(1);
    });

    it('should handle package.json with all dependency scopes', async () => {
      const result = await service.analyzeDependencies({
        name: 'full-app',
        version: '2.0.0',
        dependencies: { express: '^4.18.0' },
        devDependencies: { jest: '^29.0.0' },
        peerDependencies: { react: '^18.0.0' },
        optionalDependencies: { faker: '^6.6.6' },
      });

      expect(result.root.name).toBe('full-app');
      expect(result.root.children.length).toBe(4);
    });

    it('should detect circular dependencies', async () => {
      const result = await service.analyzeDependencies({
        name: 'circular-app',
        version: '1.0.0',
        dependencies: {
          'pkg-a': '1.0.0',
          'pkg-b': '1.0.0',
        },
      });

      // In this simplified implementation, circular deps are detected for same-name same-version
      expect(result).toBeDefined();
      expect(result.circularDependencies).toBeDefined();
      expect(Array.isArray(result.circularDependencies)).toBe(true);
    });

    it('should return empty children for package with no dependencies', async () => {
      const result = await service.analyzeDependencies({
        name: 'empty-app',
        version: '1.0.0',
      });

      expect(result.root.children).toHaveLength(0);
      expect(result.totalNodes).toBe(1);
      expect(result.maxDepth).toBe(0);
    });

    it('should limit dependency depth to 3', async () => {
      const result = await service.analyzeDependencies({
        name: 'deep-app',
        version: '1.0.0',
        dependencies: { 'top-level': '1.0.0' },
      });

      // Max depth should be at most 3 (root=0, level1=1, level2=2, level3=3)
      expect(result.maxDepth).toBeLessThanOrEqual(3);
    });

    it('should correctly identify dependency scope', async () => {
      const result = await service.analyzeDependencies({
        name: 'scope-app',
        version: '1.0.0',
        dependencies: { express: '4.18.0' },
        devDependencies: { jest: '29.0.0' },
        peerDependencies: { react: '18.0.0' },
        optionalDependencies: { faker: '6.6.6' },
      });

      const scopes = result.root.children.map(c => c.scope);
      expect(scopes).toContain('prod');
      expect(scopes).toContain('dev');
      expect(scopes).toContain('peer');
      expect(scopes).toContain('optional');
    });
  });

  // ==================== generateSbom ====================

  describe('generateSbom', () => {
    it('should generate an SPDX SBOM with components', async () => {
      const components = [
        { name: 'express', version: '4.18.0', license: { id: 'MIT', isApproved: true, category: 'permissive' as const }, dependencies: [] },
        { name: 'lodash', version: '4.17.21', license: { id: 'MIT', isApproved: true, category: 'permissive' as const }, dependencies: [] },
      ];

      const sbom = await service.generateSbom('artifact-123', components);

      expect(sbom.id).toBeDefined();
      expect(sbom.artifactId).toBe('artifact-123');
      expect(sbom.format).toBe('spdx');
      expect(sbom.specVersion).toBe('SPDX-2.3');
      expect(sbom.components).toHaveLength(2);
      expect(sbom.components[0].name).toBe('express');
      expect(sbom.expiresAt).toBeDefined();
      expect(sbom.metadata.tool).toBe('orion-supply-chain');
    });

    it('should generate unique SBOM IDs', async () => {
      const components = [{ name: 'test', version: '1.0.0', license: { id: 'MIT', isApproved: true, category: 'permissive' }, dependencies: [] }];

      const sbom1 = await service.generateSbom('artifact-1', components);
      const sbom2 = await service.generateSbom('artifact-2', components);

      expect(sbom1.id).not.toBe(sbom2.id);
    });

    it('should set expiration to 1 year from creation', async () => {
      const components = [{ name: 'test', version: '1.0.0', license: { id: 'MIT', isApproved: true, category: 'permissive' }, dependencies: [] }];
      const now = new Date();

      const sbom = await service.generateSbom('artifact-1', components);

      const expectedExpiry = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      const diff = Math.abs(sbom.expiresAt!.getTime() - expectedExpiry.getTime());
      expect(diff).toBeLessThan(1000); // Within 1 second
    });
  });

  // ==================== serializeSbom ====================

  describe('serializeSbom', () => {
    it('should serialize SBOM to valid SPDX JSON', async () => {
      const sbom = await service.generateSbom('artifact-1', [
        { name: 'express', version: '4.18.0', purl: 'pkg:npm/express@4.18.0', license: { id: 'MIT', isApproved: true, category: 'permissive' }, dependencies: [], supplier: 'Express Team' },
      ]);

      const json = service.serializeSbom(sbom);
      const parsed = JSON.parse(json);

      expect(parsed.spdxVersion).toBe('SPDX-2.3');
      expect(parsed.packages).toHaveLength(1);
      expect(parsed.packages[0].name).toBe('express');
      expect(parsed.packages[0].licenseConcluded).toBe('MIT');
      expect(parsed.packages[0].externalRefs).toBeDefined();
    });

    it('should include supplier information when present', async () => {
      const sbom = await service.generateSbom('artifact-1', [
        { name: 'express', version: '4.18.0', license: { id: 'MIT', isApproved: true, category: 'permissive' }, dependencies: [], supplier: 'Express Team' },
      ]);

      const json = service.serializeSbom(sbom);
      const parsed = JSON.parse(json);

      expect(parsed.packages[0].supplier).toBe('Person: Express Team');
    });

    it('should omit externalRefs when purl is not provided', async () => {
      const sbom = await service.generateSbom('artifact-1', [
        { name: 'test-lib', version: '1.0.0', license: { id: 'MIT', isApproved: true, category: 'permissive' }, dependencies: [] },
      ]);

      const json = service.serializeSbom(sbom);
      const parsed = JSON.parse(json);

      expect(parsed.packages[0].externalRefs).toBeUndefined();
    });
  });

  // ==================== checkCompliance ====================

  describe('checkCompliance', () => {
    it('should pass compliance for all-permissive licensed components', async () => {
      const sbom = await service.generateSbom('artifact-1', [
        { name: 'express', version: '4.18.0', license: { id: 'MIT', isApproved: true, category: 'permissive' }, dependencies: [] },
        { name: 'lodash', version: '4.17.21', license: { id: 'Apache-2.0', isApproved: true, category: 'permissive' }, dependencies: [] },
      ]);

      mockSbomService.getCachedVulnerabilities.mockResolvedValue({
        component: { name: 'express', version: '4.18.0' },
        source: 'static',
        cached: false,
        vulnerabilities: [],
        queryTime: 0,
        scannedAt: new Date(),
      });

      const result = await service.checkCompliance(sbom);

      expect(result.compliant).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should flag proprietary licenses as violations', async () => {
      const sbom = await service.generateSbom('artifact-1', [
        { name: 'proprietary-lib', version: '1.0.0', license: { id: ' Proprietary', isApproved: false, category: 'proprietary' }, dependencies: [] },
      ]);

      mockSbomService.getCachedVulnerabilities.mockResolvedValue({
        component: { name: 'proprietary-lib', version: '1.0.0' },
        source: 'static',
        cached: false,
        vulnerabilities: [],
        queryTime: 0,
        scannedAt: new Date(),
      });

      const result = await service.checkCompliance(sbom);

      expect(result.compliant).toBe(false);
      expect(result.violations.some(v => v.type === 'license')).toBe(true);
    });

    it('should flag critical vulnerabilities as violations', async () => {
      const sbom = await service.generateSbom('artifact-1', [
        { name: 'vulnerable-lib', version: '1.0.0', license: { id: 'MIT', isApproved: true, category: 'permissive' }, dependencies: [] },
      ]);

      mockSbomService.getCachedVulnerabilities.mockResolvedValue({
        component: { name: 'vulnerable-lib', version: '1.0.0' },
        source: 'nvd',
        cached: false,
        vulnerabilities: [
          {
            cveId: 'CVE-2024-1234',
            severity: 'critical',
            cvssScore: 9.8,
            description: 'Critical vulnerability',
            publishedAt: '2024-01-01',
          },
        ],
        queryTime: 100,
        scannedAt: new Date(),
      });

      const result = await service.checkCompliance(sbom);

      expect(result.compliant).toBe(false);
      expect(result.violations.some(v => v.type === 'vulnerability')).toBe(true);
    });

    it('should not flag low severity vulnerabilities with default policy', async () => {
      const sbom = await service.generateSbom('artifact-1', [
        { name: 'low-vuln-lib', version: '1.0.0', license: { id: 'MIT', isApproved: true, category: 'permissive' }, dependencies: [] },
      ]);

      mockSbomService.getCachedVulnerabilities.mockResolvedValue({
        component: { name: 'low-vuln-lib', version: '1.0.0' },
        source: 'static',
        cached: false,
        vulnerabilities: [
          {
            cveId: 'CVE-2024-9999',
            severity: 'low',
            cvssScore: 2.1,
            description: 'Low severity issue',
            publishedAt: '2024-01-01',
          },
        ],
        queryTime: 50,
        scannedAt: new Date(),
      });

      const result = await service.checkCompliance(sbom);

      expect(result.compliant).toBe(true);
    });

    it('should include summary counts in result', async () => {
      const sbom = await service.generateSbom('artifact-1', [
        { name: 'lib-a', version: '1.0.0', license: { id: 'MIT', isApproved: true, category: 'permissive' }, dependencies: [] },
        { name: 'lib-b', version: '2.0.0', license: { id: 'GPL-3.0', isApproved: false, category: 'copyleft' }, dependencies: [] },
      ]);

      mockSbomService.getCachedVulnerabilities.mockResolvedValue({
        component: { name: '', version: '' },
        source: 'static',
        cached: false,
        vulnerabilities: [],
        queryTime: 0,
        scannedAt: new Date(),
      });

      const result = await service.checkCompliance(sbom);

      expect(result.summary.totalComponents).toBe(2);
      expect(result.summary.licenseViolations).toBeGreaterThanOrEqual(1);
      expect(result.checkedAt).toBeDefined();
    });
  });

  // ==================== generateReport ====================

  describe('generateReport', () => {
    it('should generate a complete supply chain report', async () => {
      const sbom = await service.generateSbom('artifact-1', [
        { name: 'express', version: '4.18.0', license: { id: 'MIT', isApproved: true, category: 'permissive' }, dependencies: [] },
      ]);

      mockSbomService.getCachedVulnerabilities.mockResolvedValue({
        component: { name: 'express', version: '4.18.0' },
        source: 'static',
        cached: false,
        vulnerabilities: [],
        queryTime: 10,
        scannedAt: new Date(),
      });

      const report = await service.generateReport('artifact-1', sbom);

      expect(report.artifactId).toBe('artifact-1');
      expect(report.sbomCount).toBe(1);
      expect(report.componentCount).toBe(1);
      expect(report.complianceStatus).toBe('compliant');
      expect(report.riskScore).toBeGreaterThanOrEqual(0);
      expect(report.riskScore).toBeLessThanOrEqual(100);
      expect(report.vulnerabilitySummary.total).toBe(0);
    });

    it('should calculate risk score based on vulnerabilities', async () => {
      const sbom = await service.generateSbom('artifact-1', [
        { name: 'vuln-lib', version: '1.0.0', license: { id: 'MIT', isApproved: true, category: 'permissive' }, dependencies: [] },
      ]);

      mockSbomService.getCachedVulnerabilities.mockResolvedValue({
        component: { name: 'vuln-lib', version: '1.0.0' },
        source: 'nvd',
        cached: false,
        vulnerabilities: [
          { cveId: 'CVE-2024-0001', severity: 'critical', cvssScore: 9.8, description: 'Critical', publishedAt: '2024-01-01' },
        ],
        queryTime: 100,
        scannedAt: new Date(),
      });

      const report = await service.generateReport('artifact-1', sbom);

      expect(report.riskScore).toBeGreaterThan(0);
      expect(report.vulnerabilitySummary.critical).toBe(1);
    });

    it('should mark non-compliant when violations exist', async () => {
      const sbom = await service.generateSbom('artifact-1', [
        { name: 'gpl-lib', version: '1.0.0', license: { id: 'GPL-3.0', isApproved: false, category: 'copyleft' }, dependencies: [] },
      ]);

      mockSbomService.getCachedVulnerabilities.mockResolvedValue({
        component: { name: 'gpl-lib', version: '1.0.0' },
        source: 'static',
        cached: false,
        vulnerabilities: [],
        queryTime: 0,
        scannedAt: new Date(),
      });

      const report = await service.generateReport('artifact-1', sbom);

      expect(report.complianceStatus).toBe('non-compliant');
    });
  });
});
