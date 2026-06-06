/**
 * PR/MR Trigger Management Page
 * Manage Pull Request / Merge Request trigger rules for pipelines
 * with path filtering, branch filtering, and status callback configuration.
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Table,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  message,
  Statistic,
  Row,
  Col,
  Divider,
} from 'antd';
import {
  GitlabOutlined,
  GithubOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import {
  getPRTriggerRules,
  createPRTrigger,
  updatePRTrigger,
  deletePRTrigger,
  type PRTriggerRule,
} from '@/api/prTriggers';
import { getPipelines } from '@/api/pipelines';
import PRTriggerConfig from '@/components/PRTriggerConfig';
import type { PRTriggerConfig as PRTriggerConfigType } from '@/components/PRTriggerConfig';

const { Title, Text } = Typography;

const providerLabel: Record<string, string> = {
  github: 'GitHub PR',
  gitlab: 'GitLab MR',
  both: 'GitHub + GitLab',
};

const securityLabel: Record<string, string> = {
  safe: '安全模式',
  trusted: '信任模式',
  full: '完全模式',
};

interface PRTriggerFormValues {
  pipelineId: string;
  repository: string;
}

const PRTriggerManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<PRTriggerRule[]>([]);
  const [pipelines, setPipelines] = useState<{ label: string; value: string }[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<PRTriggerRule | null>(null);
  const [form] = Form.useForm();
  const [prConfig, setPrConfig] = useState<Partial<PRTriggerConfigType>>({
    enabled: true,
    provider: 'github',
    prActions: ['opened', 'synchronize'],
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [rulesRes, pipelinesRes] = await Promise.allSettled([
        getPRTriggerRules(''), // Get all rules across pipelines
        getPipelines(),
      ]);

      if (rulesRes.status === 'fulfilled') {
        const data = rulesRes.value.data;
        setRules(Array.isArray(data) ? data : []);
      }

      if (pipelinesRes.status === 'fulfilled') {
        const data = pipelinesRes.value.data;
        const list = Array.isArray(data) ? data : [];
        setPipelines(list.map((p: { id: string; name: string }) => ({
          label: p.name,
          value: p.id,
        })));
      }
    } catch (error: unknown) {
      message.error(`加载数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (values: PRTriggerFormValues) => {
    try {
      await createPRTrigger(values.pipelineId, {
        provider: prConfig.provider || 'github',
        repository: values.repository,
        enabled: true,
        prActions: prConfig.prActions || ['opened', 'synchronize'],
        branchFilter: prConfig.branchFilter || { targetBranches: ['main'], sourceBranches: [] },
        pathFilter: prConfig.pathFilter || { includePaths: [], excludePaths: [] },
        labelFilter: prConfig.labelFilter || { requiredLabels: [], excludedLabels: [] },
        draftPolicy: (prConfig.draftPolicy || 'skip') as 'skip' | 'run',
        securityLevel: (prConfig.securityLevel || 'safe') as 'safe' | 'trusted' | 'full',
        statusCheckName: prConfig.statusCheckName,
        autoComment: prConfig.autoComment || false,
        commentTemplate: prConfig.commentTemplate,
      } as Omit<PRTriggerRule, 'id' | 'createdAt' | 'updatedAt'>);
      message.success('PR触发规则创建成功');
      setModalVisible(false);
      form.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(`创建失败: ${(error as Error).message}`);
    }
  };

  const handleUpdate = async (ruleId: string, values: PRTriggerFormValues) => {
    try {
      // Find the pipelineId from the existing rule
      const existingRule = rules.find((r) => r.id === ruleId);
      if (!existingRule) return;

      await updatePRTrigger(existingRule.pipelineId, ruleId, {
        provider: prConfig.provider || existingRule.provider,
        repository: values.repository || existingRule.repository,
        prActions: prConfig.prActions || existingRule.prActions,
        branchFilter: prConfig.branchFilter || existingRule.branchFilter,
        pathFilter: prConfig.pathFilter || existingRule.pathFilter,
        labelFilter: prConfig.labelFilter || existingRule.labelFilter,
        draftPolicy: prConfig.draftPolicy || existingRule.draftPolicy,
        securityLevel: prConfig.securityLevel || existingRule.securityLevel,
        statusCheckName: prConfig.statusCheckName,
        autoComment: prConfig.autoComment ?? existingRule.autoComment,
        commentTemplate: prConfig.commentTemplate,
      });
      message.success('PR触发规则更新成功');
      setModalVisible(false);
      form.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(`更新失败: ${(error as Error).message}`);
    }
  };

  const handleDelete = async (ruleId: string) => {
    const existingRule = rules.find((r) => r.id === ruleId);
    if (!existingRule) return;

    Modal.confirm({
      title: '确认删除',
      content: '确定要删除此PR触发规则吗？',
      onOk: async () => {
        try {
          await deletePRTrigger(existingRule.pipelineId, ruleId);
          message.success('PR触发规则已删除');
          loadData();
        } catch (error: unknown) {
          message.error(`删除失败: ${(error as Error).message}`);
        }
      },
    });
  };

  const handleToggle = async (ruleId: string, newEnabledState: boolean) => {
    const existingRule = rules.find((r) => r.id === ruleId);
    if (!existingRule) return;

    try {
      await updatePRTrigger(existingRule.pipelineId, ruleId, { enabled: newEnabledState });
      message.success(newEnabledState ? '规则已启用' : '规则已禁用');
      loadData();
    } catch (error: unknown) {
      message.error(`更新失败: ${(error as Error).message}`);
    }
  };

  const handleEdit = (record: PRTriggerRule) => {
    setEditingRule(record);
    setPrConfig({
      enabled: true,
      provider: record.provider,
      prActions: record.prActions,
      branchFilter: record.branchFilter,
      pathFilter: record.pathFilter,
      labelFilter: record.labelFilter,
      draftPolicy: record.draftPolicy,
      securityLevel: record.securityLevel,
      statusCheckName: record.statusCheckName,
      autoComment: record.autoComment,
      commentTemplate: record.commentTemplate,
    });
    form.setFieldsValue({
      pipelineId: record.pipelineId,
      repository: record.repository,
    });
    setModalVisible(true);
  };

  const handleModalClose = () => {
    setModalVisible(false);
    setEditingRule(null);
    form.resetFields();
    setPrConfig({
      enabled: true,
      provider: 'github',
      prActions: ['opened', 'synchronize'],
    });
  };

  const columns = [
    {
      title: '流水线',
      dataIndex: 'pipelineId',
      key: 'pipelineId',
      width: 180,
      render: (v: string) => {
        const pipeline = pipelines.find((p) => p.value === v);
        return <Text strong>{pipeline?.label || v.slice(0, 8)}...</Text>;
      },
    },
    {
      title: '仓库',
      dataIndex: 'repository',
      key: 'repository',
      width: 200,
      ellipsis: true,
    },
    {
      title: '平台',
      dataIndex: 'provider',
      key: 'provider',
      width: 140,
      render: (v: string) => (
        <Tag color={v === 'github' ? 'default' : v === 'gitlab' ? 'orange' : 'blue'}>
          {v === 'github' && <GithubOutlined />}
          {v === 'gitlab' && <GitlabOutlined />}
          {providerLabel[v] || v}
        </Tag>
      ),
    },
    {
      title: '触发事件',
      dataIndex: 'prActions',
      key: 'prActions',
      width: 180,
      render: (v: string[]) => (
        <Space wrap>
          {v.slice(0, 3).map((action) => (
            <Tag key={action} color="blue">{action}</Tag>
          ))}
          {v.length > 3 && <Tag>+{v.length - 3}</Tag>}
        </Space>
      ),
    },
    {
      title: '目标分支',
      key: 'branches',
      width: 150,
      render: (_: unknown, record: PRTriggerRule) => (
        <Space wrap>
          {record.branchFilter?.targetBranches?.slice(0, 2).map((b: string) => (
            <Tag key={b} color="green">{b}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '安全级别',
      dataIndex: 'securityLevel',
      key: 'securityLevel',
      width: 100,
      render: (v: string) => <Tag>{securityLabel[v] || v}</Tag>,
    },
    {
      title: '状态',
      key: 'status',
      width: 80,
      render: (_: unknown, record: PRTriggerRule) => (
        <Switch
          size="small"
          checked={record.enabled}
          onChange={() => handleToggle(record.id!, record.enabled)}
        />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: PRTriggerRule) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id!)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg }}>
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <ThunderboltOutlined style={{ marginRight: spacing.sm }} />
            PR/MR 触发管理
          </Title>
          <Text type="secondary">配置 Pull Request / Merge Request 触发规则和状态回写</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
            添加规则
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: spacing.lg }}>
        <Col span={6}>
          <Card>
            <Statistic title="触发规则" value={rules.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃规则"
              value={rules.filter((r) => r.enabled).length}
              valueStyle={{ color: colors.success?.[500] || colors.success[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="GitHub PR"
              value={rules.filter((r) => r.provider === 'github' || r.provider === 'both').length}
              prefix={<GithubOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="GitLab MR"
              value={rules.filter((r) => r.provider === 'gitlab' || r.provider === 'both').length}
              prefix={<GitlabOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Rules Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={rules}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        title={editingRule ? '编辑 PR 触发规则' : '添加 PR 触发规则'}
        open={modalVisible}
        onCancel={handleModalClose}
        onOk={() => {
          form.validateFields().then((values) => {
            if (editingRule) {
              handleUpdate(editingRule.id!, values);
            } else {
              handleCreate(values);
            }
          });
        }}
        width={900}
      >
        <Form form={form} layout="vertical" requiredMark>
          <Form.Item
            label="目标流水线"
            name="pipelineId"
            rules={[{ required: true, message: '请选择流水线' }]}
          >
            <Select
              placeholder="选择流水线"
              options={pipelines}
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>

          <Form.Item
            label="仓库"
            name="repository"
            rules={[{ required: true, message: '请输入仓库名称' }]}
            tooltip="格式: owner/repo"
          >
            <Input placeholder="例如: myorg/myapp" />
          </Form.Item>
        </Form>

        <Divider orientation="left" orientationMargin={0}>
          触发规则配置
        </Divider>

        <PRTriggerConfig
          value={prConfig}
          onChange={setPrConfig}
        />
      </Modal>
    </div>
  );
};

export default PRTriggerManagement;
