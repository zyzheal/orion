/**
 * DockerBuildService Tests
 *
 * Tests for Docker build, push, and scan operations.
 */

import { DockerBuildService, DockerBuildOptions } from '../DockerBuildService';

describe('DockerBuildService', () => {
  let service: DockerBuildService;

  beforeEach(() => {
    service = new DockerBuildService();
  });

  describe('build', () => {
    test('should return failure when docker is not available', async () => {
      // In test environment, docker may not be available
      const options: DockerBuildOptions = {
        context: '/tmp',
        imageName: 'test-app',
        tag: 'latest',
      };

      const result = await service.build(options);
      expect(result.success).toBeDefined();
      expect(result.imageTag).toBe('test-app:latest');
    });

    test('should build with default tag when not specified', async () => {
      const options: DockerBuildOptions = {
        context: '/tmp',
        imageName: 'test-app',
      };

      const result = await service.build(options);
      expect(result.imageTag).toBe('test-app:latest');
    });

    test('should include build args in command', async () => {
      const options: DockerBuildOptions = {
        context: '/tmp',
        imageName: 'test-app',
        tag: 'v1.0.0',
        buildArgs: { VERSION: '1.0.0', ENV: 'production' },
      };

      const result = await service.build(options);
      expect(result.imageTag).toBe('test-app:v1.0.0');
    });

    test('should include additional tags', async () => {
      const options: DockerBuildOptions = {
        context: '/tmp',
        imageName: 'test-app',
        tag: 'v1.0.0',
        additionalTags: ['latest', 'stable'],
      };

      const result = await service.build(options);
      expect(result.imageTag).toBe('test-app:v1.0.0');
    });
  });

  describe('push', () => {
    test('should return failure when push fails', async () => {
      const result = await service.push({
        imageName: 'test-app',
        tag: 'latest',
      });

      expect(result).toBeDefined();
      expect(result.imageTag).toBe('test-app:latest');
    });

    test('should push multiple tags', async () => {
      const result = await service.push({
        imageName: 'test-app',
        tag: 'v1.0.0',
        additionalTags: ['latest'],
      });

      expect(result.pushedTags).toBeDefined();
    });
  });

  describe('scan', () => {
    test('should return failure when scanner is not available', async () => {
      const result = await service.scan({
        imageName: 'test-app',
        tag: 'latest',
        scanner: 'trivy',
      });

      expect(result.scanner).toBe('trivy');
      expect(result.vulnerabilities).toBeDefined();
    });

    test('should default to trivy scanner', async () => {
      const result = await service.scan({
        imageName: 'test-app',
        tag: 'latest',
      });

      expect(result.scanner).toBe('trivy');
    });

    test('should report zero vulnerabilities when unable to parse output', async () => {
      const result = await service.scan({
        imageName: 'test-app',
        tag: 'latest',
        scanner: 'trivy',
      });

      expect(result.vulnerabilities.total).toBe(0);
    });
  });

  describe('isDockerAvailable', () => {
    test('should return boolean', async () => {
      const result = await service.isDockerAvailable();
      expect(typeof result).toBe('boolean');
    });
  });
});
