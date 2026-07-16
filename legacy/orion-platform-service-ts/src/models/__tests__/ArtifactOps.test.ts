/**
 * ArtifactOps 模型测试
 */
import {
  createArtifactOperation,
  createRetentionPolicy,
  createScanResult,
  ArtifactOperationType,
} from '../ArtifactOps';

describe('ArtifactOps', () => {
  describe('createArtifactOperation', () => {
    it('should create operation with required fields', () => {
      const op = createArtifactOperation('t1', 'a1', ArtifactOperationType.UPLOAD, 'user1');

      expect(op.id).toBeDefined();
      expect(op.tenant_id).toBe('t1');
      expect(op.artifact_id).toBe('a1');
      expect(op.operation_type).toBe('upload');
      expect(op.performed_by).toBe('user1');
      expect(op.details).toEqual({});
      expect(op.ip_address).toBeNull();
      expect(op.created_at).toBeInstanceOf(Date);
    });

    it('should accept details and ipAddress', () => {
      const op = createArtifactOperation(
        't1', 'a1', ArtifactOperationType.DOWNLOAD, 'user1',
        { size: 1024 }, '10.0.0.1'
      );

      expect(op.details).toEqual({ size: 1024 });
      expect(op.ip_address).toBe('10.0.0.1');
    });
  });

  describe('createRetentionPolicy', () => {
    it('should create policy with defaults', () => {
      const policy = createRetentionPolicy('t1', {
        name: 'default-retention',
        retention_days: 30,
      });

      expect(policy.id).toBeDefined();
      expect(policy.tenant_id).toBe('t1');
      expect(policy.name).toBe('default-retention');
      expect(policy.description).toBe('');
      expect(policy.retention_days).toBe(30);
      expect(policy.max_versions).toBe(10);
      expect(policy.max_size_bytes).toBe(10 * 1024 * 1024 * 1024);
      expect(policy.action_on_expire).toBe('delete');
      expect(policy.enabled).toBe(true);
      expect(policy.created_by).toBe('system');
    });

    it('should accept custom values', () => {
      const policy = createRetentionPolicy('t1', {
        name: 'custom',
        retention_days: 90,
        max_versions: 5,
        max_size_bytes: 1024,
        action_on_expire: 'archive',
        created_by: 'admin',
      });

      expect(policy.max_versions).toBe(5);
      expect(policy.max_size_bytes).toBe(1024);
      expect(policy.action_on_expire).toBe('archive');
      expect(policy.created_by).toBe('admin');
    });
  });

  describe('createScanResult', () => {
    it('should create pending scan result', () => {
      const result = createScanResult('t1', 'a1', 'trivy', 'scanner');

      expect(result.id).toBeDefined();
      expect(result.tenant_id).toBe('t1');
      expect(result.artifact_id).toBe('a1');
      expect(result.scan_type).toBe('trivy');
      expect(result.status).toBe('pending');
      expect(result.vulnerabilities).toEqual([]);
      expect(result.malicious).toBe(false);
      expect(result.malicious_reason).toBeNull();
      expect(result.scanned_by).toBe('scanner');
    });
  });

  describe('ArtifactOperationType enum', () => {
    it('should have all expected values', () => {
      expect(ArtifactOperationType.UPLOAD).toBe('upload');
      expect(ArtifactOperationType.DOWNLOAD).toBe('download');
      expect(ArtifactOperationType.DELETE).toBe('delete');
      expect(ArtifactOperationType.SCAN).toBe('scan');
      expect(ArtifactOperationType.PROMOTE).toBe('promote');
      expect(ArtifactOperationType.QUARANTINE).toBe('quarantine');
    });
  });
});
