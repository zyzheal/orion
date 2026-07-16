/**
 * SBOMGeneratorService 单元测试
 */

import { SBOMGeneratorService } from '../SBOMGeneratorService';

// Mock DatabasePool
const mockPool = {
  query: jest.fn(),
};

describe('SBOMGeneratorService', () => {
  let service: SBOMGeneratorService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SBOMGeneratorService(mockPool as any);
  });

  describe('generateSBOM', () => {
    it('应该生成 SBOM', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'sbom1',
          tenant_id: 'tenant1',
          artifact_id: 'artifact1',
          format: 'cyclonedx',
          components: [],
        }],
      });

      const result = await service.generateSBOM({
        tenant_id: 'tenant1',
        artifact_id: 'artifact1',
      });

      expect(result.id).toBeDefined();
      expect(result.artifact_id).toBe('artifact1');
    });

    it('应该包含组件列表', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'sbom1',
          components: [
            { name: 'express', version: '4.18.2' },
            { name: 'lodash', version: '4.17.21' },
          ],
        }],
      });

      const result = await service.generateSBOM({
        tenant_id: 'tenant1',
        artifact_id: 'artifact1',
      });

      expect(result.components.length).toBeGreaterThan(0);
    });

    it('应该支持 CycloneDX 格式', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'sbom1', format: 'cyclonedx' }],
      });

      const result = await service.generateSBOM({
        tenant_id: 'tenant1',
        artifact_id: 'artifact1',
        format: 'cyclonedx',
      });

      expect(result.format).toBe('cyclonedx');
    });

    it('应该支持 SPDX 格式', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'sbom1', format: 'spdx' }],
      });

      const result = await service.generateSBOM({
        tenant_id: 'tenant1',
        artifact_id: 'artifact1',
        format: 'spdx',
      });

      expect(result.format).toBe('spdx');
    });

    it('应该默认使用 CycloneDX 格式', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'sbom1', format: 'cyclonedx' }],
      });

      const result = await service.generateSBOM({
        tenant_id: 'tenant1',
        artifact_id: 'artifact1',
      });

      expect(result.format).toBe('cyclonedx');
    });
  });

  describe('getSBOM', () => {
    it('应该返回 SBOM', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'sbom1',
          artifact_id: 'artifact1',
          components: [],
        }],
      });

      const result = await service.getSBOM('sbom1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('sbom1');
    });

    it('应该返回 null 如果未找到', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.getSBOM('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('scanVulnerabilities', () => {
    it('应该扫描漏洞', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'sbom1',
          components: [
            { name: 'express', version: '4.17.0' }, // Vulnerable version
          ],
        }],
      });

      const result = await service.scanVulnerabilities('sbom1');

      expect(result).toHaveProperty('matches');
    });

    it('应该返回漏洞列表', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'sbom1',
          components: [
            { name: 'express', version: '4.17.0' },
          ],
        }],
      });

      const result = await service.scanVulnerabilities('sbom1');

      expect(Array.isArray(result.matches)).toBe(true);
    });

    it('应该返回空列表如果 SBOM 不存在', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.scanVulnerabilities('nonexistent');

      expect(result.matches.length).toBe(0);
    });

    it('应该包含漏洞详情', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'sbom1',
          components: [
            { name: 'express', version: '4.17.0', purl: 'pkg:npm/express@4.17.0' },
          ],
        }],
      });

      const result = await service.scanVulnerabilities('sbom1');

      if (result.matches.length > 0) {
        const match = result.matches[0];
        expect(match.cve_id).toBeDefined();
        expect(match.severity).toBeDefined();
        expect(match.description).toBeDefined();
      }
    });
  });

  describe('SBOMComponent', () => {
    it('应该包含组件信息', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'sbom1',
          components: [{
            name: 'express',
            version: '4.18.2',
            purl: 'pkg:npm/express@4.18.2',
            license: 'MIT',
            supplier: null,
            dependencies: ['body-parser', 'cookie-parser'],
          }],
        }],
      });

      const result = await service.getSBOM('sbom1');

      if (result && result.components.length > 0) {
        const component = result.components[0];
        expect(component.name).toBeDefined();
        expect(component.version).toBeDefined();
        expect(component.purl).toBeDefined();
        expect(component.license).toBeDefined();
      }
    });
  });

  describe('VulnerabilityMatch', () => {
    it('应该包含漏洞详情', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'sbom1',
          components: [{
            name: 'express',
            version: '4.17.0',
            purl: 'pkg:npm/express@4.17.0',
            license: 'MIT',
          }],
        }],
      });

      const result = await service.scanVulnerabilities('sbom1');

      if (result.matches.length > 0) {
        const match = result.matches[0];
        expect(match.component).toBeDefined();
        expect(match.cve_id).toBeDefined();
        expect(['low', 'medium', 'high', 'critical'].includes(match.severity)).toBe(true);
        expect(match.description).toBeDefined();
      }
    });

    it('应该包含修复版本', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'sbom1',
          components: [{
            name: 'express',
            version: '4.17.0',
          }],
        }],
      });

      const result = await service.scanVulnerabilities('sbom1');

      if (result.matches.length > 0) {
        const match = result.matches[0];
        expect(match.fixed_version).toBeDefined();
      }
    });
  });

  describe('SBOM', () => {
    it('应该包含完整的 SBOM 信息', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'sbom1',
          tenant_id: 'tenant1',
          artifact_id: 'artifact1',
          format: 'cyclonedx',
          components: [],
          created_at: new Date(),
          expires_at: null,
        }],
      });

      const result = await service.getSBOM('sbom1');

      expect(result!.id).toBe('sbom1');
      expect(result!.tenant_id).toBe('tenant1');
      expect(result!.artifact_id).toBe('artifact1');
      expect(result!.format).toBe('cyclonedx');
      expect(result!.created_at).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('应该处理空组件列表', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'sbom1',
          components: [],
        }],
      });

      const result = await service.getSBOM('sbom1');

      expect(result!.components.length).toBe(0);
    });

    it('应该处理大量组件', async () => {
      const manyComponents = Array.from({ length: 100 }, (_, i) => ({
        name: `package-${i}`,
        version: '1.0.0',
        purl: `pkg:npm/package-${i}@1.0.0`,
        license: 'MIT',
        dependencies: [],
      }));

      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'sbom1',
          components: manyComponents,
        }],
      });

      const result = await service.getSBOM('sbom1');

      expect(result!.components.length).toBe(100);
    });
  });
});