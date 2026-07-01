/**
 * Script Version Management Page
 * Script content version tracking with diff comparison
 */
import React, { useState } from 'react';
import {
  Typography, Button, Space, Tag, message, Table, Modal, Form, Input, Select,
  Tabs, Empty,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined,
  BranchesOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';
import {
  getScriptVersions, createScriptVersion, deleteScriptVersion,
  diffScriptVersions,
  type ScriptVersion, type ScriptVersionDiff,
} from '@/api/script-versions';

const { Title, Text } = Typography;

const ScriptVersionsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [scriptId, setScriptId] = useState('default-script');
  const [versions, setVersions] = useState<ScriptVersion[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<ScriptVersion | null>(null);
  const [diffVisible, setDiffVisible] = useState(false);
  const [diffData, setDiffData] = useState<ScriptVersionDiff | null>(null);
  const [diffV1, setDiffV1] = useState('');
  const [diffV2, setDiffV2] = useState('');
  const [form] = Form.useForm();

  const loadVersions = async () => {
    if (!scriptId) return;
    setLoading(true);
    try {
      const res = await getScriptVersions(scriptId);
      setVersions(res.data || []);
    } catch {
      message.error('加载版本列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingItem(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: ScriptVersion) => {
    setEditingItem(record);
    form.setFieldsValue({
      version: record.version,
      content: record.content,
      parameters: JSON.stringify(record.parameters, null, 2),
      changeDescription: record.changeDescription,
      createdBy: record.createdBy,
    });
    setModalVisible(true);
  };

  const handleDelete = (record: ScriptVersion) => {
    Modal.confirm({
      title: '确认删除',
      content: `删除版本 "${record.version}" ?`,
      okText: '删除',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteScriptVersion(scriptId, record.version);
          message.success('删除成功');
          loadVersions();
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      let parameters: Record<string, unknown> = {};
      if (values.parameters) {
        try {
          parameters = typeof values.parameters === 'string'
            ? JSON.parse(values.parameters)
            : values.parameters;
        } catch {
          message.error('Parameters 必须是合法 JSON');
          return;
        }
      }
      await createScriptVersion(scriptId, {
        version: values.version,
        content: values.content,
        parameters,
        changeDescription: values.changeDescription,
        createdBy: values.createdBy || 'system',
      });
      message.success('创建版本成功');
      setModalVisible(false);
      loadVersions();
    } catch {
      // validation failed
    }
  };

  const handleDiff = async () => {
    if (!diffV1 || !diffV2) {
      message.error('请选择两个版本进行对比');
      return;
    }
    try {
      const res = await diffScriptVersions(scriptId, diffV1, diffV2);
      setDiffData(res.data || null);
      message.success('对比完成');
    } catch {
      message.error('对比失败');
    }
  };

  const versionList = versions.map(v => v.version);

  const columns = [
    {
      title: 'Version',
      dataIndex: 'version',
      width: 120,
      render: (v: string) => <Text strong code>{v}</Text>,
    },
    {
      title: 'Content Hash',
      dataIndex: 'contentHash',
      width: 80,
      render: (v: string) => <Text code style={{ fontSize: 11 }}>{v.slice(0, 8)}</Text>,
    },
    {
      title: 'Change Description',
      dataIndex: 'changeDescription',
      ellipsis: true,
    },
    {
      title: 'Created By',
      dataIndex: 'createdBy',
      width: 120,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      width: 180,
      render: (_: unknown, r: ScriptVersion) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>
            查看
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg }}>
        <div style={{ flex: 1 }}>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <FileTextOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            脚本版本管理
          </Title>
          <Text type="secondary">脚本内容版本追踪与变更对比</Text>
        </div>
        <Space>
          <Input
            placeholder="Script ID"
            value={scriptId}
            onChange={(e) => setScriptId(e.target.value)}
            style={{ width: 200 }}
            onPressEnter={loadVersions}
          />
          <Button icon={<BranchesOutlined />} onClick={() => { setDiffVisible(true); setDiffData(null); setDiffV1(''); setDiffV2(''); }}>
            版本对比
          </Button>
          <Button icon={<PlusOutlined />} type="primary" onClick={handleCreate}>
            创建版本
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadVersions} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {versions.length === 0 && !loading ? (
        <Empty description="暂无版本，点击「创建版本」开始">
          <Button type="primary" onClick={handleCreate}>创建版本</Button>
        </Empty>
      ) : (
        <Table
          columns={columns}
          dataSource={versions}
          loading={loading}
          rowKey="id"
          size="middle"
          pagination={{ pageSize: 20 }}
        />
      )}

      {/* Create Version Modal */}
      <Modal
        title={editingItem ? '查看版本' : '创建版本'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        okText={editingItem ? '关闭' : '创建'}
        width={700}
      >
        <Form form={form} layout="vertical" style={{ marginTop: spacing.md }}>
          <Form.Item name="version" label="Version" rules={[{ required: true, message: '请输入版本号' }]}>
            <Input placeholder="如: v1.0.0" disabled={!!editingItem} />
          </Form.Item>
          <Form.Item name="content" label="Content" rules={[{ required: true, message: '请输入脚本内容' }]}>
            <Input.TextArea rows={8} placeholder="脚本内容" disabled={!!editingItem} />
          </Form.Item>
          <Form.Item name="parameters" label="Parameters (JSON)">
            <Input.TextArea rows={3} placeholder='{"timeout": 30}' disabled={!!editingItem} />
          </Form.Item>
          <Form.Item name="changeDescription" label="Change Description">
            <Input placeholder="变更说明" disabled={!!editingItem} />
          </Form.Item>
          <Form.Item name="createdBy" label="Created By">
            <Input placeholder="创建人" disabled={!!editingItem} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Diff Modal */}
      <Modal
        title={`版本对比 — ${scriptId}`}
        open={diffVisible}
        onCancel={() => setDiffVisible(false)}
        onOk={handleDiff}
        okText="对比"
        width={800}
      >
        <Space.Compact style={{ marginBottom: spacing.md, width: '100%' }}>
          <Select
            placeholder="选择版本 V1"
            value={diffV1 || undefined}
            onChange={setDiffV1}
            style={{ width: '45%' }}
            options={versionList.map(v => ({ value: v, label: v }))}
            allowClear
          />
          <span style={{ lineHeight: '32px', color: colors.neutral[500] }}>vs</span>
          <Select
            placeholder="选择版本 V2"
            value={diffV2 || undefined}
            onChange={setDiffV2}
            style={{ width: '45%' }}
            options={versionList.map(v => ({ value: v, label: v }))}
            allowClear
          />
        </Space.Compact>
        {diffData && (
          <div>
            <Tabs
              items={[
                {
                  key: 'summary',
                  label: '概要',
                  children: (
                    <div>
                      <p><Text strong>Summary: </Text>{diffData.summary}</p>
                      <Space>
                        <Tag color="green">+{diffData.added.length} Added</Tag>
                        <Tag color="red">-{diffData.removed.length} Removed</Tag>
                        <Tag color="orange">~{diffData.modified.length} Modified</Tag>
                        <Tag color="default">={diffData.unchanged.length} Unchanged</Tag>
                      </Space>
                    </div>
                  ),
                },
                {
                  key: 'added',
                  label: `Added (${diffData.added.length})`,
                  children: diffData.added.length > 0
                    ? <pre style={{ maxHeight: 300, overflow: 'auto', background: '#f5f5f5', padding: 12 }}>{diffData.added.join('\n')}</pre>
                    : <Empty description="无新增行" />,
                },
                {
                  key: 'removed',
                  label: `Removed (${diffData.removed.length})`,
                  children: diffData.removed.length > 0
                    ? <pre style={{ maxHeight: 300, overflow: 'auto', background: '#f5f5f5', padding: 12, color: colors.error[500] }}>{diffData.removed.join('\n')}</pre>
                    : <Empty description="无删除行" />,
                },
                {
                  key: 'modified',
                  label: `Modified (${diffData.modified.length})`,
                  children: diffData.modified.length > 0
                    ? <pre style={{ maxHeight: 300, overflow: 'auto', background: '#f5f5f5', padding: 12 }}>{diffData.modified.join('\n')}</pre>
                    : <Empty description="无变更行" />,
                },
              ]}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ScriptVersionsPage;
