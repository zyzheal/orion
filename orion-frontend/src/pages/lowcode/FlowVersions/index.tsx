/**
 * FlowVersions - 低代码流程版本管理页面
 *
 * 功能：
 * - 选择流程，查看版本历史
 * - 创建版本快照（带变更说明）
 * - 查看版本详情（快照对比）
 * - 恢复/回滚到指定版本
 */

import React, { useState, useEffect } from 'react';
import {
  Button, Space, Tag, message, Table, Modal, Form, Input, Select, Empty, Card, Descriptions, Tooltip, Popconfirm, Typography,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, EyeOutlined, RollbackOutlined, HistoryOutlined, SaveOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { lowcodeApi, type LowcodeFlow, type LowcodeWorkflowVersion } from '@/api/lowcode';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Option } = Select;
const { Title, Text } = Typography;

// ==================== Types ====================

interface VersionCreateInput {
  changeLog: string;
}

// ==================== Component ====================

const FlowVersionsPage: React.FC = () => {
  const [flows, setFlows] = useState<LowcodeFlow[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<LowcodeFlow | null>(null);
  const [versions, setVersions] = useState<LowcodeWorkflowVersion[]>([]);
  const [totalVersions, setTotalVersions] = useState(0);
  const [loading, setLoading] = useState(false);
  const [versionLoading, setVersionLoading] = useState(false);

  const [createVisible, setCreateVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<LowcodeWorkflowVersion | null>(null);

  const [createForm] = Form.useForm();

  // ==================== Load flows ====================

  const loadFlows = async () => {
    setLoading(true);
    try {
      const result = await lowcodeApi.listFlows();
      setFlows(result.flows || []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '加载流程列表失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFlows();
  }, []);

  // ==================== Load versions ====================

  const loadVersions = async (flowId: string) => {
    setVersionLoading(true);
    try {
      const res = await lowcodeApi.listWorkflowVersions(flowId, { limit: 50, offset: 0 });
      setVersions(res.versions || []);
      setTotalVersions(res.total || 0);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '加载版本历史失败';
      message.error(msg);
    } finally {
      setVersionLoading(false);
    }
  };

  const handleSelectFlow = (flow: LowcodeFlow) => {
    setSelectedFlow(flow);
    loadVersions(flow.id);
  };

  // ==================== Create version ====================

  const handleCreateVersion = async (values: VersionCreateInput) => {
    if (!selectedFlow) return;
    try {
      await lowcodeApi.createWorkflowVersion(selectedFlow.id, {
        changeLog: values.changeLog,
      });
      message.success('版本快照创建成功');
      setCreateVisible(false);
      createForm.resetFields();
      loadVersions(selectedFlow.id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '创建版本失败';
      message.error(msg);
    }
  };

  // ==================== View version detail ====================

  const handleViewVersion = (version: LowcodeWorkflowVersion) => {
    setSelectedVersion(version);
    setDetailVisible(true);
  };

  // ==================== Restore version ====================

  const handleRestoreVersion = async (version: LowcodeWorkflowVersion) => {
    if (!selectedFlow) return;
    try {
      await lowcodeApi.updateFlow(selectedFlow.id, {
        nodes: version.snapshot?.nodes || [],
        edges: version.snapshot?.edges || [],
      });
      message.success(`已恢复到版本 ${version.version}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '恢复版本失败';
      message.error(msg);
    }
  };

  // ==================== Table columns ====================

  const columns = [
    {
      title: '版本号',
      dataIndex: 'version',
      key: 'version',
      width: 100,
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: '变更说明',
      dataIndex: 'changeLog',
      key: 'changeLog',
      ellipsis: true,
      render: (text?: string) => text || <Text type="secondary">无说明</Text>,
    },
    {
      title: '创建人',
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: 120,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
      sorter: (a: LowcodeWorkflowVersion, b: LowcodeWorkflowVersion) =>
        dayjs(a.createdAt).unix() - dayjs(b.createdAt).unix(),
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      fixed: 'right' as const,
      render: (_: unknown, record: LowcodeWorkflowVersion) => (
        <Space size="small">
          <Tooltip title="查看快照">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewVersion(record)}
            />
          </Tooltip>
          <Popconfirm
            title="恢复到此版本"
            description="恢复后将用该版本的节点/连线覆盖当前流程，确定吗？"
            onConfirm={() => handleRestoreVersion(record)}
            okText="恢复"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="恢复此版本">
              <Button size="small" danger icon={<RollbackOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ==================== Render ====================

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.md }}>
        <HistoryOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        流程版本管理
      </Title>

      <Card style={{ marginBottom: spacing.md }}>
        <div style={{ marginBottom: 12 }}>
          <Text strong style={{ marginRight: 12 }}>选择流程：</Text>
          <Select
            placeholder="请选择要管理版本的流程"
            style={{ width: 400 }}
            value={selectedFlow?.id}
            onChange={(id) => {
              const flow = flows.find((f) => f.id === id);
              if (flow) handleSelectFlow(flow);
            }}
            showSearch
            optionFilterProp="children"
            loading={loading}
            notFoundContent={loading ? '加载中...' : '暂无流程'}
          >
            {flows.map((flow) => (
              <Option key={flow.id} value={flow.id}>
                {flow.name} (v{flow.version})
              </Option>
            ))}
          </Select>
          <Button
            icon={<ReloadOutlined />}
            style={{ marginLeft: 8 }}
            onClick={loadFlows}
          >
            刷新
          </Button>
        </div>

        {selectedFlow && (
          <Descriptions size="small" column={3} bordered style={{ borderRadius: 8 }}>
            <Descriptions.Item label="流程ID">{selectedFlow.id}</Descriptions.Item>
            <Descriptions.Item label="流程名称">{selectedFlow.name}</Descriptions.Item>
            <Descriptions.Item label="当前版本">{selectedFlow.version}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={selectedFlow.status === 'published' ? 'green' : 'orange'}>
                {selectedFlow.status === 'published' ? '已启用' : '已禁用'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="创建人">{selectedFlow.createdBy || 'system'}</Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {dayjs(selectedFlow.updatedAt || selectedFlow.createdAt).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Card>

      <Card
        title={
          <Space>
            <span>版本历史</span>
            {selectedFlow && (
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => setCreateVisible(true)}
              >
                创建版本快照
              </Button>
            )}
          </Space>
        }
        extra={
          selectedFlow && (
            <Text type="secondary">
              共 {totalVersions} 个版本
            </Text>
          )
        }
      >
        {!selectedFlow ? (
          <Empty description="请先选择一个流程" />
        ) : versionLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: colors.neutral[500] }}>
            加载版本历史...
          </div>
        ) : versions.length === 0 ? (
          <Empty
            description="暂无版本记录"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateVisible(true)}
            >
              创建第一个版本快照
            </Button>
          </Empty>
        ) : (
          <Table
            columns={columns}
            dataSource={versions}
            rowKey="id"
            size="small"
            pagination={false}
            scroll={{ x: 800 }}
            style={{ borderRadius: 8 }}
          />
        )}
      </Card>

      <Modal
        title="创建版本快照"
        open={createVisible}
        onCancel={() => { setCreateVisible(false); createForm.resetFields(); }}
        footer={null}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreateVersion}>
          <Form.Item
            name="changeLog"
            label="变更说明"
            rules={[{ required: true, message: '请输入变更说明' }]}
          >
            <TextArea
              placeholder="描述本次版本的变更内容..."
              rows={4}
              maxLength={500}
              showCount
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block icon={<SaveOutlined />}>
              创建快照
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`版本详情: ${selectedVersion?.version}`}
        open={detailVisible}
        onCancel={() => { setDetailVisible(false); setSelectedVersion(null); }}
        width={700}
        footer={
          <Space>
            <Button onClick={() => { setDetailVisible(false); setSelectedVersion(null); }}>
              关闭
            </Button>
            {selectedFlow && selectedVersion && (
              <Popconfirm
                title="恢复到此版本"
                description="恢复后将用该版本的节点/连线覆盖当前流程，确定吗？"
                onConfirm={() => { handleRestoreVersion(selectedVersion); setDetailVisible(false); }}
                okText="恢复"
                cancelText="取消"
                okButtonProps={{ danger: true }}
              >
                <Button danger icon={<RollbackOutlined />}>恢复此版本</Button>
              </Popconfirm>
            )}
          </Space>
        }
      >
        {selectedVersion && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="版本ID">{selectedVersion.id}</Descriptions.Item>
            <Descriptions.Item label="版本号">{selectedVersion.version}</Descriptions.Item>
            <Descriptions.Item label="变更说明">{selectedVersion.changeLog || '无'}</Descriptions.Item>
            <Descriptions.Item label="创建人">{selectedVersion.createdBy}</Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {dayjs(selectedVersion.createdAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="节点快照">
              <pre style={{
                maxHeight: 200, overflow: 'auto', background: colors.neutral[100],
                padding: spacing.sm, borderRadius: 8, fontSize: 12,
              }}>
                {JSON.stringify(selectedVersion.snapshot?.nodes || [], null, 2)}
              </pre>
            </Descriptions.Item>
            <Descriptions.Item label="连线快照">
              <pre style={{
                maxHeight: 200, overflow: 'auto', background: colors.neutral[100],
                padding: spacing.sm, borderRadius: 8, fontSize: 12,
              }}>
                {JSON.stringify(selectedVersion.snapshot?.edges || [], null, 2)}
              </pre>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default FlowVersionsPage;
