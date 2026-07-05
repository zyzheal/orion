/**
 * Mobile Build Services Test Suite
 *
 * Tests for Android, iOS, and HarmonyOS build services.
 */

import {
  AndroidBuildService,
  iOSBuildService,
  HarmonyBuildService,
  AndroidBuildOptions,
  iOSBuildOptions,
  HarmonyBuildOptions,
} from '../index';
import { BuildType, Platform } from '../../executors/BaseBuildExecutor';

describe('MobileBuildServices', () => {
  describe('AndroidBuildService', () => {
    const androidService = new AndroidBuildService();

    it('should create debug build config', () => {
      const options: AndroidBuildOptions = {
        projectPath: '/workspace/android-app',
        buildType: 'debug',
        minSdk: 24,
        targetSdk: 34,
      };

      const config = androidService.createBuildConfig(options);

      expect(config.type).toBe(BuildType.ANDROID);
      expect(config.platform).toBe(Platform.LINUX);
      expect(config.sourceUrl).toBe('/workspace/android-app');
      expect(config.buildScript).toContain('assembleDebug');
      expect(config.buildScript).toContain('-PminSdkVersion=24');
      expect(config.buildScript).toContain('-PtargetSdkVersion=34');
      expect(config.envVars?.ANDROID_HOME).toBeDefined();
      expect(config.envVars?.JAVA_HOME).toBeDefined();
    });

    it('should create release build config', () => {
      const options: AndroidBuildOptions = {
        projectPath: '/workspace/android-app',
        buildType: 'release',
      };

      const config = androidService.createBuildConfig(options);

      expect(config.type).toBe(BuildType.ANDROID);
      expect(config.buildScript).toContain('assembleRelease');
    });

    it('should create signing config', () => {
      const signingConfig = androidService.createSigningConfig({
        keystoreId: 'my-keystore',
        keyAlias: 'my-key',
      });

      expect(signingConfig.signingEnabled).toBe(true);
      expect(signingConfig.keystoreId).toBe('my-keystore');
      expect(signingConfig.keyAlias).toBe('my-key');
      expect(signingConfig.v2SigningEnabled).toBe(true);
      expect(signingConfig.v3SigningEnabled).toBe(true);
    });

    it('should use default keyAlias when not provided', () => {
      const signingConfig = androidService.createSigningConfig({
        keystoreId: 'my-keystore',
      });

      expect(signingConfig.keyAlias).toBe('androidkey');
    });

    it('should return correct output paths for debug', () => {
      const outputPaths = androidService.getOutputPaths('/workspace/android-app', 'debug');

      expect(outputPaths).toContain(
        '/workspace/android-app/app/build/outputs/apk/debug/app-debug.apk'
      );
      expect(outputPaths).toContain(
        '/workspace/android-app/app/build/outputs/bundle/debug/app-debug.aab'
      );
    });

    it('should return correct output paths for release', () => {
      const outputPaths = androidService.getOutputPaths('/workspace/android-app', 'release');

      expect(outputPaths).toContain(
        '/workspace/android-app/app/build/outputs/apk/release/app-release.apk'
      );
      expect(outputPaths).toContain(
        '/workspace/android-app/app/build/outputs/bundle/release/app-release.aab'
      );
    });
  });

  describe('iOSBuildService', () => {
    const iosService = new iOSBuildService();

    it('should create debug build config', () => {
      const options: iOSBuildOptions = {
        projectPath: '/workspace/ios-app',
        scheme: 'MyApp',
        configuration: 'Debug',
      };

      const config = iosService.createBuildConfig(options);

      expect(config.type).toBe(BuildType.IOS);
      expect(config.platform).toBe(Platform.MACOS);
      expect(config.sourceUrl).toBe('/workspace/ios-app');
      expect(config.buildScript).toContain('xcodebuild');
      expect(config.buildScript).toContain(options.scheme);
      expect(config.envVars?.CODE_SIGN_IDENTITY).toBe('-');
    });

    it('should create release build config', () => {
      const options: iOSBuildOptions = {
        projectPath: '/workspace/ios-app',
        scheme: 'MyApp',
        configuration: 'Release',
        codeSignIdentity: 'Apple Distribution',
        provisioningProfile: 'my-profile',
      };

      const config = iosService.createBuildConfig(options);

      expect(config.buildScript).toContain('Release');
      expect(config.envVars?.CODE_SIGN_IDENTITY).toBe('Apple Distribution');
      expect(config.envVars?.PROVISIONING_PROFILE).toBe('my-profile');
    });

    it('should use default destination when not provided', () => {
      const options: iOSBuildOptions = {
        projectPath: '/workspace/ios-app',
        scheme: 'MyApp',
        configuration: 'Debug',
      };

      const config = iosService.createBuildConfig(options);

      expect(config.buildScript).toContain("destination 'generic/platform=iOS Simulator'");
    });

    it('should use custom destination when provided', () => {
      const options: iOSBuildOptions = {
        projectPath: '/workspace/ios-app',
        scheme: 'MyApp',
        configuration: 'Debug',
        destination: 'platform=iOS',
      };

      const config = iosService.createBuildConfig(options);

      expect(config.buildScript).toContain("destination 'platform=iOS'");
    });

    it('should generate export script', () => {
      const options: iOSBuildOptions = {
        projectPath: '/workspace/ios-app',
        scheme: 'MyApp',
        configuration: 'Release',
      };

      const exportScript = iosService.generateExportScript(options);

      expect(exportScript).toContain('xcodebuild -exportArchive');
      expect(exportScript).toContain('-archivePath build/MyApp.xcarchive');
      expect(exportScript).toContain('-exportPath output/MyApp.ipa');
    });

    it('should return correct output paths', () => {
      const outputPaths = iosService.getOutputPaths('MyApp');

      expect(outputPaths).toContain('build/MyApp.xcarchive');
      expect(outputPaths).toContain('output/MyApp.ipa');
    });
  });

  describe('HarmonyBuildService', () => {
    const harmonyService = new HarmonyBuildService();

    it('should create debug build config', () => {
      const options: HarmonyBuildOptions = {
        projectPath: '/workspace/harmony-app',
        buildType: 'debug',
      };

      const config = harmonyService.createBuildConfig(options);

      expect(config.type).toBe(BuildType.HARMONY);
      expect(config.platform).toBe(Platform.LINUX);
      expect(config.sourceUrl).toBe('/workspace/harmony-app');
      expect(config.buildScript).toContain('assembleDebug');
      expect(config.envVars?.HARMONY_SDK).toBeDefined();
      expect(config.envVars?.JAVA_HOME).toBeDefined();
      expect(config.envVars?.NODE_HOME).toBeDefined();
    });

    it('should create release build config', () => {
      const options: HarmonyBuildOptions = {
        projectPath: '/workspace/harmony-app',
        buildType: 'release',
      };

      const config = harmonyService.createBuildConfig(options);

      expect(config.buildScript).toContain('assembleApp');
    });

    it('should include module in build script when provided', () => {
      const options: HarmonyBuildOptions = {
        projectPath: '/workspace/harmony-app',
        buildType: 'debug',
        module: 'entry',
      };

      const config = harmonyService.createBuildConfig(options);

      expect(config.buildScript).toContain('-p module=entry');
    });

    it('should return correct output paths', () => {
      const outputPaths = harmonyService.getOutputPaths('/workspace/harmony-app');

      expect(outputPaths).toContain('/workspace/harmony-app/build/outputs/hap/debug/');
      expect(outputPaths).toContain('/workspace/harmony-app/build/outputs/hap/release/');
    });
  });
});