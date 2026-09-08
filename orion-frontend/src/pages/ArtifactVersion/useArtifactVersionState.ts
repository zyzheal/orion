/**
 * useArtifactVersionState.ts - Artifact 版本管理状态管理 Hook
 * 抽取自 index.tsx (P2-9 Phase 210)
 */
import { useState, useEffect } from 'react';
import { message } from 'antd';
import {
  getArtifactVersions,
  getTraceabilityChain,
  getDeploymentHistory,
  deployVersion,
  type ArtifactVersion,
  type TraceabilityChain,
  type DeploymentHistory as DeploymentHistoryType,
} from '@/api/artifactVersions';

export function useArtifactVersionState() {
  const [loading, setLoading] = useState(false);
  const [versions, setVersions] = useState<ArtifactVersion[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Detail modal
  const [detailVisible, setDetailVisible] = useState(false);
  const [chain, setChain] = useState<TraceabilityChain | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<ArtifactVersion | null>(null);
  const [deployHistory, setDeployHistory] = useState<DeploymentHistoryType | null>(null);
  void deployHistory;

  const loadVersions = async () => {
    setLoading(true);
    try {
      const res = await getArtifactVersions({ limit: pageSize, offset: (page - 1) * pageSize });
      if (res.data) {
        setVersions(res.data.versions || []);
        setTotal(res.data.total || 0);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加载版本列表失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVersions();
  }, [page]);

  const showDetail = async (version: ArtifactVersion) => {
    setSelectedVersion(version);
    setDetailVisible(true);

    try {
      const chainRes = await getTraceabilityChain(version.id);
      if (chainRes.data) setChain(chainRes.data);
    } catch (error: unknown) {
      console.error('Failed to load data:', error);
    }

    try {
      const depRes = await getDeploymentHistory(version.pipelineId);
      if (depRes.data) setDeployHistory(depRes.data);
    } catch (error: unknown) {
      console.error('Failed to load data:', error);
    }
  };

  const handleDeploy = async (version: ArtifactVersion, environment: string) => {
    try {
      await deployVersion(version.id, { environment, deployedBy: 'current-user' });
      message.success(`已部署到 ${environment}`);
      loadVersions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '部署失败';
      message.error(msg);
    }
  };

  const handleCloseDetail = () => setDetailVisible(false);

  return {
    loading,
    versions,
    total,
    page,
    setPage,
    pageSize,
    detailVisible,
    chain,
    selectedVersion,
    loadVersions,
    showDetail,
    handleDeploy,
    handleCloseDetail,
  };
}
