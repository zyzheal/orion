/**
 * usePipelineVersionHistoryState.ts - PipelineVersionHistory 状态管理 Hook
 * 抽取自 index.tsx (P2-9 Phase 228)
 */
import { useState, useEffect, useCallback, type Key } from 'react';
import { Modal, message } from 'antd';
import { useParams } from 'react-router-dom';
import { pipelineVersionsApi, type PipelineVersion } from '@/api/pipeline-versions';

export function usePipelineVersionHistoryState() {
  const { pipelineId } = useParams<{ pipelineId: string }>();
  const [versions, setVersions] = useState<PipelineVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [diffModalVisible, setDiffModalVisible] = useState(false);
  const [diffVersions, setDiffVersions] = useState<{
    versionA: PipelineVersion | null;
    versionB: PipelineVersion | null;
  }>({ versionA: null, versionB: null });
  const [diffLoading, setDiffLoading] = useState(false);

  const loadVersions = useCallback(async () => {
    if (!pipelineId) return;
    setLoading(true);
    try {
      const response = await pipelineVersionsApi.list(pipelineId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setVersions(((response as any).data as PipelineVersion[]) || []);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '加载版本历史失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [pipelineId]);

  useEffect(() => {
    void loadVersions();
  }, [loadVersions]);

  const handleRollback = useCallback(
    (version: PipelineVersion) => {
      Modal.confirm({
        title: '版本回滚',
        content: `确认回滚到版本 v${version.version}？此操作将修改当前 Pipeline 配置。`,
        okText: '确认回滚',
        cancelText: '取消',
        onOk: async () => {
          try {
            await pipelineVersionsApi.rollback(pipelineId!, version.id);
            message.success('回滚成功');
            void loadVersions();
          } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : '回滚失败';
            message.error(msg);
          }
        },
      });
    },
    [pipelineId, loadVersions]
  );

  const handleSetBaseline = useCallback(
    async (version: PipelineVersion) => {
      try {
        await pipelineVersionsApi.setBaseline(pipelineId!, version.id, !version.is_baseline);
        message.success(version.is_baseline ? '已取消基线' : '已设为基线');
        void loadVersions();
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : '操作失败';
        message.error(msg);
      }
    },
    [pipelineId, loadVersions]
  );

  const handleDiff = useCallback(async () => {
    if (selectedRowKeys.length !== 2) {
      message.warning('请选择两个版本进行对比');
      return;
    }
    setDiffLoading(true);
    try {
      // 获取两个版本的完整数据 (包含 yaml_definition)
      const [vA, vB] = await Promise.all([
        pipelineVersionsApi.get(pipelineId!, selectedRowKeys[0] as string),
        pipelineVersionsApi.get(pipelineId!, selectedRowKeys[1] as string),
      ]);
      setDiffVersions({ versionA: vA, versionB: vB });
      setDiffModalVisible(true);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '版本对比失败';
      message.error(msg);
    } finally {
      setDiffLoading(false);
    }
  }, [pipelineId, selectedRowKeys]);

  const closeDiffModal = useCallback(() => {
    setDiffModalVisible(false);
  }, []);

  const handleSelectionChange = useCallback((keys: Key[]) => {
    setSelectedRowKeys(keys);
  }, []);

  return {
    // State
    versions,
    loading,
    selectedRowKeys,
    diffModalVisible,
    diffVersions,
    diffLoading,
    // Actions
    loadVersions,
    handleRollback,
    handleSetBaseline,
    handleDiff,
    closeDiffModal,
    handleSelectionChange,
  };
}
