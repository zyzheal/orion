/**
 * BuildAttestationService - SLSA 构建证明单元测试
 *
 * 测试覆盖: 生成证明、存储证明、验证证明、供应链安全评分
 */

import { BuildAttestationService, BuildConfig } from '../BuildAttestationService';

describe('BuildAttestationService', () => {
  let service: BuildAttestationService;
  let mockPool: { query: jest.Mock };

  const sampleBuildConfig: BuildConfig = {
    sourceUri: 'https://github.com/org/repo',
    commitHash: 'abc123def456',
    branch: 'main',
    pipelineId: 'pipe-1',
    buildId: 'build-1',
    serviceName: 'my-service',
    environment: 'production',
    triggeredBy: 'user-1',
    buildStartTime: new Date('2026-01-01T10:00:00'),
    buildEndTime: new Date('2026-01-01T10:05:00'),
    buildSteps: [
      { name: 'checkout', command: 'git checkout', startTime: new Date(), endTime: new Date(), exitCode: 0 },
      { name: 'build', command: 'npm run build', startTime: new Date(), endTime: new Date(), exitCode: 0 },
      { name: 'install', command: 'npm install', startTime: new Date(), endTime: new Date(), exitCode: 0 },
    ],
    environmentVariables: ['NODE_ENV=production'],
    artifactUri: 'registry.example.com/my-service:v1.0',
    artifactDigest: { sha256: 'deadbeef' },
  };

  beforeEach(() => {
    mockPool = { query: jest.fn() };
    service = new BuildAttestationService(mockPool as any);
  });

  // ==================== generateProvenance ====================

  describe('generateProvenance', () => {
    it('should generate SLSA provenance', async () => {
      const result = await service.generateProvenance('t-1', sampleBuildConfig);

      expect(result._type).toBe('https://slsa.dev/provenance/v0.2');
      expect(result.subject).toHaveLength(1);
      expect(result.subject[0].name).toBe('my-service:v1.0');
      expect(result.subject[0].digest.sha256).toBeDefined();
      expect(result.buildType).toBe('https://orion.dev/build/v1');
      expect(result.builder.id).toBe('orion-platform');
      expect(result.builder.version).toBe('3.0.0');
      expect(result.builder.builderType).toBe('tekton-pipeline');
      expect(result.invocation.configSource.uri).toBe(sampleBuildConfig.sourceUri);
      expect(result.invocation.configSource.digest.gitCommit).toBe('abc123def456');
      expect(result.buildConfig.pipelineId).toBe('pipe-1');
      expect(result.buildConfig.buildId).toBe('build-1');
      expect(result.metadata.buildInvocationId).toBe('build-1');
      expect(result.metadata.completeness.parameters).toBe(true);
      expect(result.metadata.reproducible).toBe(true);
    });

    it('should include materials with source and npm', async () => {
      const result = await service.generateProvenance('t-1', sampleBuildConfig);

      expect(result.materials.length).toBeGreaterThanOrEqual(2);
      expect(result.materials[0].uri).toBe('https://github.com/org/repo');
      expect(result.materials.some(m => m.uri === 'npm://registry.npmjs.org')).toBe(true);
    });

    it('should handle artifact URI without path', async () => {
      const config = { ...sampleBuildConfig, artifactUri: 'my-service' };
      const result = await service.generateProvenance('t-1', config);

      expect(result.subject[0].name).toBe('my-service');
    });
  });

  // ==================== storeAttestation ====================

  describe('storeAttestation', () => {
    it('should store attestation', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'att-1', build_id: 'build-1', tenant_id: 't-1',
          service_name: 'my-service', provenance_type: 'https://slsa.dev/provenance/v0.2',
          provenance: { _type: 'https://slsa.dev/provenance/v0.2' },
          signature: 'abc123', verified: true, created_at: new Date(),
        }],
      });

      const provenance = await service.generateProvenance('t-1', sampleBuildConfig);
      const result = await service.storeAttestation('t-1', 'build-1', 'my-service', provenance);

      expect(result).toBeDefined();
      expect(result.build_id).toBe('build-1');
      expect(result.verified).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO build_attestations'),
        expect.arrayContaining(['build-1', 't-1', 'my-service'])
      );
    });
  });

  // ==================== generateAndStoreAttestation ====================

  describe('generateAndStoreAttestation', () => {
    it('should generate and store in one call', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'att-1', build_id: 'build-1', tenant_id: 't-1',
          service_name: 'my-service', provenance_type: 'https://slsa.dev/provenance/v0.2',
          provenance: {}, signature: 'abc', verified: true, created_at: new Date(),
        }],
      });

      const result = await service.generateAndStoreAttestation('t-1', sampleBuildConfig);

      expect(result).toBeDefined();
      expect(result.build_id).toBe('build-1');
    });
  });

  // ==================== getAttestation ====================

  describe('getAttestation', () => {
    it('should return attestation by build id', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'att-1', build_id: 'build-1', tenant_id: 't-1',
          service_name: 'my-service', provenance_type: 'slsa',
          provenance: { _type: 'slsa' }, signature: 'abc', verified: true, created_at: new Date(),
        }],
      });

      const result = await service.getAttestation('build-1');

      expect(result).toBeDefined();
      expect(result!.build_id).toBe('build-1');
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.getAttestation('non-existent');

      expect(result).toBeNull();
    });
  });

  // ==================== listAttestations ====================

  describe('listAttestations', () => {
    it('should list attestations for tenant', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 'att-1', build_id: 'build-1', tenant_id: 't-1', service_name: 'svc-1', provenance_type: 'slsa', provenance: {}, signature: 'a', verified: true, created_at: new Date() },
          { id: 'att-2', build_id: 'build-2', tenant_id: 't-1', service_name: 'svc-2', provenance_type: 'slsa', provenance: {}, signature: 'b', verified: true, created_at: new Date() },
        ],
      });

      const result = await service.listAttestations('t-1');

      expect(result).toHaveLength(2);
    });

    it('should filter by service name', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await service.listAttestations('t-1', { serviceName: 'my-service' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('service_name = $2'),
        expect.arrayContaining(['t-1', 'my-service'])
      );
    });

    it('should apply limit', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await service.listAttestations('t-1', { limit: 5 });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining(['t-1', 5])
      );
    });
  });

  // ==================== verifyAttestation ====================

  describe('verifyAttestation', () => {
    it('should verify valid attestation', async () => {
      const provenance = await service.generateProvenance('t-1', sampleBuildConfig);
      const signature = require('crypto').createHash('sha256').update(JSON.stringify(provenance)).digest('hex');

      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'att-1', build_id: 'build-1', tenant_id: 't-1',
          service_name: 'my-service', provenance_type: 'slsa',
          provenance, signature, verified: true, created_at: new Date(),
        }],
      });

      const result = await service.verifyAttestation('build-1');

      expect(result.verified).toBe(true);
      expect(result.provenance_valid).toBe(true);
      expect(result.signature_valid).toBe(true);
      expect(result.materials_verified).toBe(true);
      expect(result.issues).toEqual([]);
    });

    it('should fail when attestation not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.verifyAttestation('non-existent');

      expect(result.verified).toBe(false);
      expect(result.issues).toContain('Attestation not found');
    });

    it('should fail when signature is invalid', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'att-1', build_id: 'build-1', tenant_id: 't-1',
          service_name: 'my-service', provenance_type: 'slsa',
          provenance: { _type: 'slsa', subject: [{ name: 'test', digest: { sha256: 'a' } }], builder: {}, invocation: {}, metadata: {}, materials: [] },
          signature: 'invalid-signature', verified: true, created_at: new Date(),
        }],
      });

      const result = await service.verifyAttestation('build-1');

      expect(result.signature_valid).toBe(false);
      expect(result.issues).toContain('Signature verification failed');
    });
  });

  // ==================== getSupplyChainSecurityScore ====================

  describe('getSupplyChainSecurityScore', () => {
    it('should calculate security score', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ total: '10' }] }) // total builds
        .mockResolvedValueOnce({ rows: [{ attested: '8' }] }) // attested
        .mockResolvedValueOnce({ rows: [{ verified: '7' }] }); // verified

      const result = await service.getSupplyChainSecurityScore('t-1');

      expect(result.attestation_coverage).toBe(0.8); // 8/10
      expect(result.signature_rate).toBeCloseTo(0.875); // 7/8
      expect(result.overall_score).toBe(Math.round(0.8 * 50 + 0.875 * 50));
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should handle zero builds', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })
        .mockResolvedValueOnce({ rows: [{ attested: '0' }] })
        .mockResolvedValueOnce({ rows: [{ verified: '0' }] });

      const result = await service.getSupplyChainSecurityScore('t-1');

      expect(result.overall_score).toBe(0);
      expect(result.attestation_coverage).toBe(0);
    });

    it('should give excellent recommendation when score >= 90', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ total: '100' }] })
        .mockResolvedValueOnce({ rows: [{ attested: '95' }] })
        .mockResolvedValueOnce({ rows: [{ verified: '95' }] });

      const result = await service.getSupplyChainSecurityScore('t-1');

      expect(result.recommendations).toContainEqual(expect.stringContaining('excellent'));
    });
  });

  // ==================== Error Propagation ====================

  describe('error propagation', () => {
    it('should propagate database errors', async () => {
      mockPool.query.mockRejectedValue(new Error('Connection refused'));

      await expect(service.getAttestation('build-1')).rejects.toThrow('Connection refused');
    });
  });
});
