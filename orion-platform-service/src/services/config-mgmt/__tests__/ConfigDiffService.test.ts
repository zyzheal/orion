/**
 * ConfigDiffService Unit Tests
 *
 * Tests for environment comparison, version diffing, and diff reports.
 */

import { ConfigDiffService } from '../ConfigDiffService';
import { ConfigService } from '../ConfigService';
import { ConfigRepository } from '../ConfigRepository';

describe('ConfigDiffService', () => {
  let configService: ConfigService;
  let diffService: ConfigDiffService;

  beforeEach(() => {
    const repository = new ConfigRepository(); // in-memory mode (no pool)
    configService = new ConfigService(repository);
    diffService = new ConfigDiffService({ configService });
  });

  describe('compareEnvironments', () => {
    it('should detect configs in source but not in target', async () => {
      await configService.createConfig({
        key: 'database.url',
        value: 'postgres://dev:5432/db',
        environment: 'dev',
        createdBy: 'admin',
      });

      const report = await diffService.compareEnvironments('dev', 'prod');

      expect(report.sourceEnvironment).toBe('dev');
      expect(report.targetEnvironment).toBe('prod');
      expect(report.totalChanges).toBe(1);
      expect(report.added).toBe(1); // Added means: exists in dev, missing in prod
      expect(report.diffs[0].changeType).toBe('added');
      expect(report.diffs[0].key).toBe('database.url');
    });

    it('should detect configs in target but not in source', async () => {
      await configService.createConfig({
        key: 'database.url',
        value: 'postgres://prod:5432/db',
        environment: 'prod',
        createdBy: 'admin',
      });

      const report = await diffService.compareEnvironments('dev', 'prod');

      expect(report.totalChanges).toBe(1);
      expect(report.removed).toBe(1); // Removed means: exists in prod, missing in dev
      expect(report.diffs[0].changeType).toBe('removed');
    });

    it('should detect modified configs between environments', async () => {
      await configService.createConfig({
        key: 'database.url',
        value: 'postgres://dev:5432/db',
        environment: 'dev',
        createdBy: 'admin',
      });
      await configService.createConfig({
        key: 'database.url',
        value: 'postgres://prod:5432/db',
        environment: 'prod',
        createdBy: 'admin',
      });

      const report = await diffService.compareEnvironments('dev', 'prod');

      expect(report.totalChanges).toBe(1);
      expect(report.modified).toBe(1);
      expect(report.diffs[0].changeType).toBe('modified');
      expect(report.diffs[0].oldValue).toBe('postgres://dev:5432/db');
      expect(report.diffs[0].newValue).toBe('postgres://prod:5432/db');
    });

    it('should return no diffs for identical environments', async () => {
      await configService.createConfig({
        key: 'database.url',
        value: 'postgres://same:5432/db',
        environment: 'dev',
        createdBy: 'admin',
      });
      await configService.createConfig({
        key: 'database.url',
        value: 'postgres://same:5432/db',
        environment: 'staging',
        createdBy: 'admin',
      });

      const report = await diffService.compareEnvironments('dev', 'staging');

      expect(report.totalChanges).toBe(0);
      expect(report.diffs).toEqual([]);
    });

    it('should handle multiple keys with mixed changes', async () => {
      // Dev has these
      await configService.createConfig({
        key: 'database.url',
        value: 'dev-db',
        environment: 'dev',
        createdBy: 'admin',
      });
      await configService.createConfig({
        key: 'cache.url',
        value: 'same',
        environment: 'dev',
        createdBy: 'admin',
      });
      await configService.createConfig({
        key: 'cache.url',
        value: 'same',
        environment: 'prod',
        createdBy: 'admin',
      });
      await configService.createConfig({
        key: 'unique.dev.key',
        value: 'only-in-dev',
        environment: 'dev',
        createdBy: 'admin',
      });

      // Prod has these
      await configService.createConfig({
        key: 'database.url',
        value: 'prod-db',
        environment: 'prod',
        createdBy: 'admin',
      });
      await configService.createConfig({
        key: 'unique.prod.key',
        value: 'only-in-prod',
        environment: 'prod',
        createdBy: 'admin',
      });

      const report = await diffService.compareEnvironments('dev', 'prod');

      expect(report.added).toBe(1); // unique.dev.key
      expect(report.removed).toBe(1); // unique.prod.key
      expect(report.modified).toBe(1); // database.url
      expect(report.totalChanges).toBe(3);
    });
  });

  describe('compareVersions', () => {
    it('should compare two versions of a config', async () => {
      const config = await configService.createConfig({
        key: 'database.url',
        value: 'v1',
        environment: 'dev',
        createdBy: 'admin',
      });

      await configService.updateConfig(config.id, {
        value: 'v2',
        updatedBy: 'admin',
      });
      await configService.updateConfig(config.id, {
        value: 'v3',
        updatedBy: 'admin',
      });

      const diff = await diffService.compareVersions(config.id, 1, 3);

      expect(diff.configId).toBe(config.id);
      expect(diff.key).toBe('database.url');
      expect(diff.environment).toBe('dev');
      expect(diff.fromVersion).toBe(1);
      expect(diff.toVersion).toBe(3);
      expect(diff.oldValue).toBe('v1');
      expect(diff.newValue).toBe('v3');
    });

    it('should throw error for non-existent config', async () => {
      await expect(
        diffService.compareVersions('non-existent-id', 1, 2)
      ).rejects.toThrow("No versions found for config 'non-existent-id'");
    });

    it('should throw error for non-existent version', async () => {
      const config = await configService.createConfig({
        key: 'test.key',
        value: 'v1',
        environment: 'dev',
        createdBy: 'admin',
      });

      await expect(
        diffService.compareVersions(config.id, 1, 5)
      ).rejects.toThrow('Version 5 not found');
    });
  });

  describe('getDiffReport', () => {
    it('should generate environment comparisons for all pairs', async () => {
      await configService.createConfig({
        key: 'database.url',
        value: 'dev-db',
        environment: 'dev',
        createdBy: 'admin',
      });

      const report = await diffService.getDiffReport();

      expect(report.environmentComparisons.length).toBe(2); // dev->staging, staging->prod
    });

    it('should include version diffs when configId is provided', async () => {
      const config = await configService.createConfig({
        key: 'test.key',
        value: 'v1',
        environment: 'dev',
        createdBy: 'admin',
      });

      await configService.updateConfig(config.id, {
        value: 'v2',
        updatedBy: 'admin',
      });

      const report = await diffService.getDiffReport(config.id);

      expect(report.versionDiffs).toBeDefined();
      expect(report.versionDiffs!.length).toBe(1);
      expect(report.versionDiffs![0].oldValue).toBe('v1');
      expect(report.versionDiffs![0].newValue).toBe('v2');
    });
  });

  describe('getProposedDiff', () => {
    it('should return diff between current and proposed value', async () => {
      const config = await configService.createConfig({
        key: 'database.url',
        value: 'old-value',
        environment: 'dev',
        createdBy: 'admin',
      });

      const diff = await diffService.getProposedDiff(
        config.id,
        'new-value'
      );

      expect(diff).not.toBeNull();
      expect(diff?.key).toBe('database.url');
      expect(diff?.oldValue).toBe('old-value');
      expect(diff?.newValue).toBe('new-value');
      expect(diff?.changeType).toBe('modified');
    });

    it('should return null if proposed value is same as current', async () => {
      const config = await configService.createConfig({
        key: 'database.url',
        value: 'same-value',
        environment: 'dev',
        createdBy: 'admin',
      });

      const diff = await diffService.getProposedDiff(
        config.id,
        'same-value'
      );

      expect(diff).toBeNull();
    });

    it('should return null for non-existent config', async () => {
      const diff = await diffService.getProposedDiff(
        'non-existent-id',
        'value'
      );
      expect(diff).toBeNull();
    });
  });

  describe('getChangedKeys', () => {
    it('should return keys that differ between environments', async () => {
      await configService.createConfig({
        key: 'database.url',
        value: 'dev-db',
        environment: 'dev',
        createdBy: 'admin',
      });
      await configService.createConfig({
        key: 'database.url',
        value: 'prod-db',
        environment: 'prod',
        createdBy: 'admin',
      });
      await configService.createConfig({
        key: 'cache.url',
        value: 'same',
        environment: 'dev',
        createdBy: 'admin',
      });
      await configService.createConfig({
        key: 'cache.url',
        value: 'same',
        environment: 'prod',
        createdBy: 'admin',
      });

      const changedKeys = await diffService.getChangedKeys('dev', 'prod');

      expect(changedKeys).toContain('database.url');
      expect(changedKeys).not.toContain('cache.url');
    });
  });

  describe('getUniqueConfigs', () => {
    it('should find configs unique to each environment', async () => {
      await configService.createConfig({
        key: 'dev.only',
        value: 'v',
        environment: 'dev',
        createdBy: 'admin',
      });
      await configService.createConfig({
        key: 'shared.key',
        value: 'v',
        environment: 'dev',
        createdBy: 'admin',
      });
      await configService.createConfig({
        key: 'shared.key',
        value: 'v',
        environment: 'prod',
        createdBy: 'admin',
      });
      await configService.createConfig({
        key: 'prod.only',
        value: 'v',
        environment: 'prod',
        createdBy: 'admin',
      });

      const unique = await diffService.getUniqueConfigs('dev', 'prod');

      expect(unique.onlyInSource).toContain('dev.only');
      expect(unique.onlyInSource).not.toContain('shared.key');
      expect(unique.onlyInTarget).toContain('prod.only');
      expect(unique.onlyInTarget).not.toContain('shared.key');
    });
  });
});
