/**
 * Android Build Service
 *
 * Provides build configuration generation for Android projects.
 * Supports debug/release builds, SDK version configuration, and signing.
 */

import { BuildConfig, BuildType, Platform } from '../executors/BaseBuildExecutor';

export interface AndroidBuildOptions {
  projectPath: string;
  buildType: 'debug' | 'release';
  minSdk?: number;
  targetSdk?: number;
  gradleProperties?: Record<string, string>;
}

export interface AndroidSigningConfig {
  keystoreId: string;
  keyAlias?: string;
}

export class AndroidBuildService {
  /**
   * Create build configuration for Android project
   */
  createBuildConfig(options: AndroidBuildOptions): BuildConfig {
    const buildScript = this.generateBuildScript(options);

    return {
      type: BuildType.ANDROID,
      platform: Platform.LINUX,
      sourceUrl: options.projectPath,
      buildScript,
      envVars: {
        ANDROID_HOME: process.env.ANDROID_HOME || '/opt/android-sdk',
        ANDROID_SDK_ROOT: process.env.ANDROID_SDK_ROOT || '/opt/android-sdk',
        JAVA_HOME: process.env.JAVA_HOME || '/opt/java/openjdk',
        ...options.gradleProperties,
      },
    };
  }

  /**
   * Create signing configuration for Android build
   */
  createSigningConfig(options: AndroidSigningConfig): Record<string, unknown> {
    return {
      signingEnabled: true,
      keystoreId: options.keystoreId,
      keyAlias: options.keyAlias || 'androidkey',
      v2SigningEnabled: true,
      v3SigningEnabled: true,
    };
  }

  /**
   * Generate build script based on options
   */
  private generateBuildScript(options: AndroidBuildOptions): string {
    const task = options.buildType === 'release' ? 'assembleRelease' : 'assembleDebug';
    let script = `cd ${options.projectPath} && ./gradlew ${task}`;
    if (options.minSdk) script += ` -PminSdkVersion=${options.minSdk}`;
    if (options.targetSdk) script += ` -PtargetSdkVersion=${options.targetSdk}`;
    return script;
  }

  /**
   * Get output paths for built artifacts
   */
  getOutputPaths(projectPath: string, buildType: 'debug' | 'release'): string[] {
    const variant = buildType === 'release' ? 'release' : 'debug';
    return [
      `${projectPath}/app/build/outputs/apk/${variant}/app-${variant}.apk`,
      `${projectPath}/app/build/outputs/bundle/${variant}/app-${variant}.aab`,
    ];
  }
}