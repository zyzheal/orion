/**
 * BuildxBuilderService 测试
 *
 * 测试 Docker Buildx 多架构构建服务。
 * Mock child_process.exec 模拟命令执行。
 */

import { BuildxBuilderService, BuildOptions } from '../BuildxBuilderService';

// ==================== Mock child_process ====================

jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

// Mock pino logger
jest.mock('pino', () => {
  return jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }));
});

// ==================== Tests ====================

describe('BuildxBuilderService', () => {
  let service: BuildxBuilderService;
  const { exec } = require('child_process');

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BuildxBuilderService();
  });

  function mockExecSuccess(stdout: string = '', stderr: string = '') {
    exec.mockImplementation((_cmd: string, _opts: any, cb: Function) => {
      if (typeof _opts === 'function') {
        cb = _opts;
      }
      cb(null, { stdout, stderr });
    });
  }

  function mockExecError(error: Error) {
    exec.mockImplementation((_cmd: string, _opts: any, cb: Function) => {
      if (typeof _opts === 'function') {
        cb = _opts;
      }
      cb(error, { stdout: '', stderr: '' });
    });
  }

  function mockExecOnce(results: Array<{ stdout?: string; stderr?: string; error?: Error | null }>) {
    let callIndex = 0;
    exec.mockImplementation((_cmd: string, _opts: any, cb: Function) => {
      if (typeof _opts === 'function') {
        cb = _opts;
      }
      const result = results[Math.min(callIndex++, results.length - 1)];
      if (result.error) {
        cb(result.error, { stdout: result.stdout || '', stderr: result.stderr || '' });
      } else {
        cb(null, { stdout: result.stdout || '', stderr: result.stderr || '' });
      }
    });
  }

  const defaultOptions: BuildOptions = {
    context: '/workspace',
    imageName: 'myapp',
    tags: ['latest'],
    platforms: ['linux/amd64'],
  };

  // ---- buildMultiArch ----

  describe('buildMultiArch', () => {
    it('should perform multi-arch build for single platform', async () => {
      mockExecOnce([
        { stdout: 'buildx version 0.12.0' }, // checkBuildxAvailability
        { stdout: '' }, // createBuilder
        { stdout: 'sha256:' + 'a'.repeat(64) + '\nsize: 100 MB' }, // buildPlatform
        { stdout: '' }, // cleanupBuilder
      ]);

      const result = await service.buildMultiArch(defaultOptions);

      expect(result.success).toBe(true);
      expect(result.summary.totalPlatforms).toBe(1);
      expect(result.summary.successfulPlatforms).toBe(1);
      expect(result.summary.failedPlatforms).toBe(0);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].success).toBe(true);
    });

    it('should handle multiple platforms', async () => {
      const options: BuildOptions = {
        ...defaultOptions,
        platforms: ['linux/amd64', 'linux/arm64'],
      };

      mockExecOnce([
        { stdout: 'buildx version 0.12.0' },
        { stdout: '' },
        { stdout: 'sha256:' + 'a'.repeat(64) + '\nsize: 50 MB' }, // amd64
        { stdout: 'sha256:' + 'b'.repeat(64) + '\nsize: 50 MB' }, // arm64
        { stdout: '' }, // cleanup
      ]);

      const result = await service.buildMultiArch(options);

      expect(result.success).toBe(true);
      expect(result.summary.totalPlatforms).toBe(2);
      expect(result.summary.successfulPlatforms).toBe(2);
    });

    it('should handle buildx not available', async () => {
      mockExecError(new Error('command not found: docker'));

      const result = await service.buildMultiArch(defaultOptions);

      expect(result.success).toBe(false);
      expect(result.summary.successfulPlatforms).toBe(0);
    });

    it('should handle platform build failure', async () => {
      mockExecOnce([
        { stdout: 'buildx version 0.12.0' },
        { stdout: '' },
        { error: new Error('Build failed') }, // platform build fails
        { stdout: '' }, // cleanup
      ]);

      const result = await service.buildMultiArch(defaultOptions);

      expect(result.success).toBe(false);
      expect(result.summary.failedPlatforms).toBe(1);
      expect(result.results[0].errors).toHaveLength(1);
    });

    it('should push images when push option is true', async () => {
      mockExecOnce([
        { stdout: 'buildx version 0.12.0' },
        { stdout: '' },
        { stdout: 'sha256:' + 'c'.repeat(64) + '\nsize: 200 MB' },
        { stdout: '' }, // pushImages
        { stdout: '' }, // cleanup
      ]);

      const result = await service.buildMultiArch({
        ...defaultOptions,
        push: true,
      });

      expect(result.success).toBe(true);
    });

    it('should save to artifact registry when provided', async () => {
      const mockRegistry = {
        create: jest.fn().mockResolvedValue({ id: 'art-1' }),
      };

      const serviceWithRegistry = new BuildxBuilderService(mockRegistry as any);

      mockExecOnce([
        { stdout: 'buildx version 0.12.0' },
        { stdout: '' },
        { stdout: 'sha256:' + 'd'.repeat(64) + '\nsize: 100 MB' },
        { stdout: '' }, // cleanup
      ]);

      const result = await serviceWithRegistry.buildMultiArch(defaultOptions);

      expect(result.success).toBe(true);
      expect(mockRegistry.create).toHaveBeenCalled();
    });

    it('should handle builder creation failure', async () => {
      mockExecOnce([
        { stdout: 'buildx version 0.12.0' },
        { error: new Error('Failed to create builder') },
      ]);

      const result = await service.buildMultiArch(defaultOptions);

      expect(result.success).toBe(false);
    });
  });

  // ---- buildMultiArchNative ----

  describe('buildMultiArchNative', () => {
    it('should perform native multi-arch build', async () => {
      mockExecOnce([
        { stdout: 'buildx version 0.12.0' },
        { stdout: '#1 [internal] load build definition from Dockerfile\nsha256:' + 'e'.repeat(64) },
      ]);

      const result = await service.buildMultiArchNative({
        ...defaultOptions,
        platforms: ['linux/amd64', 'linux/arm64'],
      });

      expect(result.success).toBe(true);
      expect(result.platforms).toEqual(['linux/amd64', 'linux/arm64']);
    });

    it('should fail when no platforms specified', async () => {
      const result = await service.buildMultiArchNative({
        ...defaultOptions,
        platforms: [],
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('No platforms specified');
    });

    it('should handle build failure', async () => {
      mockExecOnce([
        { stdout: 'buildx version 0.12.0' },
        { error: new Error('Dockerfile not found') },
      ]);

      const result = await service.buildMultiArchNative(defaultOptions);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should push when push option is true', async () => {
      mockExecOnce([
        { stdout: 'buildx version 0.12.0' },
        { stdout: 'sha256:' + 'f'.repeat(64) },
        { stdout: '' }, // push
      ]);

      const result = await service.buildMultiArchNative({
        ...defaultOptions,
        push: true,
      });

      expect(result.success).toBe(true);
    });

    it('should save to artifact registry when provided', async () => {
      const mockRegistry = {
        create: jest.fn().mockResolvedValue({ id: 'art-2' }),
      };

      const serviceWithRegistry = new BuildxBuilderService(mockRegistry as any);

      mockExecOnce([
        { stdout: 'buildx version 0.12.0' },
        { stdout: 'sha256:' + 'f'.repeat(64) },
      ]);

      const result = await serviceWithRegistry.buildMultiArchNative({
        ...defaultOptions,
        platforms: ['linux/amd64'],
      });

      expect(result.success).toBe(true);
      expect(mockRegistry.create).toHaveBeenCalled();
    });

    it('should use context as cwd', async () => {
      mockExecOnce([
        { stdout: 'buildx version 0.12.0' },
        { stdout: '' },
      ]);

      await service.buildMultiArchNative({
        ...defaultOptions,
        context: '/custom/workspace',
      });

      // Verify exec was called with cwd set to the context
      expect(exec).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ cwd: '/custom/workspace' }),
        expect.any(Function),
      );
    });
  });

  // ---- buildPlatform ----

  describe('buildPlatform', () => {
    it('should build single platform successfully', async () => {
      mockExecSuccess('sha256:' + 'a'.repeat(64) + '\nsize: 50 MB');

      const result = await service.buildPlatform({
        ...defaultOptions,
        platform: 'linux/amd64',
        builderName: 'test-builder',
      });

      expect(result.success).toBe(true);
      expect(result.platforms).toEqual(['linux/amd64']);
      expect(result.imageId).toBeDefined();
    });

    it('should handle build failure', async () => {
      mockExecError(new Error('Compilation failed'));

      const result = await service.buildPlatform({
        ...defaultOptions,
        platform: 'linux/arm64',
        builderName: 'test-builder',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Compilation failed');
    });

    it('should include build args in command', async () => {
      mockExecSuccess('');

      await service.buildPlatform({
        ...defaultOptions,
        platform: 'linux/amd64',
        builderName: 'test-builder',
        buildArgs: { NODE_ENV: 'production', APP_VERSION: '1.0.0' },
      });

      const calledCmd = exec.mock.calls[0][0];
      expect(calledCmd).toContain('--build-arg NODE_ENV=production');
      expect(calledCmd).toContain('--build-arg APP_VERSION=1.0.0');
    });

    it('should include labels in command', async () => {
      mockExecSuccess('');

      await service.buildPlatform({
        ...defaultOptions,
        platform: 'linux/amd64',
        builderName: 'test-builder',
        labels: { maintainer: 'team@orion.io' },
      });

      const calledCmd = exec.mock.calls[0][0];
      expect(calledCmd).toContain('--label maintainer=team@orion.io');
    });

    it('should include cache config in command', async () => {
      mockExecSuccess('');

      await service.buildPlatform({
        ...defaultOptions,
        platform: 'linux/amd64',
        builderName: 'test-builder',
        cacheFrom: ['type=registry,ref=cache:latest'],
        cacheTo: ['type=inline'],
      });

      const calledCmd = exec.mock.calls[0][0];
      expect(calledCmd).toContain('--cache-from type=registry,ref=cache:latest');
      expect(calledCmd).toContain('--cache-to type=inline');
    });

    it('should include push flag in command', async () => {
      mockExecSuccess('');

      await service.buildPlatform({
        ...defaultOptions,
        platform: 'linux/amd64',
        builderName: 'test-builder',
        push: true,
      });

      const calledCmd = exec.mock.calls[0][0];
      expect(calledCmd).toContain('--push');
    });

    it('should include no-cache flag in command', async () => {
      mockExecSuccess('');

      await service.buildPlatform({
        ...defaultOptions,
        platform: 'linux/amd64',
        builderName: 'test-builder',
        noCache: true,
      });

      const calledCmd = exec.mock.calls[0][0];
      expect(calledCmd).toContain('--no-cache');
    });

    it('should include pull flag in command', async () => {
      mockExecSuccess('');

      await service.buildPlatform({
        ...defaultOptions,
        platform: 'linux/amd64',
        builderName: 'test-builder',
        pull: true,
      });

      const calledCmd = exec.mock.calls[0][0];
      expect(calledCmd).toContain('--pull');
    });

    it('should include dockerfile in command', async () => {
      mockExecSuccess('');

      await service.buildPlatform({
        ...defaultOptions,
        platform: 'linux/amd64',
        builderName: 'test-builder',
        dockerfile: 'Dockerfile.prod',
      });

      const calledCmd = exec.mock.calls[0][0];
      expect(calledCmd).toContain('-f Dockerfile.prod');
    });

    it('should include progress option in command', async () => {
      mockExecSuccess('');

      await service.buildPlatform({
        ...defaultOptions,
        platform: 'linux/amd64',
        builderName: 'test-builder',
        progress: 'plain',
      });

      const calledCmd = exec.mock.calls[0][0];
      expect(calledCmd).toContain('--progress plain');
    });

    it('should include builder name in command', async () => {
      mockExecSuccess('');

      await service.buildPlatform({
        ...defaultOptions,
        platform: 'linux/amd64',
        builderName: 'my-custom-builder',
      });

      const calledCmd = exec.mock.calls[0][0];
      expect(calledCmd).toContain('--builder my-custom-builder');
    });

    it('should include platform in command', async () => {
      mockExecSuccess('');

      await service.buildPlatform({
        ...defaultOptions,
        platform: 'linux/arm64',
        builderName: 'test-builder',
      });

      const calledCmd = exec.mock.calls[0][0];
      expect(calledCmd).toContain('--platform linux/arm64');
    });
  });

  // ---- pushImages ----

  describe('pushImages', () => {
    it('should push images successfully', async () => {
      mockExecSuccess('');

      await service.pushImages({
        imageName: 'myapp',
        tags: ['v1.0.0'],
        platforms: ['linux/amd64'],
      });

      expect(exec).toHaveBeenCalled();
    });

    it('should throw on push failure', async () => {
      mockExecError(new Error('Push denied'));

      await expect(
        service.pushImages({
          imageName: 'myapp',
          tags: ['v1.0.0'],
          platforms: ['linux/amd64'],
        }),
      ).rejects.toThrow('Push denied');
    });
  });

  // ---- getBuilders ----

  describe('getBuilders', () => {
    it('should return parsed builders list', async () => {
      mockExecSuccess(
        'NAME/NODE           DRIVER/ENDPOINT             STATUS  BUILDKIT PLATFORMS\n' +
        'default             docker-container\n' +
        '  default_0         default                     running v0.12.0  linux/amd64, linux/arm64\n' +
        'orion-builder-123   docker-container\n' +
        '  orion-builder-123_0 orion-builder-123           running v0.12.0  linux/amd64\n',
      );

      const builders = await service.getBuilders();

      expect(Array.isArray(builders)).toBe(true);
      expect(builders.length).toBeGreaterThan(0);
    });

    it('should throw on failure', async () => {
      mockExecError(new Error('Docker not running'));

      await expect(service.getBuilders()).rejects.toThrow('Docker not running');
    });
  });

  // ---- getCurrentBuilder ----

  describe('getCurrentBuilder', () => {
    it('should return current builder name', async () => {
      mockExecSuccess('Name: my-builder\nDriver: docker-container\nStatus: running');

      const name = await service.getCurrentBuilder();

      expect(name).toBe('my-builder');
    });

    it('should return null on failure', async () => {
      mockExecError(new Error('Not available'));

      const name = await service.getCurrentBuilder();

      expect(name).toBeNull();
    });

    it('should return null when no match found', async () => {
      mockExecSuccess('No builder info available');

      const name = await service.getCurrentBuilder();

      expect(name).toBeNull();
    });
  });

  // ---- buildMultiArchCommand ----

  describe('buildMultiArchCommand', () => {
    it('should build correct command with all options', async () => {
      mockExecSuccess('');

      await service.buildPlatform({
        context: '.',
        dockerfile: 'Dockerfile.prod',
        imageName: 'myapp',
        platform: 'linux/amd64',
        tags: ['v1.0.0', 'latest'],
        buildArgs: { ENV: 'prod' },
        labels: { version: '1.0' },
        cacheFrom: ['type=registry'],
        cacheTo: ['type=inline'],
        push: true,
        progress: 'plain',
        noCache: true,
        pull: true,
        builderName: 'test-builder',
      });

      const cmd = exec.mock.calls[0][0];
      expect(cmd).toContain('docker buildx build');
      expect(cmd).toContain('--platform linux/amd64');
      expect(cmd).toContain('--builder test-builder');
      expect(cmd).toContain('--push');
      expect(cmd).toContain('--no-cache');
      expect(cmd).toContain('--pull');
      expect(cmd).toContain('-f Dockerfile.prod');
      expect(cmd).toContain(' .');
    });
  });

  // ---- parseImageId ----

  describe('parseImageId', () => {
    it('should parse sha256 image ID from stdout', async () => {
      const sha = 'a'.repeat(64);
      mockExecSuccess(`#1 writing sha256:${sha} done\n`);

      const result = await service.buildPlatform({
        ...defaultOptions,
        platform: 'linux/amd64',
        builderName: 'test-builder',
      });

      expect(result.imageId).toBe(sha);
    });

    it('should return undefined when no sha256 found', async () => {
      mockExecSuccess('Build completed with no id\n');

      const result = await service.buildPlatform({
        ...defaultOptions,
        platform: 'linux/amd64',
        builderName: 'test-builder',
      });

      expect(result.imageId).toBeUndefined();
    });
  });

  // ---- parseImageSize ----

  describe('parseImageSize', () => {
    it('should parse size in MB', async () => {
      mockExecSuccess('exporting to image\nsize: 150 MB\n');

      const result = await service.buildPlatform({
        ...defaultOptions,
        platform: 'linux/amd64',
        builderName: 'test-builder',
      });

      expect(result.size).toBe(150 * 1024 * 1024);
    });

    it('should parse size in KB', async () => {
      mockExecSuccess('exporting to image\nsize: 500 KB\n');

      const result = await service.buildPlatform({
        ...defaultOptions,
        platform: 'linux/amd64',
        builderName: 'test-builder',
      });

      expect(result.size).toBe(500 * 1024);
    });

    it('should parse size in GB', async () => {
      mockExecSuccess('exporting to image\nsize: 2 GB\n');

      const result = await service.buildPlatform({
        ...defaultOptions,
        platform: 'linux/amd64',
        builderName: 'test-builder',
      });

      expect(result.size).toBe(2 * 1024 * 1024 * 1024);
    });

    it('should return 0 when no size info', async () => {
      mockExecSuccess('Build completed\n');

      const result = await service.buildPlatform({
        ...defaultOptions,
        platform: 'linux/amd64',
        builderName: 'test-builder',
      });

      expect(result.size).toBe(0);
    });
  });

  // ---- constructor ----

  describe('constructor', () => {
    it('should work without artifact registry', () => {
      const svc = new BuildxBuilderService();
      expect(svc).toBeDefined();
    });

    it('should accept artifact registry', () => {
      const mockRegistry = { create: jest.fn() };
      const svc = new BuildxBuilderService(mockRegistry as any);
      expect(svc).toBeDefined();
    });
  });
});
