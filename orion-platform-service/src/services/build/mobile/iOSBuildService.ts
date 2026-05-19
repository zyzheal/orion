/**
 * iOS Build Service
 *
 * Provides build configuration generation for iOS projects.
 * Supports Debug/Release configurations, code signing, and IPA export.
 */

import { BuildConfig, BuildType, Platform } from '../executors/BaseBuildExecutor';

export interface iOSBuildOptions {
  projectPath: string;
  scheme: string;
  configuration: 'Debug' | 'Release';
  destination?: string;
  codeSignIdentity?: string;
  provisioningProfile?: string;
}

export class iOSBuildService {
  /**
   * Create build configuration for iOS project
   */
  createBuildConfig(options: iOSBuildOptions): BuildConfig {
    const buildScript = this.generateBuildScript(options);

    return {
      type: BuildType.IOS,
      platform: Platform.MACOS,
      sourceUrl: options.projectPath,
      buildScript,
      envVars: {
        CODE_SIGN_IDENTITY: options.codeSignIdentity || '-',
        PROVISIONING_PROFILE: options.provisioningProfile || '',
        CODE_SIGNING_REQUIRED: 'NO',
        CODE_SIGNING_ALLOWED: 'NO',
      },
    };
  }

  /**
   * Generate build script for xcodebuild
   */
  private generateBuildScript(options: iOSBuildOptions): string {
    const destination = options.destination || 'generic/platform=iOS Simulator';
    return [
      `cd ${options.projectPath}`,
      `xcodebuild -scheme ${options.scheme}`,
      `-configuration ${options.configuration}`,
      `-destination '${destination}'`,
      'build',
    ].join(' && ');
  }

  /**
   * Generate export script for creating IPA from xcarchive
   */
  generateExportScript(options: iOSBuildOptions): string {
    return [
      `cd ${options.projectPath}`,
      `xcodebuild -exportArchive`,
      `-archivePath build/${options.scheme}.xcarchive`,
      `-exportPath output/${options.scheme}.ipa`,
      `-exportOptionsPlist ExportOptions.plist`,
    ].join(' && ');
  }

  /**
   * Get output paths for built artifacts
   */
  getOutputPaths(scheme: string): string[] {
    return [`build/${scheme}.xcarchive`, `output/${scheme}.ipa`];
  }
}