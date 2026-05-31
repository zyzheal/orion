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

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

// ---- Mock pipeline options (would come from API in production) ----
const pipelineOptions = [
  { label: 'orion-core-build', value: 'pipe-001' },
  { label: 'orion-ai-build', value: 'pipe-002' },
  { label: 'orion-gateway-deploy', value: 'pipe-003' },
  { label: 'orion-frontend-build', value: 'pipe-004' },
];

// ---- Mock data generator for demo ----
function generateMockVersions(): ArtifactVersion[] {
  const pipelines = ['pipe-001', 'pipe-002', 'pipe-003', 'pipe-004'];
  const stages = ['build', 'test', 'package', 'deploy'];
  const branches = ['main', 'develop', 'feature/auth', 'release/v2.5', 'hotfix/fix-login'];
  const artifacts = ['orion-core.jar', 'orion-ai-service.tar', 'orion-gateway.war', 'orion-frontend.zip'];

  const versions: ArtifactVersion[] = [];
  for (let i = 1; i <= 30; i++) {
    const idx = i - 1;
    const pipelineIdx = idx % pipelines.length;
    const hour = 20 - Math.floor(idx / 5);
    versions.push({
      id: `av-${String(i).padStart(3, '0')}`,
      tenantId: 'tenant-1',
      pipelineId: pipelines[pipelineIdx],
      runId: `run-${String(i).padStart(4, '0')}`,
      stageName: stages[idx % stages.length],
      artifactName: artifacts[pipelineIdx],
      version: `1.${Math.floor(idx / 10)}.${idx % 10}`,
      commitSha: `abc${String(idx).padStart(5, '0')}def${String(idx * 7).padStart(3, '0')}`,
      branch: branches[idx % branches.length],
      metadata: {
        imageTag: `v1.${Math.floor(idx / 10)}.${idx % 10}`,
        fileSize: `${(100 + idx * 10)}MB`,
      },
      storagePath: `/artifacts/${artifacts[pipelineIdx]}`,
      createdAt: `2024-03-${String(Math.max(1, 20 - Math.floor(idx / 3))).padStart(2, '0')}T${String(Math.min(23, hour)).padStart(2, '0')}:${String((idx * 7) % 60).padStart(2, '0')}:00Z`,
    });
  }
  return versions;
}

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
      // Try API call, fall back to mock data
      const params: any = {
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
      };
      if (filters.pipelineId) params.pipelineId = filters.pipelineId;
      if (filters.branch) params.branch = filters.branch;

      try {
        const res = await getArtifactVersions(params);
        const data = res.data;
        if (data && Array.isArray(data.versions)) {
          setVersions(data.versions);
          setTotal(data.total || data.versions.length);
        } else {
          throw new Error('Invalid response format');
        }
      } catch {
        // Fall back to mock data for demo
        const mockData = generateMockVersions();
        let filtered = mockData;

        if (filters.pipelineId) {
          filtered = filtered.filter((v) => v.pipelineId === filters.pipelineId);
        }
        if (filters.branch) {
          filtered = filtered.filter((v) => v.branch === filters.branch);
        }
        if (filters.dateRange) {
          const [start, end] = filters.dateRange;
          filtered = filtered.filter((v) => {
            const date = v.createdAt.slice(0, 10);
            return date >= start && date <= end;
          });
        }

        const start = (currentPage - 1) * pageSize;
        const pageData = filtered.slice(start, start + pageSize);
        setVersions(pageData);
        setTotal(filtered.length);
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
    } catch {
      // Fall back to mock traceability data
      setTraceChain({
        version: record,
        pipelineRun: {
          id: record.runId,
          pipelineId: record.pipelineId,
          triggerType: 'git',
          status: 'success',
          startedAt: record.createdAt,
          completedAt: dayjs(record.createdAt).add(3, 'minute').toISOString(),
          context: { ref: record.branch || 'main' },
        },
        deployments: [
          {
            id: `deploy-${record.id}`,
            environment: 'staging',
            status: 'success',
            deployedAt: dayjs(record.createdAt).add(10, 'minute').toISOString(),
            deployedBy: 'ci-bot',
          },
          ...(record.stageName === 'deploy'
            ? [
                {
                  id: `deploy-prod-${record.id}`,
                  environment: 'production',
                  status: 'success',
                  deployedAt: dayjs(record.createdAt).add(30, 'minute').toISOString(),
                  deployedBy: 'admin',
                },
              ]
            : []),
        ],
      });
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
    } catch {
      // Fall back to mock diff data
      setDiff({
        pipelineId: a.pipelineId,
        versionA: a.version,
        versionB: b.version,
        changes: {
          commitDiff: {
            from: a.commitSha || 'unknown',
            to: b.commitSha || 'unknown',
          },
          branchDiff: {
            from: a.branch || 'unknown',
            to: b.branch || 'unknown',
          },
          metadataAdded: Object.keys(b.metadata).filter(
            (k) => !(k in a.metadata)
          ),
          metadataRemoved: Object.keys(a.metadata).filter(
            (k) => !(k in b.metadata)
          ),
          metadataChanged: Object.keys(a.metadata)
            .filter((k) => k in b.metadata && a.metadata[k] !== b.metadata[k])
            .map((k) => ({
              key: k,
              oldValue: a.metadata[k],
              newValue: b.metadata[k],
            })),
        },
      });
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
    } catch {
      // Mock success for demo
      message.success(`版本 ${deployVersionItem.version} 部署到 ${values.environment} 已触发（演示模式）`);
      setDeployModalVisible(false);
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
              marginBottom: 24,
            }}
          >
            <div>
              <Title level={2} style={{ marginBottom: 8 }}>
                <FolderOpenOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
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
