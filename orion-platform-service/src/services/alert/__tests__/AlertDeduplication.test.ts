/**
 * AlertDeduplication 单元测试
 */

import { AlertDeduplication } from '../AlertDeduplication';
import {
  Alert,
  AlertSeverity,
  AlertStatus,
  AlertSourceType,
} from '../AlertTypes';

describe('AlertDeduplication', () => {
  let deduplication: AlertDeduplication;

  beforeEach(() => {
    deduplication = new AlertDeduplication();
    deduplication.clearAll();
  });

  afterEach(() => {
    deduplication.stop();
  });

  describe('generateFingerprint', () => {
    it('should generate consistent fingerprint for same alert', () => {
      const alert: Partial<Alert> = {
        name: 'HighCPUUsage',
        sourceType: AlertSourceType.NODE,
        sourceId: 'node-001',
        labels: { severity: 'high', region: 'us-east' },
      };

      const fingerprint1 = deduplication.generateFingerprint(alert);
      const fingerprint2 = deduplication.generateFingerprint(alert);

      expect(fingerprint1.fingerprint).toBe(fingerprint2.fingerprint);
      expect(fingerprint1.fingerprint.length).toBe(32);
    });

    it('should generate different fingerprints for different alerts', () => {
      const alert1: Partial<Alert> = {
        name: 'HighCPUUsage',
        sourceType: AlertSourceType.NODE,
        sourceId: 'node-001',
        labels: { severity: 'high' },
      };

      const alert2: Partial<Alert> = {
        name: 'HighMemoryUsage',
        sourceType: AlertSourceType.NODE,
        sourceId: 'node-001',
        labels: { severity: 'high' },
      };

      const fingerprint1 = deduplication.generateFingerprint(alert1);
      const fingerprint2 = deduplication.generateFingerprint(alert2);

      expect(fingerprint1.fingerprint).not.toBe(fingerprint2.fingerprint);
    });

    it('should generate same fingerprint regardless of label order', () => {
      const alert1: Partial<Alert> = {
        name: 'HighCPUUsage',
        sourceType: AlertSourceType.NODE,
        sourceId: 'node-001',
        labels: { severity: 'high', region: 'us-east' },
      };

      const alert2: Partial<Alert> = {
        name: 'HighCPUUsage',
        sourceType: AlertSourceType.NODE,
        sourceId: 'node-001',
        labels: { region: 'us-east', severity: 'high' }, // Different order
      };

      const fingerprint1 = deduplication.generateFingerprint(alert1);
      const fingerprint2 = deduplication.generateFingerprint(alert2);

      expect(fingerprint1.fingerprint).toBe(fingerprint2.fingerprint);
    });
  });

  describe('isDuplicate', () => {
    it('should detect duplicate alert within window', () => {
      const fingerprint = 'test-fingerprint-001';

      // Record fingerprint
      deduplication.recordFingerprint(fingerprint);

      // Should be duplicate
      expect(deduplication.isDuplicate(fingerprint)).toBe(true);
    });

    it('should not detect duplicate for new fingerprint', () => {
      const fingerprint = 'new-fingerprint-001';

      expect(deduplication.isDuplicate(fingerprint)).toBe(false);
    });
  });

  describe('processAlert', () => {
    const createAlert = (id: string, name: string, sourceId: string): Alert => ({
      id,
      fingerprint: '',
      name,
      severity: AlertSeverity.HIGH,
      status: AlertStatus.FIRING,
      sourceType: AlertSourceType.NODE,
      sourceId,
      sourceName: `Node ${sourceId}`,
      labels: { severity: 'high' },
      annotations: {},
      value: 80,
      threshold: 70,
      startsAt: new Date(),
      tenantId: 'tenant-001',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    it('should create new group for first alert', () => {
      const alert = createAlert('alert-001', 'HighCPU', 'node-001');

      const result = deduplication.processAlert(alert);

      expect(result.action).toBe('create');
      expect(result.isDuplicate).toBe(false);
      expect(result.group.count).toBe(1);
      expect(result.group.alerts).toHaveLength(1);
    });

    it('should update group for subsequent alert with same fingerprint', () => {
      const alert1 = createAlert('alert-001', 'HighCPU', 'node-001');
      const alert2 = createAlert('alert-002', 'HighCPU', 'node-001');

      // First alert
      deduplication.processAlert(alert1);

      // Second alert (should be duplicate)
      const result = deduplication.processAlert(alert2);

      expect(result.action).toBe('suppress');
      expect(result.isDuplicate).toBe(true);
      expect(result.group.count).toBe(2);
    });

    it('should create separate groups for different fingerprints', () => {
      const alert1 = createAlert('alert-001', 'HighCPU', 'node-001');
      const alert2 = createAlert('alert-002', 'HighMemory', 'node-001');

      const result1 = deduplication.processAlert(alert1);
      const result2 = deduplication.processAlert(alert2);

      expect(result1.group.fingerprint).not.toBe(result2.group.fingerprint);
      expect(result1.group.count).toBe(1);
      expect(result2.group.count).toBe(1);
    });
  });

  describe('batchProcess', () => {
    it('should correctly count duplicates and new alerts', () => {
      const alerts: Alert[] = [
        {
          id: 'alert-001',
          fingerprint: '',
          name: 'HighCPU',
          severity: AlertSeverity.HIGH,
          status: AlertStatus.FIRING,
          sourceType: AlertSourceType.NODE,
          sourceId: 'node-001',
          sourceName: 'Node 001',
          labels: { severity: 'high' },
          annotations: {},
          value: 80,
          threshold: 70,
          startsAt: new Date(),
          tenantId: 'tenant-001',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'alert-002',
          fingerprint: '',
          name: 'HighCPU', // Same name
          severity: AlertSeverity.HIGH,
          status: AlertStatus.FIRING,
          sourceType: AlertSourceType.NODE,
          sourceId: 'node-001', // Same source
          labels: { severity: 'high' }, // Same labels
          annotations: {},
          value: 85,
          threshold: 70,
          startsAt: new Date(),
          tenantId: 'tenant-001',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'alert-003',
          fingerprint: '',
          name: 'HighMemory', // Different name
          severity: AlertSeverity.HIGH,
          status: AlertStatus.FIRING,
          sourceType: AlertSourceType.NODE,
          sourceId: 'node-001',
          labels: { severity: 'high' },
          annotations: {},
          value: 90,
          threshold: 80,
          startsAt: new Date(),
          tenantId: 'tenant-001',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const result = deduplication.batchProcess(alerts);

      expect(result.newAlerts).toBe(2); // HighCPU (first) and HighMemory
      expect(result.duplicates).toBe(1); // HighCPU (second)
      expect(result.suppressed).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      const alert: Alert = {
        id: 'alert-001',
        fingerprint: '',
        name: 'HighCPU',
        severity: AlertSeverity.HIGH,
        status: AlertStatus.FIRING,
        sourceType: AlertSourceType.NODE,
        sourceId: 'node-001',
        sourceName: 'Node 001',
        labels: {},
        annotations: {},
        value: 80,
        threshold: 70,
        startsAt: new Date(),
        tenantId: 'tenant-001',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      deduplication.processAlert(alert);

      const stats = deduplication.getStats();

      expect(stats.totalGroups).toBe(1);
      expect(stats.totalAlerts).toBe(1);
      expect(stats.topFingerprints).toHaveLength(1);
    });
  });

  describe('getActiveGroups', () => {
    it('should filter groups by minCount', () => {
      // Create multiple alerts with same fingerprint
      for (let i = 0; i < 3; i++) {
        deduplication.processAlert({
          id: `alert-${i}`,
          fingerprint: '',
          name: 'HighCPU',
          severity: AlertSeverity.HIGH,
          status: AlertStatus.FIRING,
          sourceType: AlertSourceType.NODE,
          sourceId: 'node-001',
          sourceName: 'Node 001',
          labels: {},
          annotations: {},
          value: 80,
          threshold: 70,
          startsAt: new Date(),
          tenantId: 'tenant-001',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Create single alert with different fingerprint
      deduplication.processAlert({
        id: 'alert-single',
        fingerprint: '',
        name: 'HighMemory',
        severity: AlertSeverity.HIGH,
        status: AlertStatus.FIRING,
        sourceType: AlertSourceType.NODE,
        sourceId: 'node-001',
        sourceName: 'Node 001',
        labels: {},
        annotations: {},
        value: 90,
        threshold: 80,
        startsAt: new Date(),
        tenantId: 'tenant-001',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const groups = deduplication.getActiveGroups({ minCount: 2 });

      expect(groups).toHaveLength(1);
      expect(groups[0].count).toBe(3);
    });
  });

  describe('cleanup', () => {
    it('should remove expired fingerprints', async () => {
      // Create deduplication with short window for testing
      const shortDedup = new AlertDeduplication({
        deduplicationWindowMs: 100, // 100ms window
      });

      shortDedup.recordFingerprint('test-fp');

      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should not be duplicate anymore
      expect(shortDedup.isDuplicate('test-fp')).toBe(false);

      shortDedup.stop();
    });
  });
});