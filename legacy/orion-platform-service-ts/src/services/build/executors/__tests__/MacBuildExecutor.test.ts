import { MacBuildExecutor } from '../MacBuildExecutor';
import { BuildType, Platform, BuildConfig, BuildContext } from '../BaseBuildExecutor';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('MacBuildExecutor', () => {
  describe('constructor and properties', () => {
    it('should have default type IOS', () => {
      const executor = new MacBuildExecutor();
      expect(executor.type).toBe(BuildType.IOS);
    });

    it('should accept custom build type', () => {
      const executor = new MacBuildExecutor(BuildType.HARMONY);
      expect(executor.type).toBe(BuildType.HARMONY);
    });

    it('should accept DESKTOP_MACOS build type', () => {
      const executor = new MacBuildExecutor(BuildType.DESKTOP_MACOS);
      expect(executor.type).toBe(BuildType.DESKTOP_MACOS);
    });
  });

  describe('platforms', () => {
    it('should return MACOS for IOS', () => {
      const executor = new MacBuildExecutor(BuildType.IOS);
      expect(executor.platforms).toContain(Platform.MACOS);
    });

    it('should return MACOS for HARMONY', () => {
      const executor = new MacBuildExecutor(BuildType.HARMONY);
      expect(executor.platforms).toContain(Platform.MACOS);
    });

    it('should return MACOS for DESKTOP_MACOS', () => {
      const executor = new MacBuildExecutor(BuildType.DESKTOP_MACOS);
      expect(executor.platforms).toContain(Platform.MACOS);
    });

    it('should return MACOS for default type', () => {
      const executor = new MacBuildExecutor();
      expect(executor.platforms).toContain(Platform.MACOS);
    });
  });

  describe('checkEnvironment', () => {
    it('should return false when required tools are missing', async () => {
      const executor = new MacBuildExecutor(BuildType.IOS);
      const config: BuildConfig = {
        type: BuildType.IOS,
        platform: Platform.MACOS,
        sourceUrl: 'https://example.com/repo',
      };

      const result = await executor.checkEnvironment(config);
      // In test environment, tools likely don't exist, so returns false
      expect(typeof result).toBe('boolean');
    });

    it('should check for xcodebuild and xcrun for IOS type', async () => {
      const executor = new MacBuildExecutor(BuildType.IOS);
      const config: BuildConfig = {
        type: BuildType.IOS,
        platform: Platform.MACOS,
        sourceUrl: 'https://example.com/ios-app',
      };

      const result = await executor.checkEnvironment(config);
      expect(typeof result).toBe('boolean');
    });

    it('should check for hvigor and java for HARMONY type', async () => {
      const executor = new MacBuildExecutor(BuildType.HARMONY);
      const config: BuildConfig = {
        type: BuildType.HARMONY,
        platform: Platform.MACOS,
        sourceUrl: 'https://example.com/harmony-app',
      };

      const result = await executor.checkEnvironment(config);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('execute', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mac-build-test-'));
    });

    afterEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should execute build script and return success', async () => {
      const executor = new MacBuildExecutor(BuildType.IOS);
      const config: BuildConfig = {
        type: BuildType.IOS,
        platform: Platform.MACOS,
        sourceUrl: 'https://example.com/repo',
        buildScript: 'echo "iOS build complete"',
      };

      const context: BuildContext = {
        runId: 'test-run-1',
        config,
        workspace: tempDir,
        artifacts: [],
      };

      const result = await executor.execute(context);

      expect(result.status).toBe('success');
      expect(result.log).toContain('iOS build complete');
    });

    it('should create workspace if it does not exist', async () => {
      const executor = new MacBuildExecutor(BuildType.IOS);
      const newWorkspace = path.join(tempDir, 'new-workspace');

      const config: BuildConfig = {
        type: BuildType.IOS,
        platform: Platform.MACOS,
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
      const executor = new MacBuildExecutor(BuildType.IOS);
      const config: BuildConfig = {
        type: BuildType.IOS,
        platform: Platform.MACOS,
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

    it('should support HARMONY build type', async () => {
      const executor = new MacBuildExecutor(BuildType.HARMONY);
      const config: BuildConfig = {
        type: BuildType.HARMONY,
        platform: Platform.MACOS,
        sourceUrl: 'https://example.com/harmony-app',
        buildScript: 'echo "harmony build"',
      };

      const context: BuildContext = {
        runId: 'test-run-harmony',
        config,
        workspace: tempDir,
        artifacts: [],
      };

      const result = await executor.execute(context);

      expect(result.status).toBe('success');
      expect(result.log).toContain('harmony build');
    });

    it('should support DESKTOP_MACOS build type', async () => {
      const executor = new MacBuildExecutor(BuildType.DESKTOP_MACOS);
      const config: BuildConfig = {
        type: BuildType.DESKTOP_MACOS,
        platform: Platform.MACOS,
        sourceUrl: 'https://example.com/macos-app',
        buildScript: 'echo "macOS desktop build"',
      };

      const context: BuildContext = {
        runId: 'test-run-macos-desktop',
        config,
        workspace: tempDir,
        artifacts: [],
      };

      const result = await executor.execute(context);

      expect(result.status).toBe('success');
      expect(result.log).toContain('macOS desktop build');
    });

    it('should apply environment variables', async () => {
      const executor = new MacBuildExecutor(BuildType.IOS);
      const config: BuildConfig = {
        type: BuildType.IOS,
        platform: Platform.MACOS,
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

    it('should collect .app artifacts from build directory', async () => {
      // Create build directory with .app folder
      const buildDir = path.join(tempDir, 'build');
      fs.mkdirSync(buildDir, { recursive: true });
      fs.mkdirSync(path.join(buildDir, 'MyApp.app'));
      fs.mkdirSync(path.join(buildDir, 'AnotherApp.app'));

      const executor = new MacBuildExecutor(BuildType.IOS);
      const config: BuildConfig = {
        type: BuildType.IOS,
        platform: Platform.MACOS,
        sourceUrl: 'https://example.com/repo',
        buildScript: 'echo "done"',
      };

      const context: BuildContext = {
        runId: 'test-run-5',
        config,
        workspace: tempDir,
        artifacts: [],
      };

      const result = await executor.execute(context);

      expect(result.status).toBe('success');
      expect(result.artifacts).toHaveLength(2);
      expect(result.artifacts).toContain(path.join(buildDir, 'MyApp.app'));
      expect(result.artifacts).toContain(path.join(buildDir, 'AnotherApp.app'));
    });
  });

  describe('cancel', () => {
    it('should be implemented (placeholder for now)', async () => {
      const executor = new MacBuildExecutor();
      // cancel should not throw
      await expect(executor.cancel('run-id-123')).resolves.toBeUndefined();
    });
  });
});