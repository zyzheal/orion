/**
 * ConfigDiffService - Configuration Diff & Comparison
 *
 * Provides utilities for comparing configurations between environments
 * and across versions, generating comprehensive diff reports.
 *
 * Features:
 *   - Compare configs between environments (e.g., dev vs prod)
 *   - Compare specific config versions
 *   - Generate detailed diff reports with summaries
 *   - Support for added, removed, and modified changes
 */

import { ConfigService } from './ConfigService';
import {
  ConfigItem,
  ConfigVersion,
  ConfigDiff,
  DiffReport,
  VersionDiffReport,
  ConfigEnvironment,
} from './types';

export interface ConfigDiffServiceConfig {
  configService: ConfigService;
}

export class ConfigDiffService {
  private configService: ConfigService;

  constructor(config: ConfigDiffServiceConfig) {
    this.configService = config.configService;
  }

  /**
   * Compare configurations between two environments
   */
  async compareEnvironments(
    sourceEnv: ConfigEnvironment,
    targetEnv: ConfigEnvironment
  ): Promise<DiffReport> {
    const sourceConfigs = await this.configService.getEnvironmentConfigs(
      sourceEnv
    );
    const targetConfigs = await this.configService.getEnvironmentConfigs(
      targetEnv
    );

    const diffs: ConfigDiff[] = [];

    // Build a map for target configs for quick lookup
    const targetMap = new Map<string, ConfigItem>();
    for (const tc of targetConfigs) {
      targetMap.set(tc.key, tc);
    }

    // Check source configs against target
    for (const sc of sourceConfigs) {
      const targetConfig = targetMap.get(sc.key);
      if (!targetConfig) {
        // Config exists in source but not in target
        diffs.push({
          key: sc.key,
          environment: targetEnv,
          oldValue: sc.value,
          changeType: 'added',
        });
      } else if (sc.value !== targetConfig.value) {
        // Value differs
        diffs.push({
          key: sc.key,
          environment: targetEnv,
          oldValue: sc.value,
          newValue: targetConfig.value,
          changeType: 'modified',
        });
      }
    }

    // Check target configs against source (for removed items)
    const sourceMap = new Map<string, ConfigItem>();
    for (const sc of sourceConfigs) {
      sourceMap.set(sc.key, sc);
    }

    for (const tc of targetConfigs) {
      if (!sourceMap.has(tc.key)) {
        diffs.push({
          key: tc.key,
          environment: targetEnv,
          newValue: tc.value,
          changeType: 'removed',
        });
      }
    }

    const added = diffs.filter((d) => d.changeType === 'added').length;
    const removed = diffs.filter((d) => d.changeType === 'removed').length;
    const modified = diffs.filter((d) => d.changeType === 'modified').length;

    return {
      sourceEnvironment: sourceEnv,
      targetEnvironment: targetEnv,
      diffs,
      totalChanges: diffs.length,
      added,
      removed,
      modified,
      generatedAt: new Date(),
    };
  }

  /**
   * Compare two specific versions of a configuration
   */
  async compareVersions(
    configId: string,
    fromVersion: number,
    toVersion: number
  ): Promise<VersionDiffReport> {
    const versions = await this.configService.getConfigVersions(configId);
    if (versions.length === 0) {
      throw new Error(`No versions found for config '${configId}'`);
    }

    const fromVersionRecord = versions.find((v) => v.version === fromVersion);
    const toVersionRecord = versions.find((v) => v.version === toVersion);

    if (!fromVersionRecord) {
      throw new Error(
        `Version ${fromVersion} not found for config '${configId}'`
      );
    }
    if (!toVersionRecord) {
      throw new Error(
        `Version ${toVersion} not found for config '${configId}'`
      );
    }

    return {
      configId,
      key: fromVersionRecord.key,
      environment: fromVersionRecord.environment,
      fromVersion,
      toVersion,
      oldValue: fromVersionRecord.value,
      newValue: toVersionRecord.value,
      generatedAt: new Date(),
    };
  }

  /**
   * Generate a comprehensive diff report
   *
   * Compares all environments pairwise and returns a summary
   */
  async getDiffReport(
    configId?: string
  ): Promise<{
    environmentComparisons: DiffReport[];
    versionDiffs?: VersionDiffReport[];
  }> {
    const environments: ConfigEnvironment[] = ['dev', 'staging', 'prod'];
    const comparisons: DiffReport[] = [];

    // Compare adjacent environments
    for (let i = 0; i < environments.length - 1; i++) {
      const report = await this.compareEnvironments(
        environments[i],
        environments[i + 1]
      );
      comparisons.push(report);
    }

    const result: {
      environmentComparisons: DiffReport[];
      versionDiffs?: VersionDiffReport[];
    } = {
      environmentComparisons: comparisons,
    };

    // If a specific config ID is provided, include version diffs
    if (configId) {
      const versions = await this.configService.getConfigVersions(configId);
      const versionDiffs: VersionDiffReport[] = [];

      for (let i = 0; i < versions.length - 1; i++) {
        const diff = await this.compareVersions(
          configId,
          versions[i].version,
          versions[i + 1].version
        );
        versionDiffs.push(diff);
      }

      result.versionDiffs = versionDiffs;
    }

    return result;
  }

  /**
   * Get the diff between current config and a proposed value
   */
  async getProposedDiff(
    configId: string,
    proposedValue: string
  ): Promise<ConfigDiff | null> {
    const config = await this.configService.getConfig(configId);
    if (!config) {
      return null;
    }

    if (config.value === proposedValue) {
      return null;
    }

    return {
      key: config.key,
      environment: config.environment,
      oldValue: config.value,
      newValue: proposedValue,
      changeType: 'modified',
    };
  }

  /**
   * List all config keys that differ between two environments
   */
  async getChangedKeys(
    sourceEnv: ConfigEnvironment,
    targetEnv: ConfigEnvironment
  ): Promise<string[]> {
    const report = await this.compareEnvironments(sourceEnv, targetEnv);
    return report.diffs.map((d) => d.key);
  }

  /**
   * Get configs that exist in one environment but not another
   */
  async getUniqueConfigs(
    sourceEnv: ConfigEnvironment,
    targetEnv: ConfigEnvironment
  ): Promise<{ onlyInSource: string[]; onlyInTarget: string[] }> {
    const sourceConfigs = await this.configService.getEnvironmentConfigs(
      sourceEnv
    );
    const targetConfigs = await this.configService.getEnvironmentConfigs(
      targetEnv
    );

    const sourceKeys = new Set(sourceConfigs.map((c) => c.key));
    const targetKeys = new Set(targetConfigs.map((c) => c.key));

    const onlyInSource = [...sourceKeys].filter((k) => !targetKeys.has(k));
    const onlyInTarget = [...targetKeys].filter((k) => !sourceKeys.has(k));

    return { onlyInSource, onlyInTarget };
  }
}
