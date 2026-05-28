/**
 * Pipeline Version Management Page
 * Version list, diff comparison, rollback, tag management
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Modal,
  Form,
  Input,
  message,
  Table as AntTable,
  Select,
  Drawer,
  Descriptions,
  Tooltip,
  Popconfirm,
  Tabs,
  Alert,
} from 'antd';
import {
  ReloadOutlined,
  RollbackOutlined,
  TagsOutlined,
  DiffOutlined,
  EyeOutlined,
  PushpinOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';
import type { ColumnsType } from 'antd/es/table';
import { pipelineVersionsApi } from '@/api/pipeline-versions';
import type { PipelineVersion, VersionDiff, DiffItem } from '@/api/pipeline-versions';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

// ---- Color maps ----

const tagColorMap: Record<string, string> = {
  stable: 'green',
  beta: 'blue',
  rc: 'orange',
  production: 'red',
  baseline: 'gold',
};

// ---- Diff Display Component ----

const DiffDisplay: React.FC<{ diff: VersionDiff }> = ({ diff }) => {
  const items = [
    { key: 'additions', label: `新增 (${diff.additions.length})`, items: diff.additions, color: 'green' },
    { key: 'deletions', label: `删除 (${diff.deletions.length})`, items: diff.deletions, color: 'red' },
    { key: 'modifications', label: `修改 (${diff.modifications.length})`, items: diff.modifications, color: 'blue' },
  ];

  return (
    <div>
      <Text type="secondary" style={{ marginBottom: 12, display: 'block' }}>
        {diff.summary}
      </Text>
      <Tabs
        items={items.map(({ key, label, items: list, color }) => ({
          key,
          label,
          children: list.length === 0 ? (
            <Text type="secondary">无变更</Text>
          ) : (
            <div>
              {list.map((item: DiffItem, idx: number) => (
                <div
                  key={idx}
                  style={{
                    padding: '8px 12px',
                    marginBottom: 8,
                    background: color === 'green' ? colors.success[50] : color === 'red' ? colors.error[50] : colors.primary[50],
                    borderRadius: 4,
                    borderLeft: `3px solid ${color === 'green' ? colors.success[500] : color === 'red' ? colors.error[500] : colors.primary[500]}`,
                  }}
                >
                  <Tag color={color}>{item.type}</Tag>
                  <Text strong style={{ marginLeft: 8 }}>{item.path}</Text>
                  {item.oldValue !== undefined && item.oldValue !== null && (
                    <div style={{ marginTop: 4 }}>
                      <Text type="secondary">旧值: </Text>
                      <Paragraph
                        copyable={{ text: JSON.stringify(item.oldValue) }}
                        style={{ margin: 0, display: 'inline' }}
                      >
                        <code>{JSON.stringify(item.oldValue)}</code>
                      </Paragraph>
                    </div>
                  )}
                  {item.newValue !== undefined && item.newValue !== null && (
                    <div style={{ marginTop: 4 }}>
                      <Text type="secondary">新值: </Text>
                      <Paragraph
                        copyable={{ text: JSON.stringify(item.newValue) }}
                        style={{ margin: 0, display: 'inline' }}
                      >
                        <code>{JSON.stringify(item.newValue)}</code>
                      </Paragraph>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ),
        }))}
      />
    </div>
  );
};

// ---- Main Component ----

const PipelineVersionPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [versions, setVersions] = useState<PipelineVersion[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('pipeline-demo-1');
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<PipelineVersion | null>(null);
  const [diffModalVisible, setDiffModalVisible] = useState(false);
  const [diffResult, setDiffResult] = useState<VersionDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffForm] = Form.useForm();
  const [rollbackModalVisible, setRollbackModalVisible] = useState(false);
  const [rollbackForm] = Form.useForm();
  const [rollbackLoading, setRollbackLoading] = useState(false);
  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [tagForm] = Form.useForm();
  const [tagLoading, setTagLoading] = useState(false);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const res = await pipelineVersionsApi.list(selectedPipelineId, { page: 1, limit: 100 });
      const raw = res.data?.data;
      setVersions(Array.isArray(raw) ? raw : []);
    } catch (error: unknown) {
      setVersions([]);
      message.error(`加载版本列表失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVersions();
  }, [selectedPipelineId]);

  const handleViewDiff = async () => {
    try {
      const values = await diffForm.validateFields();
      setDiffLoading(true);
      const res = await pipelineVersionsApi.diff(
        selectedPipelineId,
        values.sourceVersion,
        values.targetVersion
      );
      setDiffResult(res || null);
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`获取版本对比失败: ${(error as Error).message}`);
      }
    } finally {
      setDiffLoading(false);
    }
  };

  const handleRollback = async () => {
    if (!selectedVersion) return;
    try {
      const values = await rollbackForm.validateFields();
      setRollbackLoading(true);
      await pipelineVersionsApi.rollback(
        selectedPipelineId,
        selectedVersion.id,
        values.reason
      );
      message.success('回退成功');
      setRollbackModalVisible(false);
      rollbackForm.resetFields();
      loadVersions();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`回退失败: ${(error as Error).message}`);
      }
    } finally {
      setRollbackLoading(false);
    }
  };

  const handleAddTag = async () => {
    if (!selectedVersion) return;
    try {
      const values = await tagForm.validateFields();
      setTagLoading(true);
      await pipelineVersionsApi.addTag(selectedPipelineId, selectedVersion.id, values.tag);
      message.success('标签添加成功');
      setTagModalVisible(false);
      tagForm.resetFields();
      loadVersions();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`添加标签失败: ${(error as Error).message}`);
      }
    } finally {
      setTagLoading(false);
    }
  };

  const handleRemoveTag = async (version: PipelineVersion, tag: string) => {
    try {
      await pipelineVersionsApi.removeTag(selectedPipelineId, version.id, tag);
      message.success('标签已移除');
      loadVersions();
    } catch (error: unknown) {
      message.error(`移除标签失败: ${(error as Error).message}`);
    }
  };

  const handleSetBaseline = async (version: PipelineVersion, isBaseline: boolean) => {
    try {
      await pipelineVersionsApi.setBaseline(selectedPipelineId, version.id, isBaseline);
      message.success(isBaseline ? '已设为基线' : '已取消基线');
      loadVersions();
    } catch (error: unknown) {
      message.error(`操作失败: ${(error as Error).message}`);
    }
  };

  const openDiffModal = () => {
    diffForm.resetFields();
    setDiffResult(null);
    setDiffModalVisible(true);
  };

  const openDetail = (version: PipelineVersion) => {
    setSelectedVersion(version);
    setDetailDrawerVisible(true);
  };

  const openRollbackModal = (version: PipelineVersion) => {
    setSelectedVersion(version);
    rollbackForm.resetFields();
    setRollbackModalVisible(true);
  };

  const openTagModal = (version: PipelineVersion) => {
    setSelectedVersion(version);
    tagForm.resetFields();
    setTagModalVisible(true);
  };

  // ---- Table columns ----

  const columns: ColumnsType<PipelineVersion> = [
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80,
      sorter: (a, b) => a.version - b.version,
      render: (v: number, record) => (
        <Text strong style={{ cursor: 'pointer' }} onClick={() => openDetail(record)}>
          v{v}
        </Text>
      ),
    },
    {
      title: '变更摘要',
      dataIndex: 'change_summary',
      key: 'change_summary',
      ellipsis: true,
      render: (v: unknown, record) => {
        // Support both snake_case and camelCase from backend
        const summary = (v as string) || (record as { changeSummary?: string }).changeSummary || '-';
        return <Text type="secondary">{summary}</Text>;
      },
    },
    {
      title: '性能指标',
      key: 'metrics',
      width: 150,
      render: (_, record) => {
        const durationMs = (record as { durationMs?: number }).durationMs;
        const successRate = (record as { successRate?: number }).successRate;
        return (
          <Space direction="vertical" size={0}>
            {durationMs !== undefined && (
              <Text style={{ fontSize: 12 }}>
                耗时: {(durationMs / 1000).toFixed(1)}s
              </Text>
            )}
            {successRate !== undefined && (
              <Text style={{ fontSize: 12 }}>
                成功率: {(successRate * 100).toFixed(1)}%
              </Text>
            )}
            {durationMs === undefined && successRate === undefined && (
              <Text type="secondary">-</Text>
            )}
          </Space>
        );
      },
    },
    {
      title: '标签',
      key: 'tags',
      width: 200,
      render: (_, record) => (
        <Space wrap size={2}>
          {record.tags?.map((tag) => (
            <Tag
              key={tag}
              color={tagColorMap[tag]}
              closable
              onClose={(e) => {
                e.preventDefault();
                handleRemoveTag(record, tag);
              }}
            >
              {tag}
            </Tag>
          ))}
          {record.is_baseline && <Tag color="gold" icon={<PushpinOutlined />}>基线</Tag>}
        </Space>
      ),
    },
    {
      title: '创建人',
      dataIndex: 'created_by',
      key: 'created_by',
      width: 120,
      render: (v: unknown) => <Text type="secondary">{(v as string) || '-'}</Text>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      sorter: (a, b) => dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf(),
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {v ? dayjs(String(v)).format('YYYY-MM-DD HH:mm:ss') : '-'}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 240,
      render: (_, record) => (
        <Space size="small" wrap>
          <Tooltip title="详情">
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>
              详情
            </Button>
          </Tooltip>
          <Tooltip title="对比">
            <Button type="link" size="small" icon={<DiffOutlined />} onClick={() => {
              diffForm.setFieldsValue({ sourceVersion: record.id });
              openDiffModal();
            }} />
          </Tooltip>
          <Tooltip title="回退">
            <Button
              type="link"
              size="small"
              icon={<RollbackOutlined />}
              onClick={() => openRollbackModal(record)}
            >
              回退
            </Button>
          </Tooltip>
          <Tooltip title="添加标签">
            <Button type="link" size="small" icon={<TagsOutlined />} onClick={() => openTagModal(record)} />
          </Tooltip>
          {!record.is_baseline && (
            <Popconfirm
              title="设为基线版本?"
              onConfirm={() => handleSetBaseline(record, true)}
            >
              <Button type="link" size="small" icon={<PushpinOutlined />}>
                设为基线
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  // Version options for diff modal
  const versionOptions = useMemo(
    () => versions.map((v) => ({ label: `v${v.version}${v.change_summary ? ` - ${v.change_summary}` : ''}`, value: v.id })),
    [versions]
  );

  return (
    <div style={{ padding: 0 }}>
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
            <TagsOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            流水线版本管理
          </Title>
          <Text type="secondary">管理流水线定义的版本、对比差异、回退操作和标签管理</Text>
        </div>
        <Space>
          <Select
            value={selectedPipelineId}
            onChange={setSelectedPipelineId}
            style={{ width: 240 }}
            options={[
              { label: 'Demo Pipeline 1', value: 'pipeline-demo-1' },
              { label: 'Build & Test Pipeline', value: 'pipeline-demo-2' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={loadVersions} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {/* Version List */}
      <Card>
        <AntTable<PipelineVersion>
          columns={columns}
          dataSource={versions}
          loading={loading}
          rowKey="id"
          size="middle"
          pagination={{ pageSize: 20, showSizeChanger: true, showQuickJumper: true }}
        />
      </Card>

      {/* Detail Drawer */}
      <Drawer
        title={selectedVersion ? `版本 v${selectedVersion.version}` : '版本详情'}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={800}
        destroyOnClose
      >
        {selectedVersion && (
          <>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="版本">v{selectedVersion.version}</Descriptions.Item>
              <Descriptions.Item label="基线">
                {selectedVersion.is_baseline ? <Tag color="gold">是</Tag> : <Tag>否</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="创建人">{selectedVersion.created_by || '-'}</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {dayjs(selectedVersion.created_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="变更摘要" span={2}>
                {selectedVersion.change_summary || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="标签" span={2}>
                <Space wrap>
                  {selectedVersion.tags?.map((tag) => (
                    <Tag key={tag} color={tagColorMap[tag]}>{tag}</Tag>
                  ))}
                  {(!selectedVersion.tags || selectedVersion.tags.length === 0) && (
                    <Text type="secondary">无</Text>
                  )}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="父版本">
                {selectedVersion.parent_version_id || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="版本 ID">
                <Text copyable style={{ fontSize: 12 }}>{selectedVersion.id}</Text>
              </Descriptions.Item>
              {/* Additional metrics if available */}
              {(selectedVersion as { durationMs?: number }).durationMs !== undefined && (
                <Descriptions.Item label="执行耗时">
                  {(((selectedVersion as { durationMs?: number }).durationMs as number) / 1000).toFixed(1)}s
                </Descriptions.Item>
              )}
              {(selectedVersion as { successRate?: number }).successRate !== undefined && (
                <Descriptions.Item label="成功率">
                  {(((selectedVersion as { successRate?: number }).successRate as number) * 100).toFixed(1)}%
                </Descriptions.Item>
              )}
            </Descriptions>

            {/* YAML Definition */}
            {selectedVersion.yaml_definition && (
              <div style={{ marginTop: 24 }}>
                <Title level={5}>YAML 定义</Title>
                <pre
                  style={{
                    background: colors.neutral[100],
                    padding: 16,
                    borderRadius: 4,
                    fontSize: 13,
                    overflow: 'auto',
                    maxHeight: 400,
                  }}
                >
                  {selectedVersion.yaml_definition}
                </pre>
              </div>
            )}

            {/* Quick Actions */}
            <div style={{ marginTop: 24 }}>
              <Title level={5}>快捷操作</Title>
              <Space wrap>
                <Button icon={<RollbackOutlined />} onClick={() => openRollbackModal(selectedVersion)}>
                  回退到此版本
                </Button>
                <Button icon={<TagsOutlined />} onClick={() => openTagModal(selectedVersion)}>
                  添加标签
                </Button>
                {!selectedVersion.is_baseline && (
                  <Button icon={<PushpinOutlined />} onClick={() => handleSetBaseline(selectedVersion, true)}>
                    设为基线
                  </Button>
                )}
              </Space>
            </div>
          </>
        )}
      </Drawer>

      {/* Diff Modal */}
      <Modal
        title="版本对比"
        open={diffModalVisible}
        onCancel={() => setDiffModalVisible(false)}
        footer={null}
        width={900}
        destroyOnClose
      >
        <Form form={diffForm} layout="inline" style={{ marginBottom: 16 }}>
          <Form.Item name="sourceVersion" label="源版本" rules={[{ required: true, message: '请选择源版本' }]}>
            <Select options={versionOptions} style={{ width: 240 }} placeholder="选择源版本" />
          </Form.Item>
          <Form.Item name="targetVersion" label="目标版本" rules={[{ required: true, message: '请选择目标版本' }]}>
            <Select options={versionOptions} style={{ width: 240 }} placeholder="选择目标版本" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" icon={<DiffOutlined />} onClick={handleViewDiff} loading={diffLoading}>
              对比
            </Button>
          </Form.Item>
        </Form>
        {diffResult && <DiffDisplay diff={diffResult} />}
      </Modal>

      {/* Rollback Modal */}
      <Modal
        title="版本回退"
        open={rollbackModalVisible}
        onCancel={() => setRollbackModalVisible(false)}
        onOk={handleRollback}
        confirmLoading={rollbackLoading}
        destroyOnClose
      >
        {selectedVersion && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Text>
                即将回退到 <Text strong>v{selectedVersion.version}</Text>
                {selectedVersion.change_summary && ` (${selectedVersion.change_summary})`}
              </Text>
            </div>
            <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="版本 ID">{selectedVersion.id}</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {dayjs(selectedVersion.created_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="标签">
                <Space size={4}>
                  {selectedVersion.tags?.map((tag) => <Tag key={tag} color={tagColorMap[tag]}>{tag}</Tag>)}
                  {(!selectedVersion.tags || selectedVersion.tags.length === 0) && <Text type="secondary">无</Text>}
                </Space>
              </Descriptions.Item>
            </Descriptions>
            <Alert
              message="回退操作将创建新版本"
              description="当前流水线的 YAML 定义将被替换为目标版本的内容，同时创建一个新的版本记录。此操作不会删除现有版本。"
              type="warning"
              showIcon
            />
          </div>
        )}
        <Form form={rollbackForm} layout="vertical">
          <Form.Item name="reason" label="回退原因" rules={[{ required: true, message: '请输入回退原因' }]}>
            <Input.TextArea rows={3} placeholder="请说明回退原因..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Tag Modal */}
      <Modal
        title="添加标签"
        open={tagModalVisible}
        onCancel={() => setTagModalVisible(false)}
        onOk={handleAddTag}
        confirmLoading={tagLoading}
        destroyOnClose
      >
        {selectedVersion && (
          <div style={{ marginBottom: 12 }}>
            <Text>当前标签: </Text>
            <Space wrap size={4}>
              {selectedVersion.tags?.map((tag) => <Tag key={tag}>{tag}</Tag>)}
              {(!selectedVersion.tags || selectedVersion.tags.length === 0) && <Text type="secondary">无</Text>}
            </Space>
          </div>
        )}
        <Form form={tagForm} layout="vertical">
          <Form.Item name="tag" label="标签名" rules={[{ required: true, message: '请输入标签名' }]}>
            <Select
              options={[
                { label: 'stable', value: 'stable' },
                { label: 'beta', value: 'beta' },
                { label: 'rc', value: 'rc' },
                { label: 'production', value: 'production' },
                { label: 'baseline', value: 'baseline' },
                { label: 'hotfix', value: 'hotfix' },
              ]}
              mode="tags"
              placeholder="选择或输入标签"
              maxTagCount={5}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PipelineVersionPage;
