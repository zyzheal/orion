/**
 * Version Management Page
 *
 * Displays version history across Pipeline, Artifact, and Deploy services.
 * Supports version comparison, rollback, and baseline marking.
 *
 * Phase 6.12 - Task 6.12
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Tabs,
  Table,
  Button,
  Space,
  Tag,
  message,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Empty,
  Tooltip,
  Popconfirm,
} from 'antd';
import {
  CloudUploadOutlined,
  RollbackOutlined,
  TagOutlined,
  CompareOutlined,
  DeleteOutlined,
  PlusOutlined,
  ExportOutlined,
} from '@ant-design/icons';
import { colors, spacing, componentRadius } from '@/tokens';
import {
  listPipelineVersions,
  getPipelineVersion,
  rollbackPipelineVersion,
  setPipelineBaseline,
  type PipelineVersion,
} from '@/api/pipeline-versions';
import {
  getArtifactVersions,
  getVersionDiff,
  getDeploymentHistory,
  type ArtifactVersion,
} from '@/api/artifactVersions';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

type TabKey = 'pipeline' | 'artifact' | 'deploy';

const VersionManagement: React.FC = () => {
  // ==================== State ====================

  const [activeTab, setActiveTab] = useState<TabKey>('pipeline');
  const [loading, setLoading] = useState(false);
  const [pipelineVersions, setPipelineVersions] = useState<PipelineVersion[]>([]);
  const [artifactVersions, setArtifactVersions] = useState<ArtifactVersion[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [compareModalVisible, setCompareModalVisible] = useState(false);
  const [diffResult, setDiffResult] = useState<string | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  // ==================== Data Loading ====================

  const loadPipelineVersions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPipelineVersions();
      setPipelineVersions(data);
    } catch (err) {
      message.error('加载 Pipeline 版本失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadArtifactVersions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getArtifactVersions();
      setArtifactVersions(data);
    } catch (err) {
      message.error('加载制品版本失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'pipeline') loadPipelineVersions();
    if (activeTab === 'artifact') loadArtifactVersions();
  }, [activeTab, loadPipelineVersions, loadArtifactVersions]);

  // ==================== Actions ====================

  const handleRollback = async (record: PipelineVersion) => {
    try {
      await rollbackPipelineVersion(record.id);
      message.success(`版本 ${record.version} 已回滚`);
      loadPipelineVersions();
    } catch (err) {
      message.error('回滚失败');
    }
  };

  const handleSetBaseline = async (record: PipelineVersion) => {
    try {
      await setPipelineBaseline(record.id);
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
      const result = await getVersionDiff(v1, v2);
      setDiffResult(result);
      setCompareModalVisible(true);
    } catch (err) {
      message.error('版本对比失败');
    } finally {
      setDiffLoading(false);
    }
  };

  // ==================== Pipeline Columns ====================

  const pipelineColumns = [
    { title: '版本', dataIndex: 'version', key: 'version' },
    { title: 'Pipeline', dataIndex: 'pipelineName', key: 'pipelineName' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'success' ? 'green' : status === 'failed' ? 'red' : 'default'}>
          {status}
        </Tag>
      ),
    },
    {
      title: '基线',
      dataIndex: 'isBaseline',
      key: 'isBaseline',
      render: (isBaseline: boolean) =>
        isBaseline ? <Tag color="blue">基线</Tag> : <Tag>普通</Tag>,
    },
    { title: '创建人', dataIndex: 'createdBy', key: 'createdBy' },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (d: string) => new Date(d).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: PipelineVersion) => (
        <Space size="small">
          <Tooltip title="回滚到此版本">
            <Button
              size="small"
              icon={<RollbackOutlined />}
              onClick={() => handleRollback(record)}
            >
              回滚
            </Button>
          </Tooltip>
          <Tooltip title="设为基线版本">
            <Button
              size="small"
              icon={<TagOutlined />}
              onClick={() => handleSetBaseline(record)}
            >
              基线
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  // ==================== Artifact Columns ====================

  const artifactColumns = [
    { title: '版本', dataIndex: 'version', key: 'version' },
    { title: '制品名', dataIndex: 'artifactName', key: 'artifactName' },
    { title: '构建号', dataIndex: 'buildNumber', key: 'buildNumber' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'published' ? 'green' : status === 'draft' ? 'orange' : 'default'}>
          {status}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (d: string) => new Date(d).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: ArtifactVersion) => (
        <Space size="small">
          <Tooltip title="查看部署历史">
            <Button size="small" icon={<ExportOutlined />}>
              部署
            </Button>
          </Tooltip>
          <Popconfirm title="确认删除此版本？">
            <Button size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ==================== Tab Content ====================

  const tabItems = [
    {
      key: 'pipeline',
      label: (
        <Space>
          <CloudUploadOutlined />
          Pipeline 版本
        </Space>
      ),
      children: (
        <Card
          style={{
            borderRadius: componentRadius.card,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ marginBottom: spacing.md, display: 'flex', justifyContent: 'space-between' }}>
            <Space>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => message.info('创建版本功能由 Pipeline 运行触发')}
              >
                新建版本
              </Button>
              <Button
                icon={<CompareOutlined />}
                onClick={handleCompare}
                disabled={selectedRowKeys.length !== 2}
              >
                对比版本
              </Button>
            </Space>
            <Text type="secondary">选择 2 个版本进行对比</Text>
          </div>
          <Table
            rowSelection={{
              selectedRowKeys,
              onChange: setSelectedRowKeys,
              type: 'checkbox',
            }}
            columns={pipelineColumns}
            dataSource={pipelineVersions}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10, showSizeChanger: true }}
          />
        </Card>
      ),
    },
    {
      key: 'artifact',
      label: (
        <Space>
          <TagOutlined />
          制品版本
        </Space>
      ),
      children: (
        <Card
          style={{
            borderRadius: componentRadius.card,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ marginBottom: spacing.md }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => message.info('制品版本由构建流程自动生成')}
            >
              新建版本
            </Button>
          </div>
          <Table
            columns={artifactColumns}
            dataSource={artifactVersions}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10, showSizeChanger: true }}
          />
        </Card>
      ),
    },
    {
      key: 'deploy',
      label: (
        <Space>
          <ExportOutlined />
          部署版本
        </Space>
      ),
      children: (
        <Card
          style={{
            borderRadius: componentRadius.card,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
          }}
        >
          <Empty description="部署版本数据由 Deploy 服务提供" />
        </Card>
      ),
    },
  ];

  // ==================== Render ====================

  return (
    <div style={{ padding: spacing.lg }}>
      <Title
        level={2}
        style={{
          marginBottom: 8,
          fontWeight: 600,
          color: colors.neutral[900],
        }}
      >
        <CloudUploadOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        版本管理
      </Title>
      <Text
        type="secondary"
        style={{ marginBottom: spacing.md, display: 'block', fontSize: 14, color: colors.neutral[500] }}
      >
        管理 Pipeline、制品和部署版本，支持版本对比、回滚和基线标记
      </Text>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as TabKey)}
        items={tabItems}
        size="large"
      />

      {/* Version Compare Modal */}
      <Modal
        title="版本对比"
        open={compareModalVisible}
        onCancel={() => setCompareModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setCompareModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={800}
        style={{ borderRadius: componentRadius.modal }}
      >
        {diffLoading ? (
          <div style={{ textAlign: 'center', padding: spacing.xl }}>
            <Spin tip="对比中..." />
          </div>
        ) : diffResult ? (
          <pre
            style={{
              background: colors.light.bg.secondary,
              padding: spacing.md,
              borderRadius: componentRadius.input,
              maxHeight: 500,
              overflow: 'auto',
            }}
          >
            {diffResult}
          </pre>
        ) : (
          <Empty description="无对比结果" />
        )}
      </Modal>
    </div>
  );
};

export default VersionManagement;
