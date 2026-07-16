/**
 * Environment 模型测试
 */
import { createEnvironment, mergeVariables } from '../Environment';

describe('Environment', () => {
  describe('createEnvironment', () => {
    it('should create environment with defaults', () => {
      const env = createEnvironment({
        tenantId: 't1',
        name: 'development',
      });

      expect(env.id).toBeDefined();
      expect(env.tenantId).toBe('t1');
      expect(env.name).toBe('development');
      expect(env.order).toBe(0);
      expect(env.variables).toEqual({});
      expect(env.approvalRequired).toBe(false);
      expect(env.approvalCount).toBe(1);
      expect(env.createdAt).toBeInstanceOf(Date);
      expect(env.updatedAt).toBeInstanceOf(Date);
    });

    it('should accept custom values', () => {
      const env = createEnvironment({
        tenantId: 't1',
        name: 'production',
        description: 'Production environment',
        order: 3,
        variables: { NODE_ENV: 'production' },
        approvalRequired: true,
        approvalCount: 2,
      });

      expect(env.description).toBe('Production environment');
      expect(env.order).toBe(3);
      expect(env.variables).toEqual({ NODE_ENV: 'production' });
      expect(env.approvalRequired).toBe(true);
      expect(env.approvalCount).toBe(2);
    });
  });

  describe('mergeVariables', () => {
    it('should merge pipeline and environment variables', () => {
      const result = mergeVariables(
        { A: '1', B: '2' },
        { B: '3', C: '4' }
      );

      expect(result).toEqual({ A: '1', B: '3', C: '4' });
    });

    it('should let environment vars override pipeline vars', () => {
      const result = mergeVariables(
        { KEY: 'pipeline-value' },
        { KEY: 'env-value' }
      );

      expect(result.KEY).toBe('env-value');
    });

    it('should handle empty objects', () => {
      expect(mergeVariables({}, {})).toEqual({});
      expect(mergeVariables({ A: '1' }, {})).toEqual({ A: '1' });
      expect(mergeVariables({}, { B: '2' })).toEqual({ B: '2' });
    });
  });
});
