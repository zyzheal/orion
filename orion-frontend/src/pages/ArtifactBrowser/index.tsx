/**
 * Artifact Version Browser (GAP-CN-06)
 * Version table with traceability chain, version comparison, and deployment
 *
 * Features:
 * - Version table: Version, Pipeline, Stage, Commit SHA, Branch, Created At
 * - Traceability chain visualization: Artifact -> Run -> Commit -> Deployment
 * - Version comparison: Select 2 versions, show diff
 * - Filter by: Pipeline, Branch, Date range
 * - Deploy button on each version
 */
import React, { useState, useEffect } from 'react';
import { Typography, Card, Drawer, message, Form } from 'antd';
import { ReloadOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

import VersionTable, { type VersionFilters } from './VersionTable';
import TraceabilityChainView from './TraceabilityChainView';
import VersionCompareDrawer from './VersionCompareDrawer';
import DeployVersionModal from './DeployVersionModal';
import {
  getArtifactVersions,
  getTraceabilityChain,
  getVersionDiff,
  deployVersion,
  type ArtifactVersion,
  type TraceabilityChain,
  type VersionDiff,
} from '@/api/artifactVersions';
import { spacing } from '@/tokens';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

// ---- Pipeline options (fetched from API or static config) ----
const pipelineOptions = [
  { label: 'orion-core-build', value: 'pipe-001' },
  { label: 'orion-ai-build', value: 'pipe-002' },
  { label: 'orion-gateway-deploy', value: 'pipe-003' },
  { label: 'orion-frontend-build', value: 'pipe-004' },
];

// ---- Main Component ----

const ArtifactBrowser: React.FC = () => {
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
  const [deployForm] = Form.useForm();
  const [deploySubmitting, setDeploySubmitting] = useState(false);

  // Load versions
  const loadVersions = async () => {
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
  };

  useEffect(() => {
    loadVersions();
  }, [currentPage, pageSize]);

  // Load traceability chain
  const handleViewTraceability = async (record: ArtifactVersion) => {
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
  };

  // Handle version comparison
  const handleCompare = async (selected: ArtifactVersion[]) => {
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
  };

  // Handle filter changes
  const handleFilter = (newFilters: VersionFilters) => {
    setFilters(newFilters);
    setCurrentPage(1);
    loadVersions();
  };

  // Handle deployment
  const handleDeploy = (record: ArtifactVersion) => {
    setDeployVersionItem(record);
    setDeployModalVisible(true);
    deployForm.resetFields();
  };

  const handleDeploySubmit = async (values: { environment: string; deployedBy: string }) => {
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
  };

  const isInitialLoading = loading && versions.length === 0;

  return (
    <div style={{ padding: 0 }}>
      {isInitialLoading ? (
        <Card loading />
      ) : (
        <>
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: spacing.lg,
            }}
          >
            <div>
              <Title level={2} style={{ marginBottom: spacing.sm }}>
                <FolderOpenOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
                制品版本浏览器
              </Title>
              <Text type="secondary">
                查看制品版本追溯链、对比版本差异、触发部署
              </Text>
            </div>
            <button
              onClick={loadVersions}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 12px',
                border: '1px solid colors.neutral[300]',
                borderRadius: 4,
                background: colors.neutral[0],
                cursor: 'pointer',
              }}
            >
              <ReloadOutlined spin={loading} />
              刷新
            </button>
          </div>

          {/* Version Table */}
          <Card>
            <VersionTable
              dataSource={versions}
              loading={loading}
              currentPage={currentPage}
              pageSize={pageSize}
              total={total}
              onViewTraceability={handleViewTraceability}
              onDeploy={handleDeploy}
              onCompare={handleCompare}
              onFilter={handleFilter}
              onPaginationChange={(page, size) => {
                setCurrentPage(page);
                setPageSize(size);
                loadVersions();
              }}
              pipelineOptions={pipelineOptions}
            />
          </Card>

          {/* Traceability Chain Drawer */}
          <Drawer
            title={
              selectedVersion
                ? `追溯链: ${selectedVersion.artifactName} (${selectedVersion.version})`
                : '追溯链'
            }
            open={traceDrawerVisible}
            onClose={() => setTraceDrawerVisible(false)}
            width={720}
            destroyOnClose
          >
            <TraceabilityChainView chain={traceChain} loading={traceLoading} />
          </Drawer>

          {/* Version Compare Drawer */}
          <VersionCompareDrawer
            open={compareDrawerVisible}
            onClose={() => setCompareDrawerVisible(false)}
            versionA={compareVersionA}
            versionB={compareVersionB}
            diff={diff}
            loading={diffLoading}
          />

          {/* Deploy Version Modal */}
          <DeployVersionModal
            open={deployModalVisible}
            onCancel={() => setDeployModalVisible(false)}
            onOk={handleDeploySubmit}
            version={deployVersionItem}
            submitting={deploySubmitting}
            form={deployForm}
          />
        </>
      )}
    </div>
  );
};

export default ArtifactBrowser;
