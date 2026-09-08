import { useState, useEffect } from 'react';
import { message } from 'antd';
import { useQuery } from '@/providers/QueryProvider';
import pipelineVersionsApi, { type PipelineVersion } from '@/api/pipeline-versions';
import {
  getArtifactVersions,
  getVersionDiff,
  type ArtifactVersion,
  type VersionDiff,
} from '@/api/artifactVersions';

export type TabKey = 'pipeline' | 'artifact' | 'deploy';

export function useVersionManagementState() {
  const [activeTab, setActiveTab] = useState<TabKey>('pipeline');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [compareModalVisible, setCompareModalVisible] = useState(false);
  const [diffResult, setDiffResult] = useState<VersionDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  const {
    data: pipelineVersions = [] as PipelineVersion[],
    isLoading: pipelineLoading,
    isError: pipelineError,
    refetch: loadPipelineVersions,
  } = useQuery<PipelineVersion[]>({
    queryKey: ['versions', 'pipeline'],
    queryFn: async () => {
      const versions = await pipelineVersionsApi.list('');
      return versions as unknown as PipelineVersion[];
    },
    enabled: activeTab === 'pipeline',
    staleTime: 30_000,
  });

  const {
    data: artifactVersions = [] as ArtifactVersion[],
    isLoading: artifactLoading,
    isError: artifactError,
  } = useQuery<ArtifactVersion[]>({
    queryKey: ['versions', 'artifact'],
    queryFn: async () => {
      const res = await getArtifactVersions();
      return res.data.versions;
    },
    enabled: activeTab === 'artifact',
    staleTime: 30_000,
  });

  const loading = activeTab === 'pipeline' ? pipelineLoading : artifactLoading;

  useEffect(() => {
    if (pipelineError) message.error('加载 Pipeline 版本失败');
  }, [pipelineError]);

  useEffect(() => {
    if (artifactError) message.error('加载制品版本失败');
  }, [artifactError]);

  const handleRollback = async (record: PipelineVersion) => {
    try {
      await pipelineVersionsApi.rollback(record.pipeline_id, record.id);
      message.success(`版本 ${record.version} 已回滚`);
      loadPipelineVersions();
    } catch (err) {
      message.error('回滚失败');
    }
  };

  const handleSetBaseline = async (record: PipelineVersion) => {
    try {
      await pipelineVersionsApi.setBaseline(record.pipeline_id, record.id, true);
      message.success(`版本 ${record.version} 已设为基线`);
      loadPipelineVersions();
    } catch (err) {
      message.error('设置基线失败');
    }
  };

  const handleCompare = async () => {
    if (selectedRowKeys.length !== 2) {
      message.warning('请选择 2 个版本进行对比');
      return;
    }
    setDiffLoading(true);
    try {
      const [v1, v2] = selectedRowKeys as string[];
      const result = await getVersionDiff('', v1, v2);
      setDiffResult(result.data);
      setCompareModalVisible(true);
    } catch (err) {
      message.error('版本对比失败');
    } finally {
      setDiffLoading(false);
    }
  };

  return {
    activeTab, setActiveTab,
    selectedRowKeys, setSelectedRowKeys,
    compareModalVisible, setCompareModalVisible,
    diffResult, diffLoading,
    pipelineVersions, artifactVersions,
    loading, loadPipelineVersions,
    handleRollback, handleSetBaseline, handleCompare,
  };
}

export type VersionManagementState = ReturnType<typeof useVersionManagementState>;
