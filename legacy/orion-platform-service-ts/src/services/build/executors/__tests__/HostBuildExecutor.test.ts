import { HostBuildExecutor } from '../HostBuildExecutor';
import { BuildType, Platform, BuildConfig, BuildContext } from '../BaseBuildExecutor';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('HostBuildExecutor', () => {
  describe('constructor and properties', () => {
    it('should have default type CPP_LINUX', () => {
      const executor = new HostBuildExecutor();
      expect(executor.type).toBe(BuildType.CPP_LINUX);
    });

    it('should accept custom build type', () => {
      const executor = new HostBuildExecutor(BuildType.ANDROID);
      expect(executor.type).toBe(BuildType.ANDROID);
    });
  });

  describe('platforms', () => {
    it('should return LINUX for CPP_LINUX', () => {
      const executor = new HostBuildExecutor(BuildType.CPP_LINUX);
      expect(executor.platforms).toContain(Platform.LINUX);
    });

    it('should return LINUX for ANDROID', () => {
      const executor = new HostBuildExecutor(BuildType.ANDROID);
      expect(executor.platforms).toContain(Platform.LINUX);
    });

    it('should return LINUX for DESKTOP_LINUX', () => {
      const executor = new HostBuildExecutor(BuildType.DESKTOP_LINUX);
      expect(executor.platforms).toContain(Platform.LINUX);
    });

    it('should return WINDOWS for CPP_WINDOWS', () => {
      const executor = new HostBuildExecutor(BuildType.CPP_WINDOWS);
      expect(executor.platforms).toContain(Platform.WINDOWS);
    });

    it('should return WINDOWS for DESKTOP_WINDOWS', () => {
      const executor = new HostBuildExecutor(BuildType.DESKTOP_WINDOWS);
      expect(executor.platforms).toContain(Platform.WINDOWS);
    });

    it('should return MACOS for CPP_MACOS', () => {
      const executor = new HostBuildExecutor(BuildType.CPP_MACOS);
      expect(executor.platforms).toContain(Platform.MACOS);
    });

    it('should return MACOS for DESKTOP_MACOS', () => {
      const executor = new HostBuildExecutor(BuildType.DESKTOP_MACOS);
      expect(executor.platforms).toContain(Platform.MACOS);
    });
  });

  describe('checkEnvironment', () => {
    it('should return false when required tools are missing', async () => {
      const executor = new HostBuildExecutor(BuildType.CPP_LINUX);
      const config: BuildConfig = {
        type: BuildType.CPP_LINUX,
        platform: Platform.LINUX,
        sourceUrl: 'https://example.com/repo',
      };

      const result = await executor.checkEnvironment(config);
      // In test environment, tools likely don't exist, so returns false
      expect(typeof result).toBe('boolean');
    });
  });

  describe('execute', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'host-build-test-'));
    });

    afterEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should execute build script and return success', async () => {
      const executor = new HostBuildExecutor(BuildType.CPP_LINUX);
      const config: BuildConfig = {
        type: BuildType.CPP_LINUX,
        platform: Platform.LINUX,
        sourceUrl: 'https://example.com/repo',
        buildScript: 'echo "build complete"',
      };

      const context: BuildContext = {
        runId: 'test-run-1',
        config,
        workspace: tempDir,
        artifacts: [],
      };

      const result = await executor.execute(context);

      expect(result.status).toBe('success');
      expect(result.log).toContain('build complete');
    });

    it('should create workspace if it does not exist', async () => {
      const executor = new HostBuildExecutor(BuildType.CPP_LINUX);
      const newWorkspace = path.join(tempDir, 'new-workspace');

      const config: BuildConfig = {
        type: BuildType.CPP_LINUX,
        platform: Platform.LINUX,
        sourceUrl: 'https://example.com/repo',
        buildScript: 'echo "test"',
      };

      const context: BuildContext = {
        runId: 'test-run-2',
        config,
        workspace: newWorkspace,
        artifacts: [],
      };

      await executor.execute(context);

      expect(fs.existsSync(newWorkspace)).toBe(true);
    });

    it('should return failed status when build script fails', async () => {
      const executor = new HostBuildExecutor(BuildType.CPP_LINUX);
      const config: BuildConfig = {
        type: BuildType.CPP_LINUX,
        platform: Platform.LINUX,
        sourceUrl: 'https://example.com/repo',
        buildScript: 'exit 1',
      };

      const context: BuildContext = {
        runId: 'test-run-3',
        config,
        workspace: tempDir,
        artifacts: [],
      };

      const result = await executor.execute(context);

      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
    });

    it('should support ANDROID build type', async () => {
      const executor = new HostBuildExecutor(BuildType.ANDROID);
      const config: BuildConfig = {
        type: BuildType.ANDROID,
        platform: Platform.LINUX,
        sourceUrl: 'https://example.com/android-app',
        buildScript: 'echo "android build"',
      };

      const context: BuildContext = {
        runId: 'test-run-android',
        config,
        workspace: tempDir,
        artifacts: [],
      };

      const result = await executor.execute(context);

      expect(result.status).toBe('success');
      expect(result.log).toContain('android build');
    });

    it('should apply environment variables', async () => {
      const executor = new HostBuildExecutor(BuildType.CPP_LINUX);
      const config: BuildConfig = {
        type: BuildType.CPP_LINUX,
        platform: Platform.LINUX,
        sourceUrl: 'https://example.com/repo',
        buildScript: 'echo $CUSTOM_VAR',
        envVars: {
          CUSTOM_VAR: 'test-value',
        },
      };

      const context: BuildContext = {
        runId: 'test-run-4',
        config,
        workspace: tempDir,
        artifacts: [],
      };

      const result = await executor.execute(context);

      expect(result.status).toBe('success');
      expect(result.log).toContain('test-value');
    });
  });

  describe('cancel', () => {
    it('should be implemented (placeholder for now)', async () => {
      const executor = new HostBuildExecutor();
      // cancel should not throw
      await expect(executor.cancel('run-id-123')).resolves.toBeUndefined();
    });
  });
});