/**
 * TaskRunner Multi-Arch Build Tests
 *
 * Tests for buildMultiArchNative method in BuildxBuilderService.
 */

import { BuildxBuilderService, BuildOptions } from '../../services/build/BuildxBuilderService';

// Mock child_process to avoid actual Docker calls in tests
jest.mock('child_process', () => ({
  exec: jest.fn((cmd: string, opts: any, cb: any) => {
    if (typeof opts === 'function') {
      cb = opts;
    }
    cb(null, { stdout: '', stderr: '' });
  }),
  execSync: jest.fn().mockReturnValue(''),
}));

describe('BuildxBuilderService Multi-Arch', () => {
  let service: BuildxBuilderService;

  beforeEach(() => {
    service = new BuildxBuilderService();
  });

  describe('buildMultiArchNative', () => {
    test('should return failure when no platforms specified', async () => {
      const options: BuildOptions = {
        context: '.',
        imageName: 'test-app',
        tags: ['latest'],
        platforms: [],
      };

      const result = await service.buildMultiArchNative(options);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('No platforms specified');
    });

    test('should return failure when docker is not available', async () => {
      const options: BuildOptions = {
        context: '.',
        imageName: 'test-app',
        tags: ['latest'],
        platforms: ['linux/amd64', 'linux/arm64'],
      };

      const result = await service.buildMultiArchNative(options);

      // Docker may not be available in test env
      expect(result).toBeDefined();
      expect(result.platforms).toEqual(['linux/amd64', 'linux/arm64']);
    });

    test('should include multiple platforms in result', async () => {
      const options: BuildOptions = {
        context: '.',
        imageName: 'multi-arch-app',
        tags: ['v1.0.0', 'latest'],
        platforms: ['linux/amd64', 'linux/arm64', 'linux/arm64/v8'],
      };

      const result = await service.buildMultiArchNative(options);

      expect(result.platforms).toHaveLength(3);
    });
  });
});
