/**
 * ImageVerifier tests
 */

import { ImageVerifier, PullPolicy } from '../ImageVerifier';

// Mock child_process.spawn
jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

const { spawn } = require('child_process');

describe('ImageVerifier', () => {
  let verifier: ImageVerifier;

  beforeEach(() => {
    verifier = new ImageVerifier();
    jest.clearAllMocks();
  });

  function mockSpawn(exitCode: number, stdout = '', stderr = '') {
    return {
      on: jest.fn((event: string, cb: any) => {
        if (event === 'close') {
          setTimeout(() => cb(exitCode), 0);
        }
        if (event === 'error' && exitCode !== 0) {
          setTimeout(() => cb(new Error(stderr)), 0);
        }
      }),
      stdout: { on: jest.fn((event: string, cb: any) => { if (event === 'data') cb(stdout); }) },
      stderr: { on: jest.fn((event: string, cb: any) => { if (event === 'data') cb(stderr); }) },
    };
  }

  describe('verifyImage', () => {
    it('rejects empty image reference', async () => {
      const result = await verifier.verifyImage('');
      expect(result.ready).toBe(false);
      expect(result.error).toBe('Empty image reference');
    });

    it('rejects null image reference', async () => {
      const result = await verifier.verifyImage(null as any);
      expect(result.ready).toBe(false);
      expect(result.error).toBe('Empty image reference');
    });

    it('warns when using :latest tag', async () => {
      spawn.mockReturnValue(mockSpawn(1, '', 'not found'));
      const result = await verifier.verifyImage('alpine:latest', PullPolicy.Never);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain(':latest tag is non-deterministic');
    });

    it('does not warn for digest-pinned images with :latest', async () => {
      spawn.mockReturnValue(mockSpawn(0)); // exists locally
      const result = await verifier.verifyImage('alpine:latest@sha256:abc123');
      expect(result.ready).toBe(true);
      expect(result.warnings.length).toBe(0);
    });

    it('returns ready when image exists locally', async () => {
      spawn.mockReturnValue(mockSpawn(0)); // inspect succeeds
      const result = await verifier.verifyImage('alpine:3.18');
      expect(result.ready).toBe(true);
      expect(result.imageRef).toBe('alpine:3.18');
      expect(spawn).toHaveBeenCalledWith('docker', ['inspect', 'alpine:3.18']);
    });

    it('fails when image not local and policy is Never', async () => {
      spawn.mockReturnValue(mockSpawn(1, '', 'not found'));
      const result = await verifier.verifyImage('alpine:3.18', PullPolicy.Never);
      expect(result.ready).toBe(false);
      expect(result.error).toContain("not found locally and pull policy is 'never'");
    });

    it('pulls image when not local and policy is Always', async () => {
      // First call: inspect fails (not local)
      // Second call: pull succeeds
      spawn
        .mockReturnValueOnce(mockSpawn(1, '', 'not found'))
        .mockReturnValueOnce(mockSpawn(0));

      const result = await verifier.verifyImage('alpine:3.18', PullPolicy.Always);
      expect(result.ready).toBe(true);
      expect(spawn).toHaveBeenCalledWith('docker', ['pull', 'alpine:3.18']);
    });

    it('pulls image when not local and policy is IfNotPresent', async () => {
      spawn
        .mockReturnValueOnce(mockSpawn(1, '', 'not found'))
        .mockReturnValueOnce(mockSpawn(0));

      const result = await verifier.verifyImage('alpine:3.18', PullPolicy.IfNotPresent);
      expect(result.ready).toBe(true);
    });

    it('fails when pull fails', async () => {
      spawn
        .mockReturnValueOnce(mockSpawn(1, '', 'not found'))
        .mockReturnValueOnce(mockSpawn(1, '', 'pull failed'));

      const result = await verifier.verifyImage('alpine:3.18', PullPolicy.Always);
      expect(result.ready).toBe(false);
      expect(result.error).toContain('Failed to pull image');
    });
  });

  describe('imageExistsLocally', () => {
    it('returns true when docker inspect succeeds', async () => {
      spawn.mockReturnValue(mockSpawn(0));
      const exists = await verifier.imageExistsLocally('myimage:tag');
      expect(exists).toBe(true);
    });

    it('returns false when docker inspect fails', async () => {
      spawn.mockReturnValue(mockSpawn(1, '', 'no such image'));
      const exists = await verifier.imageExistsLocally('myimage:tag');
      expect(exists).toBe(false);
    });
  });

  describe('ensureRegistryAuth', () => {
    const oldEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...oldEnv };
    });

    it('returns false when no credentials configured', async () => {
      delete process.env.DOCKER_REGISTRY_USERNAME;
      delete process.env.DOCKER_REGISTRY_PASSWORD;
      const result = await verifier.ensureRegistryAuth();
      expect(result).toBe(false);
    });

    it('attempts login when credentials configured', async () => {
      process.env.DOCKER_REGISTRY_USERNAME = 'testuser';
      process.env.DOCKER_REGISTRY_PASSWORD = 'testpass';
      process.env.DOCKER_REGISTRY_SERVER = 'registry.example.com';
      const mockChild = mockSpawn(0);
      // Add stdin mock
      (mockChild as any).stdin = { write: jest.fn(), end: jest.fn() };
      spawn.mockReturnValue(mockChild);

      const result = await verifier.ensureRegistryAuth();
      expect(result).toBe(true);
      expect(spawn).toHaveBeenCalledWith(
        'docker',
        ['login', 'registry.example.com', '--username', 'testuser', '--password-stdin'],
        expect.objectContaining({ stdio: ['pipe', 'pipe', 'pipe'] })
      );
    });
  });
});
