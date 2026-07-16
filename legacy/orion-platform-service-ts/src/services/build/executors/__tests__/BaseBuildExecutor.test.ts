/**
 * BaseBuildExecutor 测试
 *
 * 测试枚举值、接口结构和类型定义的正确性。
 */

import {
  Platform,
  BuildType,
  BuildConfig,
  BuildContext,
  BuildResult,
  BuildExecutor,
} from '../BaseBuildExecutor';

describe('BaseBuildExecutor', () => {
  // ---- Platform enum ----

  describe('Platform enum', () => {
    it('should have LINUX value', () => {
      expect(Platform.LINUX).toBe('linux');
    });

    it('should have WINDOWS value', () => {
      expect(Platform.WINDOWS).toBe('windows');
    });

    it('should have MACOS value', () => {
      expect(Platform.MACOS).toBe('macos');
    });

    it('should have exactly 3 values', () => {
      const values = Object.values(Platform);
      expect(values).toHaveLength(3);
      expect(values).toContain('linux');
      expect(values).toContain('windows');
      expect(values).toContain('macos');
    });
  });

  // ---- BuildType enum ----

  describe('BuildType enum', () => {
    it('should have standard language build types', () => {
      expect(BuildType.NODE).toBe('node');
      expect(BuildType.PYTHON).toBe('python');
      expect(BuildType.GO).toBe('go');
      expect(BuildType.JAVA).toBe('java');
      expect(BuildType.DOTNET).toBe('dotnet');
      expect(BuildType.RUST).toBe('rust');
    });

    it('should have mobile build types', () => {
      expect(BuildType.ANDROID).toBe('android');
      expect(BuildType.IOS).toBe('ios');
      expect(BuildType.HARMONY).toBe('harmony');
    });

    it('should have desktop build types', () => {
      expect(BuildType.DESKTOP_WINDOWS).toBe('desktop-windows');
      expect(BuildType.DESKTOP_MACOS).toBe('desktop-macos');
      expect(BuildType.DESKTOP_LINUX).toBe('desktop-linux');
    });

    it('should have C++ build types', () => {
      expect(BuildType.CPP_LINUX).toBe('cpp-linux');
      expect(BuildType.CPP_WINDOWS).toBe('cpp-windows');
      expect(BuildType.CPP_MACOS).toBe('cpp-macos');
    });

    it('should have exactly 15 values', () => {
      const values = Object.values(BuildType);
      expect(values).toHaveLength(15);
    });

    it('should have all unique values', () => {
      const values = Object.values(BuildType);
      const unique = new Set(values);
      expect(unique.size).toBe(values.length);
    });
  });

  // ---- BuildConfig interface ----

  describe('BuildConfig interface', () => {
    it('should accept valid BuildConfig object', () => {
      const config: BuildConfig = {
        type: BuildType.NODE,
        platform: Platform.LINUX,
        sourceUrl: 'https://github.com/org/repo',
      };

      expect(config.type).toBe(BuildType.NODE);
      expect(config.platform).toBe(Platform.LINUX);
      expect(config.sourceUrl).toBe('https://github.com/org/repo');
    });

    it('should accept optional fields', () => {
      const config: BuildConfig = {
        type: BuildType.PYTHON,
        platform: Platform.WINDOWS,
        sourceUrl: '/local/path',
        buildScript: 'pip install -r requirements.txt',
        envVars: { PYTHON_VERSION: '3.11' },
      };

      expect(config.buildScript).toBe('pip install -r requirements.txt');
      expect(config.envVars).toEqual({ PYTHON_VERSION: '3.11' });
    });
  });

  // ---- BuildContext interface ----

  describe('BuildContext interface', () => {
    it('should accept valid BuildContext object', () => {
      const context: BuildContext = {
        runId: 'run-123',
        config: {
          type: BuildType.GO,
          platform: Platform.LINUX,
          sourceUrl: 'https://github.com/org/go-app',
        },
        workspace: '/workspace/run-123',
        artifacts: ['binary.tar.gz'],
      };

      expect(context.runId).toBe('run-123');
      expect(context.config.type).toBe(BuildType.GO);
      expect(context.workspace).toBe('/workspace/run-123');
      expect(context.artifacts).toEqual(['binary.tar.gz']);
    });

    it('should support empty artifacts', () => {
      const context: BuildContext = {
        runId: 'run-456',
        config: {
          type: BuildType.NODE,
          platform: Platform.MACOS,
          sourceUrl: '/src',
        },
        workspace: '/workspace',
        artifacts: [],
      };

      expect(context.artifacts).toHaveLength(0);
    });
  });

  // ---- BuildResult interface ----

  describe('BuildResult interface', () => {
    it('should accept success result', () => {
      const result: BuildResult = {
        status: 'success',
        artifacts: ['output.tar.gz'],
        log: 'Build completed successfully',
      };

      expect(result.status).toBe('success');
      expect(result.artifacts).toHaveLength(1);
    });

    it('should accept failed result with error', () => {
      const result: BuildResult = {
        status: 'failed',
        artifacts: [],
        error: 'Compilation failed at line 42',
      };

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Compilation failed at line 42');
    });

    it('should accept cancelled result', () => {
      const result: BuildResult = {
        status: 'cancelled',
        artifacts: [],
      };

      expect(result.status).toBe('cancelled');
    });
  });

  // ---- BuildExecutor interface ----

  describe('BuildExecutor interface', () => {
    it('should be implementable as a mock', () => {
      const executor: BuildExecutor = {
        type: BuildType.NODE,
        platforms: [Platform.LINUX, Platform.MACOS],
        checkEnvironment: jest.fn().mockResolvedValue(true),
        execute: jest.fn().mockResolvedValue({
          status: 'success',
          artifacts: ['app.tar.gz'],
        }),
        cancel: jest.fn().mockResolvedValue(undefined),
      };

      expect(executor.type).toBe(BuildType.NODE);
      expect(executor.platforms).toContain(Platform.LINUX);
      expect(executor.platforms).toContain(Platform.MACOS);
      expect(typeof executor.checkEnvironment).toBe('function');
      expect(typeof executor.execute).toBe('function');
      expect(typeof executor.cancel).toBe('function');
    });

    it('should support async checkEnvironment', async () => {
      const executor: BuildExecutor = {
        type: BuildType.PYTHON,
        platforms: [Platform.LINUX],
        checkEnvironment: jest.fn().mockResolvedValue(false),
        execute: jest.fn(),
        cancel: jest.fn(),
      };

      const ready = await executor.checkEnvironment({
        type: BuildType.PYTHON,
        platform: Platform.LINUX,
        sourceUrl: '/src',
      });

      expect(ready).toBe(false);
    });

    it('should support async execute', async () => {
      const executor: BuildExecutor = {
        type: BuildType.GO,
        platforms: [Platform.LINUX],
        checkEnvironment: jest.fn(),
        execute: jest.fn().mockResolvedValue({
          status: 'success' as const,
          artifacts: ['binary'],
        }),
        cancel: jest.fn(),
      };

      const result = await executor.execute({
        runId: 'run-1',
        config: {
          type: BuildType.GO,
          platform: Platform.LINUX,
          sourceUrl: '/src',
        },
        workspace: '/workspace',
        artifacts: [],
      });

      expect(result.status).toBe('success');
      expect(result.artifacts).toContain('binary');
    });

    it('should support async cancel', async () => {
      const executor: BuildExecutor = {
        type: BuildType.JAVA,
        platforms: [Platform.WINDOWS],
        checkEnvironment: jest.fn(),
        execute: jest.fn(),
        cancel: jest.fn().mockResolvedValue(undefined),
      };

      await expect(executor.cancel('run-1')).resolves.toBeUndefined();
    });
  });
});
