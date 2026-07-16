/**
 * EphemeralEnvironment 模型测试
 */
import {
  createEphemeralEnvironment,
  markRunning,
  markIdle,
  markTearingDown,
  markDestroyed,
  wakeEnvironment,
} from '../EphemeralEnvironment';

describe('EphemeralEnvironment', () => {
  describe('createEphemeralEnvironment', () => {
    it('should create environment with defaults', () => {
      const env = createEphemeralEnvironment({
        prId: 'pr-123',
        repoId: 'repo-456',
        branchName: 'feature-x',
      });

      expect(env.id).toBeDefined();
      expect(env.prId).toBe('pr-123');
      expect(env.repoId).toBe('repo-456');
      expect(env.branchName).toBe('feature-x');
      expect(env.namespace).toMatch(/^eph-/);
      expect(env.status).toBe('provisioning');
      expect(env.previewUrl).toBeDefined();
      expect(env.previewUrl).toContain('.dev.orion.internal');
      expect(env.resources).toEqual({ cpu: '2', memory: '4Gi', storage: '10Gi' });
      expect(env.services).toEqual([]);
      expect(env.createdAt).toBeInstanceOf(Date);
      expect(env.autoDestroyAt).toBeInstanceOf(Date);
    });

    it('should accept optional fields', () => {
      const env = createEphemeralEnvironment({
        prId: 'pr-1',
        repoId: 'repo-1',
        branchName: 'main',
        commitSha: 'abc123',
        createdBy: 'user1',
      });

      expect(env.commitSha).toBe('abc123');
      expect(env.createdBy).toBe('user1');
    });
  });

  describe('markRunning', () => {
    it('should set status and services', () => {
      const env = createEphemeralEnvironment({
        prId: 'pr-1', repoId: 'repo-1', branchName: 'main',
      });
      const services = [{ name: 'web', image: 'nginx', replicas: 1, healthy: true }];

      markRunning(env, services);

      expect(env.status).toBe('running');
      expect(env.services).toEqual(services);
    });
  });

  describe('markIdle', () => {
    it('should set idle status', () => {
      const env = createEphemeralEnvironment({
        prId: 'pr-1', repoId: 'repo-1', branchName: 'main',
      });

      markIdle(env);

      expect(env.status).toBe('idle');
      expect(env.idleSince).toBeInstanceOf(Date);
    });
  });

  describe('markTearingDown', () => {
    it('should set tearing_down status', () => {
      const env = createEphemeralEnvironment({
        prId: 'pr-1', repoId: 'repo-1', branchName: 'main',
      });

      markTearingDown(env, 'PR merged');

      expect(env.status).toBe('tearing_down');
      expect(env.destroyReason).toBe('PR merged');
    });
  });

  describe('markDestroyed', () => {
    it('should set destroyed status', () => {
      const env = createEphemeralEnvironment({
        prId: 'pr-1', repoId: 'repo-1', branchName: 'main',
      });

      markDestroyed(env, 'timeout');

      expect(env.status).toBe('destroyed');
      expect(env.destroyReason).toBe('timeout');
      expect(env.destroyedAt).toBeInstanceOf(Date);
    });
  });

  describe('wakeEnvironment', () => {
    it('should restore to running from idle', () => {
      const env = createEphemeralEnvironment({
        prId: 'pr-1', repoId: 'repo-1', branchName: 'main',
      });
      markIdle(env);
      wakeEnvironment(env);

      expect(env.status).toBe('running');
      expect(env.idleSince).toBeUndefined();
    });
  });
});
