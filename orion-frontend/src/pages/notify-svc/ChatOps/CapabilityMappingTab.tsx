/**
 * CapabilityMappingTab - 命令-Capability 映射管理
 * 抽取自 AdminSettings.tsx (P2-9 Phase 41)
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Typography,
  message,
  Popconfirm,
  Empty,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  chatopsAdminApi,
  type CapabilityMapping,
  type CreateCapabilityMappingInput,
  type UpdateCapabilityMappingInput,
} from '@/api/chatops-admin';
import { colors, spacing, themeVars } from '@/tokens';
import dayjs from 'dayjs';
import { riskLevelConfig, environmentOptions } from './constants';
import { useQuery } from '@/providers/QueryProvider';

const { Text } = Typography;
const { Option } = Select;

export const CapabilityMappingTab: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [environment, setEnvironment] = useState<string>('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMapping, setEditingMapping] = useState<CapabilityMapping | null>(null);
  const [form] = Form.useForm();

  const {
    data: mappings = [],
    isLoading: loading,
    isError,
    error,
    refetch: loadData,
  } = useQuery<CapabilityMapping[]>({
    queryKey: ['chat-capability-mappings', environment],
    queryFn: async () => {
      const res = await chatopsAdminApi.getCapabilityMappings(environment || undefined);
      const data = res.data ?? [];
      return Array.isArray(data) ? data : [];
    },
    staleTime: 30_000,
  });

  // 加载失败反馈：本仓库锁定的 react-query 构建不触发 useQuery 的 onError 选项
  // （QueryObserver 未实现 observer 级回调），统一用 isError + useEffect 呈现。
  useEffect(() => {
    if (isError) message.error('获取映射列表失败');
  }, [isError, error]);

  const filteredMappings = mappings.filter((m) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return m.command_id.toLowerCase().includes(q) || m.capability_id.toLowerCase().includes(q);
  });

  const handleCreate = () => {
    setEditingMapping(null);
    form.resetFields();
    form.setFieldsValue({ risk_level: 1, requires_approval: false });
    setModalVisible(true);
  };

  const handleEdit = (record: CapabilityMapping) => {
    setEditingMapping(record);
    form.setFieldsValue({
      command_id: record.command_id,
      capability_id: record.capability_id,
      environment: record.environment,
      risk_level: record.risk_level,
      requires_approval: record.requires_approval,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await chatopsAdminApi.deleteCapabilityMapping(id);
      message.success('删除成功');
      loadData();
    } catch {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingMapping) {
        await chatopsAdminApi.updateCapabilityMapping(
          editingMapping.id,
          values as UpdateCapabilityMappingInput
        );
        message.success('更新成功');
      } else {
        await chatopsAdminApi.createCapabilityMapping(values as CreateCapabilityMappingInput);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadData();
    } catch {
      // 表单校验失败或 API 错误
    }
  };

  const columns = [
    {
      title: '命令',
      dataIndex: 'command_id',
      key: 'command_id',
      width: 180,
      render: (v: string) => <Text code>/{v}</Text>,
    },
    {
      title: 'Capability',
      dataIndex: 'capability_id',
      key: 'capability_id',
      width: 200,
      render: (v: string) => (
        <Text strong style={{ color: colors.purple[500] }}>
          {v}
        </Text>
      ),
    },
    {
      title: '环境',
      dataIndex: 'environment',
      key: 'environment',
      width: 120,
      render: (v: string) => (v ? <Tag color={colors.info[500]}>{v}</Tag> : <Tag>全部</Tag>),
    },
    {
      title: '风险等级',
      dataIndex: 'risk_level',
      key: 'risk_level',
      width: 100,
      render: (v: number) => {
        const cfg = riskLevelConfig[v] || { label: String(v), color: 'default' };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '需审批',
      dataIndex: 'requires_approval',
      key: 'requires_approval',
      width: 80,
      render: (v: boolean) => (
        <Tag color={v ? colors.warning[500] : colors.neutral[300]}>{v ? '是' : '否'}</Tag>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 160,
      render: (v: string) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {v ? dayjs(v).fromNow() : '-'}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: CapabilityMapping) => (
        <Space>
          <Tooltip title="编辑">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确认删除"
            description="删除后不可恢复"
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card bodyStyle={{ padding: '0 24px 24px' }}>
        <div
          style={{
            marginBottom: spacing.md,
            paddingBottom: 12,
            borderBottom: `1px solid ${themeVars.borderLight}`,
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
          }}
        >
          <Space>
            <Input
              prefix={<SearchOutlined />}
              placeholder="搜索命令或 Capability"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: 260 }}
              allowClear
            />
            <Select
              value={environment}
              onChange={setEnvironment}
              style={{ width: 160 }}
              options={environmentOptions}
            />
            <Button icon={<ReloadOutlined />} onClick={() => loadData()} loading={loading}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
              style={{
                background: colors.primary[500],
                borderColor: colors.primary[500],
              }}
            >
              新建映射
            </Button>
          </Space>
        </div>
        {filteredMappings.length === 0 && !loading ? (
          <Empty
            description={searchQuery ? '未找到匹配的映射' : '暂无映射配置'}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            {!searchQuery && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreate}
                style={{
                  background: colors.primary[500],
                  borderColor: colors.primary[500],
                }}
              >
                新建映射
              </Button>
            )}
          </Empty>
        ) : (
          <Table
            columns={columns}
            dataSource={filteredMappings}
            rowKey="id"
            loading={loading}
            size="middle"
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
            }}
          />
        )}
      </Card>

      <Modal
        title={editingMapping ? '编辑映射' : '新建映射'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={520}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ marginTop: spacing.md }}>
          <Form.Item
            name="command_id"
            label="命令名称"
            rules={[{ required: true, message: '请输入命令名称' }]}
          >
            <Input prefix="/" placeholder="例如: deploy, pipeline, restart" />
          </Form.Item>
          <Form.Item
            name="capability_id"
            label="Capability ID"
            rules={[{ required: true, message: '请输入 Capability ID' }]}
          >
            <Input placeholder="例如: deploy:production, pipeline:run" />
          </Form.Item>
          <Form.Item name="environment" label="环境">
            <Select
              placeholder="全部环境"
              allowClear
              options={environmentOptions}
            />
          </Form.Item>
          <Form.Item
            name="risk_level"
            label="风险等级"
            rules={[{ required: true, message: '请选择风险等级' }]}
          >
            <Select>
              <Option value={1}>
                <Tag color={colors.success[500]}>低</Tag> 安全操作，无需审批
              </Option>
              <Option value={2}>
                <Tag color={colors.warning[500]}>中</Tag> 需要关注
              </Option>
              <Option value={3}>
                <Tag color={colors.error[400]}>高</Tag> 高风险操作
              </Option>
              <Option value={4}>
                <Tag color={colors.purple[600]}>严重</Tag> 需要多级审批
              </Option>
            </Select>
          </Form.Item>
          <Form.Item name="requires_approval" label="需要审批" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
