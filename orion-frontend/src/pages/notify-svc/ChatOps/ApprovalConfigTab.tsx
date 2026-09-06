/**
 * ApprovalConfigTab - 审批配置 + 审批人列表 + 编辑弹窗
 * 抽取自 AdminSettings.tsx (P2-9 Phase 41)
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Select,
  Switch,
  InputNumber,
  Typography,
  message,
  Empty,
  Tooltip,
} from 'antd';
import { SafetyOutlined, TeamOutlined, EditOutlined } from '@ant-design/icons';
import {
  chatopsAdminApi,
  type ApprovalConfig,
  type Approver,
} from '@/api/chatops-admin';
import { colors, spacing, themeVars } from '@/tokens';

const { Text } = Typography;
const { Option } = Select;

export const ApprovalConfigTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [configs, setConfigs] = useState<ApprovalConfig[]>([]);
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [editingConfig, setEditingConfig] = useState<ApprovalConfig | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, approverRes] = await Promise.all([
        chatopsAdminApi.getApprovalConfigs(),
        chatopsAdminApi.getApprovers(),
      ]);
      setConfigs(configRes.data ?? []);
      setApprovers(approverRes.data ?? []);
    } catch {
      message.error('获取审批配置失败');
      setConfigs([]);
      setApprovers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleEdit = (record: ApprovalConfig) => {
    setEditingConfig(record);
    form.setFieldsValue({
      enabled: record.enabled,
      approvers: record.approvers,
      threshold: record.threshold,
    });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (!editingConfig) return;
      await chatopsAdminApi.updateApprovalConfig(editingConfig.capability, values);
      message.success('更新成功');
      setModalVisible(false);
      loadData();
    } catch {
      // 表单校验失败或 API 错误
    }
  };

  const columns = [
    {
      title: '能力域',
      dataIndex: 'capability',
      key: 'capability',
      width: 200,
      render: (v: string) => (
        <Text strong style={{ color: colors.purple[500] }}>
          {v}
        </Text>
      ),
    },
    {
      title: '启用状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 100,
      render: (v: boolean) => (
        <Tag color={v ? colors.success[500] : colors.neutral[300]}>{v ? '已启用' : '已禁用'}</Tag>
      ),
    },
    {
      title: '审批阈值',
      dataIndex: 'threshold',
      key: 'threshold',
      width: 100,
      render: (v: number) => <Text>{v} 人</Text>,
    },
    {
      title: '审批人',
      dataIndex: 'approvers',
      key: 'approvers',
      render: (v: string[]) => (
        <Space wrap>
          {v.map((a) => (
            <Tag key={a} icon={<TeamOutlined />}>
              {a}
            </Tag>
          ))}
          {v.length === 0 && <Text type="secondary">未配置</Text>}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: ApprovalConfig) => (
        <Tooltip title="编辑">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />} 
            onClick={() => handleEdit(record)}
          />
        </Tooltip>
      ),
    },
  ];

  const approverColumns = [
    {
      title: '用户 ID',
      dataIndex: 'user_id',
      key: 'user_id',
      width: 150,
      render: (v: string) => <Text code>{v}</Text>,
    },
    {
      title: '姓名',
      dataIndex: 'user_name',
      key: 'user_name',
      width: 120,
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 200,
      render: (v: string) => (v ? <Text type="secondary">{v}</Text> : '-'),
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (v: string) => (v ? <Tag>{v}</Tag> : '-'),
    },
    {
      title: '值班中',
      dataIndex: 'is_on_duty',
      key: 'is_on_duty',
      width: 80,
      render: (v: boolean) => (
        <Tag color={v ? colors.success[500] : colors.neutral[300]}>{v ? '是' : '否'}</Tag>
      ),
    },
  ];

  return (
    <div>
      <Card bodyStyle={{ padding: '0 24px 24px' }} style={{ marginBottom: spacing.md }}>
        <div
          style={{
            paddingTop: 20,
            marginBottom: spacing.md,
            paddingBottom: 12,
            borderBottom: `1px solid ${themeVars.borderLight}`,
          }}
        >
          <Space>
            <SafetyOutlined style={{ color: colors.purple[500], fontSize: 18 }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: themeVars.textPrimary }}>
              审批配置
            </span>
          </Space>
        </div>
        {configs.length === 0 && !loading ? (
          <Empty description="暂无审批配置" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Table
            columns={columns}
            dataSource={configs}
            rowKey="capability"
            loading={loading}
            size="middle"
            pagination={false}
          />
        )}
      </Card>

      <Card bodyStyle={{ padding: '0 24px 24px' }}>
        <div
          style={{
            paddingTop: 20,
            marginBottom: spacing.md,
            paddingBottom: 12,
            borderBottom: `1px solid ${themeVars.borderLight}`,
          }}
        >
          <Space>
            <TeamOutlined style={{ color: colors.primary[500], fontSize: 18 }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: themeVars.textPrimary }}>
              审批人列表
            </span>
          </Space>
        </div>
        {approvers.length === 0 && !loading ? (
          <Empty description="暂无审批人" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Table
            columns={approverColumns}
            dataSource={approvers}
            rowKey="user_id"
            loading={loading}
            size="middle"
            pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 人` }}
          />
        )}
      </Card>

      <Modal
        title="编辑审批配置"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={520}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ marginTop: spacing.md }}>
          <Form.Item name="enabled" label="启用审批" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="approvers" label="审批人">
            <Select mode="multiple" placeholder="选择审批人">
              {approvers.map((a) => (
                <Option key={a.user_id} value={a.user_id}>
                  {a.user_name} ({a.user_id})
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="threshold" label="审批阈值">
            <InputNumber min={1} max={10} style={{ width: '100%' }} addonAfter="人同意即可" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
