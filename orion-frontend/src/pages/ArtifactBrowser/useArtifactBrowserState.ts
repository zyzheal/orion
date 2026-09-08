/**
 * useArtifactBrowserState.ts - ArtifactBrowser 状态管理 Hook
 * 抽取自 index.tsx (P2-9 Phase 222)
 */
import { useState, useEffect, useCallback } from 'react';
import { Form, message } from 'antd';
import {
  getArtifactVersions,
  getTraceabilityChain,
  getVersionDiff,
  deployVersion,
  type ArtifactVersion,
  type TraceabilityChain,
  type VersionDiff,
} from '@/api/artifactVersions';
import type { VersionFilters } from './VersionTable';

interface DeployFormValues {
  environment: string;
  deployedBy: string;
}

// ---- Pipeline options (fetched from API or static config) ----
export const pipelineOptions = [
  { label: 'orion-core-build', value: 'pipe-001' },
  { label: 'orion-ai-build', value: 'pipe-002' },
  { label: 'orion-gateway-deploy', value: 'pipe-003' },
  { label: 'orion-frontend-build', value: 'pipe-004' },
];

export function useArtifactBrowserState() {
  const [loading, setLoading] = useState(false);
  const [versions, setVersions] = useState<ArtifactVersion[]>([]);
  const [traceChain, setTraceChain] = useState<TraceabilityChain | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [diff, setDiff] = useState<VersionDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  // Filters
  const [filters, setFilters] = useState<VersionFilters>({});

  // Drawers/Modals
  const [traceDrawerVisible, setTraceDrawerVisible] = useState(false);
  const [compareDrawerVisible, setCompareDrawerVisible] = useState(false);
  const [deployModalVisible, setDeployModalVisible] = useState(false);

  // Selected items
  const [selectedVersion, setSelectedVersion] = useState<ArtifactVersion | null>(null);
  const [compareVersionA, setCompareVersionA] = useState<ArtifactVersion | null>(null);
  const [compareVersionB, setCompareVersionB] = useState<ArtifactVersion | null>(null);
  const [deployVersionItem, setDeployVersionItem] = useState<ArtifactVersion | null>(null);

  // Forms
  const [deployForm] = Form.useForm<DeployFormValues>();
  const [deploySubmitting, setDeploySubmitting] = useState(false);

  // Load versions
  const loadVersions = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
      };
      if (filters.pipelineId) params.pipelineId = filters.pipelineId;
      if (filters.branch) params.branch = filters.branch;

      const res = await getArtifactVersions(params);
      const data = res.data;
      if (data && Array.isArray(data.versions)) {
        setVersions(data.versions);
        setTotal(data.total || data.versions.length);
      } else {
        setVersions([]);
        setTotal(0);
      }
    } catch (error: unknown) {
      message.error(`加载版本数据失败: ${(error as Error).message}`);
      setVersions([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, filters]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  // Load traceability chain
  const handleViewTraceability = useCallback(async (record: ArtifactVersion) => {
    setSelectedVersion(record);
    setTraceDrawerVisible(true);
    setTraceLoading(true);
    setTraceChain(null);

    try {
      const res = await getTraceabilityChain(record.id);
      setTraceChain(res.data || null);
    } catch (error: unknown) {
      message.error(`加载追溯链失败: ${(error as Error).message}`);
      setTraceChain(null);
    } finally {
      setTraceLoading(false);
    }
  }, []);

  // Handle version comparison
  const handleCompare = useCallback(async (selected: ArtifactVersion[]) => {
    if (selected.length !== 2) return;
    const [a, b] = selected;
    setCompareVersionA(a);
    setCompareVersionB(b);
    setCompareDrawerVisible(true);
    setDiffLoading(true);
    setDiff(null);

    try {
      const res = await getVersionDiff(a.pipelineId, a.version, b.version);
      setDiff(res.data || null);
    } catch (error: unknown) {
      message.error(`加载版本对比失败: ${(error as Error).message}`);
      setDiff(null);
    } finally {
      setDiffLoading(false);
    }
  }, []);

  // Handle filter changes
  const handleFilter = useCallback(
    (newFilters: VersionFilters) => {
      setFilters(newFilters);
      setCurrentPage(1);
    },
    []
  );

  // Handle deployment
  const handleDeploy = useCallback(
    (record: ArtifactVersion) => {
      setDeployVersionItem(record);
      setDeployModalVisible(true);
      deployForm.resetFields();
    },
    [deployForm]
  );

  const handleDeploySubmit = useCallback(
    async (values: DeployFormValues) => {
      if (!deployVersionItem) return;
      setDeploySubmitting(true);
      try {
        await deployVersion(deployVersionItem.id, values);
        message.success(`版本 ${deployVersionItem.version} 已触发部署到 ${values.environment}`);
        setDeployModalVisible(false);
      } catch (error: unknown) {
        message.error(`部署失败: ${(error as Error).message}`);
      } finally {
        setDeploySubmitting(false);
      }
    },
    [deployVersionItem]
  );

  const handlePaginationChange = useCallback(
    (page: number, size: number) => {
      setCurrentPage(page);
      setPageSize(size);
    },
    []
  );

  const isInitialLoading = loading && versions.length === 0;

  return {
    // State
    loading,
    versions,
    traceChain,
    traceLoading,
    diff,
    diffLoading,
    currentPage,
    pageSize,
    total,
    filters,
    traceDrawerVisible,
    compareDrawerVisible,
    deployModalVisible,
    selectedVersion,
    compareVersionA,
    compareVersionB,
    deployVersionItem,
    deployForm,
    deploySubmitting,
    isInitialLoading,
    // Actions
    loadVersions,
    setTraceDrawerVisible,
    setCompareDrawerVisible,
    setDeployModalVisible,
    handleViewTraceability,
    handleCompare,
    handleFilter,
    handleDeploy,
    handleDeploySubmit,
    handlePaginationChange,
  };
}
