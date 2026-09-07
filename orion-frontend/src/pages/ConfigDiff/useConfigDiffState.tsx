/**
 * useConfigDiffState - ConfigDiff 状态 hook
 * 抽取自 index.tsx (P2-9 Phase 122)
 */
import { useState, useEffect } from 'react';
import { message } from 'antd';
import {
  getConfigs,
  getConfigVersions,
  compareConfigs,
  rollbackConfig,
  getDiffReport,
  type ConfigItem,
  type ConfigVersion,
  type ConfigDiff,
  type ConfigChange,
  type DiffReport,
} from '@/api/config';

export const useConfigDiffState = () => {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [selectedConfig, setSelectedConfig] = useState<ConfigItem | null>(null);

  const [versions, setVersions] = useState<ConfigVersion[]>([]);
  const [fromVersion, setFromVersion] = useState<number>(0);
  const [toVersion, setToVersion] = useState<number>(0);

  const [diffResult, setDiffResult] = useState<ConfigDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [report, setReport] = useState<DiffReport | null>(null);

  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [rollbackReason, setRollbackReason] = useState('');
  const [rollbackLoading, setRollbackLoading] = useState(false);

  const [changeDetail, setChangeDetail] = useState<ConfigChange | null>(null);

  const [configLoading, setConfigLoading] = useState(false);

  useEffect(() => {
    loadConfigs();
  }, []);

  useEffect(() => {
    if (selectedConfigId) {
      loadVersions(selectedConfigId);
      setDiffResult(null);
      setReport(null);
      setFromVersion(0);
      setToVersion(0);
    }
  }, [selectedConfigId]);

  const loadConfigs = async () => {
    setConfigLoading(true);
    try {
      const res = await getConfigs();
      const configsData = res.data as { configs?: ConfigItem[]; data?: ConfigItem[] };
      const list = (configsData?.configs ??
        (configsData?.data as ConfigItem[]) ??
        []) as ConfigItem[];
      setConfigs(list);
    } catch {
      message.error('Failed to load config list');
    } finally {
      setConfigLoading(false);
    }
  };

  const loadVersions = async (id: string) => {
    try {
      const res = await getConfigVersions(id);
      const verData = res.data as { versions?: ConfigVersion[]; data?: ConfigVersion[] };
      const list = (verData?.versions ??
        (verData?.data as ConfigVersion[]) ??
        []) as ConfigVersion[];
      const sorted = list.sort((a, b) => a.version - b.version);
      setVersions(sorted);
      if (sorted.length >= 2) {
        setFromVersion(sorted[sorted.length - 2].version);
        setToVersion(sorted[sorted.length - 1].version);
      }
    } catch {
      message.error('Failed to load versions');
    }
  };

  const handleCompare = async () => {
    if (!selectedConfigId || !fromVersion || !toVersion) {
      message.warning('Please select a config and both versions');
      return;
    }
    if (fromVersion === toVersion) {
      message.warning('From and To versions must differ');
      return;
    }
    setDiffLoading(true);
    try {
      const res = await compareConfigs(selectedConfigId, fromVersion, toVersion);
      setDiffResult(res.data as ConfigDiff);
      message.success(
        `Diff loaded: ${(res.data as ConfigDiff).changes?.length ?? 0} changes found`
      );
    } catch {
      message.error('Failed to compute diff');
    } finally {
      setDiffLoading(false);
    }
  };

  const handleRollback = async () => {
    if (!selectedConfigId || !toVersion) return;
    setRollbackLoading(true);
    try {
      await rollbackConfig(selectedConfigId, toVersion);
      message.success(`Rollback to v${toVersion} completed`);
      setRollbackOpen(false);
      setRollbackReason('');
      loadVersions(selectedConfigId);
      setDiffResult(null);
    } catch {
      message.error('Rollback failed');
    } finally {
      setRollbackLoading(false);
    }
  };

  const handleReport = async () => {
    setReportLoading(true);
    try {
      const res = await getDiffReport(selectedConfigId || undefined);
      setReport(res.data as DiffReport);
      message.success('Diff report loaded');
    } catch {
      message.error('Failed to load diff report');
    } finally {
      setReportLoading(false);
    }
  };

  const versionOptions = versions.map((v) => ({
    label: `v${v.version} — ${v.changedAt} (${v.changedBy})${v.changeReason ? ': ' + v.changeReason : ''}`,
    value: v.version,
  }));

  return {
    configs,
    selectedConfigId,
    selectedConfig,
    versions,
    fromVersion,
    toVersion,
    diffResult,
    diffLoading,
    reportLoading,
    report,
    rollbackOpen,
    rollbackReason,
    rollbackLoading,
    changeDetail,
    configLoading,
    loadConfigs,
    loadVersions,
    handleCompare,
    handleRollback,
    handleReport,
    versionOptions,
    setSelectedConfigId,
    setSelectedConfig,
    setFromVersion,
    setToVersion,
    setChangeDetail,
    setRollbackOpen,
    setRollbackReason,
  };
};

export type ConfigDiffState = ReturnType<typeof useConfigDiffState>;
