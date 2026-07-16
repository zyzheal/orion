/**
 * QualityGate 模型测试
 */
import { createQualityGate } from '../QualityGate';

describe('QualityGate', () => {
  describe('createQualityGate', () => {
    it('should create gate with required fields', () => {
      const gate = createQualityGate({
        tenantId: 't1',
        name: 'code-quality',
        rules: [
          { metric: 'coverage', operator: '>=', threshold: 80, severity: 'block' },
          { metric: 'complexity', operator: '<=', threshold: 20, severity: 'warn' },
        ],
      });

      expect(gate.id).toBeDefined();
      expect(gate.tenantId).toBe('t1');
      expect(gate.name).toBe('code-quality');
      expect(gate.rules).toHaveLength(2);
      expect(gate.rules[0].metric).toBe('coverage');
      expect(gate.rules[0].operator).toBe('>=');
      expect(gate.rules[0].threshold).toBe(80);
      expect(gate.rules[0].severity).toBe('block');
      expect(gate.enabled).toBe(true);
      expect(gate.createdAt).toBeInstanceOf(Date);
      expect(gate.updatedAt).toBeInstanceOf(Date);
    });

    it('should accept description', () => {
      const gate = createQualityGate({
        tenantId: 't1',
        name: 'gate',
        description: 'Quality gate for production',
        rules: [],
      });

      expect(gate.description).toBe('Quality gate for production');
    });

    it('should accept externalProvider', () => {
      const gate = createQualityGate({
        tenantId: 't1',
        name: 'sonar-gate',
        rules: [],
        externalProvider: {
          type: 'sonarqube',
          url: 'https://sonar.example.com',
          apiKey: 'key123',
        },
      });

      expect(gate.externalProvider?.type).toBe('sonarqube');
      expect(gate.externalProvider?.url).toBe('https://sonar.example.com');
    });

    it('should default enabled to true', () => {
      const gate = createQualityGate({
        tenantId: 't1',
        name: 'gate',
        rules: [],
        enabled: false,
      });

      expect(gate.enabled).toBe(false);
    });
  });
});
