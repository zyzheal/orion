/**
 * ChatOps 审批配置后台
 * 全局审批开关、能力域审批规则、审批人配置
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Tabs,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Select,
  Switch,
  message,
  Badge,
  Typography,
  Alert,
  Divider,
  Radio,
  InputNumber,
  Row,
  Col,
  Descriptions,
} from 'antd';
import {
  EditOutlined,
  SaveOutlined,
  UserOutlined,
  SafetyOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { spacing } from '@/tokens';
import { chatopsAdminApi } from '@/api/chatops-admin';

const { Text } = Typography;

// ============== Types ==============
export interface ApprovalConfig {
  id: string;
  capabilityId: string;
  capabilityName: string;
  riskLevel: number;
  enabled: boolean;
  approvalMode: 'strict' | 'relaxed' | 'log_only';
  approvalLevel: number;
  approverRoles: string[];
  approverUsers: string[];
  proxyRoles: string[];
  proxyUsers: string[];
  timeoutMinutes: number;
  timeoutAction: 'remind' | 'auto_approve' | 'auto_reject' | 'escalate';
  secondTimeoutMinutes: number;
  secondTimeoutAction: 'escalate' | 'auto_approve' | 'auto_reject';
  environments: string[];
}

export interface ApproverInfo {
  id: string;
  role: string;
  userName: string;
  userId: string;
  status: 'online' | 'offline';
  isDefault: boolean;
}

export interface GlobalApprovalSettings {
  enabled: boolean;
  approvalMode: 'strict' | 'relaxed' | 'log_only';
}



// ============== Global Settings Tab ==============
export const GlobalSettingsTab: React.FC = () => {
  const [settings, setSettings] = useState<GlobalApprovalSettings>({
    enabled: true,
    approvalMode: 'strict',
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    chatopsAdminApi.getGlobalApprovalConfig()
      .then((res) => {
        const data = res.data as any;
        if (data) setSettings({ enabled: data.enabled ?? true, approvalMode: data.mode || 'strict' });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await chatopsAdminApi.updateGlobalApprovalConfig({ enabled: settings.enabled, mode: settings.approvalMode });
      message.success('全局审批设置已保存');
    } catch {
      message.error('保存失败');
    }
    setSaving(false);
  };

  const modeDescriptions: Record<string, string> = {
    strict: '所有风险等级 4 的操作必须审批后才能执行',
    relaxed: '风险等级 4 操作可直接执行，事后审计',
    log_only: '不拦截操作，仅记录审批日志',
  };

  return (
    <div>
      <Alert
        message="审批流程全局设置"
        description="配置 ChatOps 审批流程的全局开关和模式"
        type="info"
        showIcon
        style={{ marginBottom: spacing.lg }}
      />

      <Card style={{ maxWidth: 700 }} loading={loading}>
        <Form layout="vertical">
          <Form.Item label="启用审批流程">
            <Switch
              checked={settings.enabled}
              onChange={(checked) => setSettings({ ...settings, enabled: checked })}
              checkedChildren="已启用"
              unCheckedChildren="已禁用"
            />
          </Form.Item>

          <Divider />

          <Form.Item label="审批模式">
            <Radio.Group
              value={settings.approvalMode}
              onChange={(e) => setSettings({ ...settings, approvalMode: e.target.value })}
            >
              <Radio.Button value="strict">严格模式</Radio.Button>
              <Radio.Button value="relaxed">宽松模式</Radio.Button>
              <Radio.Button value="log_only">仅记录模式</Radio.Button>
            </Radio.Group>
            <div style={{ marginTop: spacing[3] }}>
              <Text type="secondary">{modeDescriptions[settings.approvalMode]}</Text>
            </div>
          </Form.Item>

          <Divider />

          <Form.Item>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={saving}
            >
              保存设置
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

// ============== Capability Approval Tab ==============
const CapabilityApprovalTab: React.FC = () => {
  const [configs, setConfigs] = useState<ApprovalConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ApprovalConfig | null>(null);
  const [form] = Form.useForm();

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await chatopsAdminApi.getApprovalConfigs();
      const data = (res.data as any) || [];
      setConfigs(Array.isArray(data) ? data.map((c: any) => ({
        id: c.id || c.capability,
        capabilityId: c.capability || c.capability_id || '',
        capabilityName: c.capability_name || c.capability || '',
        riskLevel: c.risk_level ?? 3,
        enabled: c.enabled ?? true,
        approvalMode: c.approval_mode || 'strict',
        approvalLevel: c.approval_level ?? 1,
        approverRoles: c.approvers || [],
        approverUsers: c.approver_users || [],
        proxyRoles: c.proxy_roles || [],
        proxyUsers: c.proxy_users || [],
        timeoutMinutes: c.timeout_minutes ?? 30,
        timeoutAction: c.timeout_action || 'remind',
        secondTimeoutMinutes: c.second_timeout_minutes ?? 0,
        secondTimeoutAction: c.second_timeout_action || 'escalate',
        environments: c.environments || [],
      })) : []);
    } catch {
      message.error('加载审批配置失败');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadConfigs(); }, [loadConfigs]);

  const riskLevelColors: Record<number, string> = {
    3: 'orange',
    4: 'red',
  };

  const handleEdit = (config: ApprovalConfig) => {
    setEditingConfig(config);
    form.setFieldsValue(config);
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingConfig) {
        await chatopsAdminApi.updateApprovalConfig(editingConfig.capabilityId, {
          enabled: values.enabled,
          approvers: values.approverRoles,
          threshold: values.approvalLevel,
        });
        message.success('审批规则已更新');
        loadConfigs();
      }
      setModalVisible(false);
    } catch {
      // validation error
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      const config = configs.find(c => c.id === id);
      if (config) {
        await chatopsAdminApi.updateApprovalConfig(config.capabilityId, { enabled });
        message.success(enabled ? '审批规则已启用' : '审批规则已禁用');
        loadConfigs();
      }
    } catch {
      message.error('操作失败');
    }
  };

  const handleBatchEnable = async () => {
    try {
      await chatopsAdminApi.batchUpdateApprovalConfigs(
        configs.map(c => ({ capability: c.capabilityId, enabled: true, approvers: c.approverRoles, threshold: c.approvalLevel }))
      );
      message.success('已批量启用');
      loadConfigs();
    } catch {
      message.error('批量操作失败');
    }
  };

  const handleBatchDisable = async () => {
    try {
      await chatopsAdminApi.batchUpdateApprovalConfigs(
        configs.map(c => ({ capability: c.capabilityId, enabled: false, approvers: c.approverRoles, threshold: c.approvalLevel }))
      );
      message.success('已批量禁用');
      loadConfigs();
    } catch {
      message.error('批量操作失败');
    }
  };

  const columns: ColumnsType<ApprovalConfig> = [
    {
      title: '能力域',
      dataIndex: 'capabilityName',
      key: 'capabilityName',
      render: (name: string, record: ApprovalConfig) => (
        <Space direction="vertical" size={0}>
          <Text strong>{name}</Text>
          <Text code style={{ fontSize: 11 }}>{record.capabilityId}</Text>
        </Space>
      ),
    },
    {
      title: '风险',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      width: 80,
      render: (level: number) => (
        <Badge color={riskLevelColors[level]} text={`Lv.${level}`} />
      ),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (enabled: boolean) => (
        enabled
          ? <Badge status="success" text="启用" />
          : <Badge status="default" text="禁用" />
      ),
    },
    {
      title: '模式',
      dataIndex: 'approvalMode',
      key: 'approvalMode',
      width: 100,
      render: (mode: string) => {
        const labels: Record<string, string> = {
          strict: '严格',
          relaxed: '宽松',
          log_only: '仅记录',
        };
        return <Tag>{labels[mode]}</Tag>;
      },
    },
    {
      title: '审批人',
      dataIndex: 'approverRoles',
      key: 'approverRoles',
      render: (roles: string[]) => (
        <Space wrap>
          {roles.map(r => <Tag key={r}>{r}</Tag>)}
        </Space>
      ),
    },
    {
      title: '超时',
      dataIndex: 'timeoutMinutes',
      key: 'timeoutMinutes',
      width: 100,
      render: (timeout: number) => `${timeout}min`,
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space>
          <Switch
            size="small"
            checked={record.enabled}
            onChange={(checked) => handleToggle(record.id, checked)}
          />
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <Text type="secondary">配置各能力域的审批规则</Text>
        <Space>
          <Button onClick={handleBatchEnable}>批量启用</Button>
          <Button onClick={handleBatchDisable}>批量禁用</Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={configs}
        rowKey="id"
        loading={loading}
        pagination={false}
      />

      <Modal
        title="编辑审批规则"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSave}
        width={700}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="enabled" label="审批开关" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="approvalMode" label="审批模式">
                <Select
                  options={[
                    { label: '严格模式', value: 'strict' },
                    { label: '宽松模式', value: 'relaxed' },
                    { label: '仅记录模式', value: 'log_only' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="approvalLevel" label="审批级别">
                <Select
                  options={[
                    { label: '单级审批', value: 1 },
                    { label: '多级审批', value: 2 },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="timeoutMinutes" label="超时时间(分钟)">
                <InputNumber style={{ width: '100%' }} min={1} max={1440} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="timeoutAction" label="超时动作">
                <Select
                  options={[
                    { label: '发送提醒', value: 'remind' },
                    { label: '自动批准', value: 'auto_approve' },
                    { label: '自动拒绝', value: 'auto_reject' },
                    { label: '转交代理', value: 'escalate' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="secondTimeoutMinutes" label="二次超时(分钟)">
                <InputNumber style={{ width: '100%' }} min={0} max={1440} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="approverRoles" label="审批人角色">
            <Select
              mode="multiple"
              placeholder="选择审批人角色"
              options={[
                { label: 'super_admin', value: 'super_admin' },
                { label: 'admin', value: 'admin' },
                { label: 'oncall', value: 'oncall' },
              ]}
            />
          </Form.Item>

          <Form.Item name="proxyRoles" label="代理审批人角色">
            <Select
              mode="multiple"
              placeholder="选择代理审批人角色"
              options={[
                { label: 'admin', value: 'admin' },
                { label: 'oncall', value: 'oncall' },
              ]}
            />
          </Form.Item>

          <Form.Item name="environments" label="生效环境">
            <Select
              mode="multiple"
              placeholder="选择生效环境"
              options={[
                { label: '生产环境', value: 'prod' },
                { label: '预发环境', value: 'staging' },
                { label: '开发环境', value: 'dev' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// ============== Approver Config Tab ==============
const ApproverConfigTab: React.FC = () => {
  const [approvers, setApprovers] = useState<ApproverInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    chatopsAdminApi.getApprovers()
      .then((res) => {
        const data = (res.data as any) || [];
        setApprovers(Array.isArray(data) ? data.map((a: any) => ({
          id: a.user_id || a.id,
          role: a.role || '',
          userName: a.user_name || '',
          userId: a.user_id || '',
          status: a.is_on_duty ? 'online' : 'offline',
          isDefault: true,
        })) : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const columns: ColumnsType<ApproverInfo> = [
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string, record: ApproverInfo) => (
        <Space>
          <Tag color={record.isDefault ? 'blue' : 'default'}>{role}</Tag>
          {record.isDefault && <Tag color="green">默认</Tag>}
        </Space>
      ),
    },
    {
      title: '审批人',
      dataIndex: 'userName',
      key: 'userName',
      render: (name: string, record: ApproverInfo) => (
        <Space>
          <UserOutlined />
          <Text strong>{name}</Text>
          <Text type="secondary">({record.userId})</Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        status === 'online'
          ? <Badge status="success" text="在线" />
          : <Badge status="default" text="离线" />
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: () => (
        <Space>
          <Button type="link" size="small">更换</Button>
          <Button type="link" size="small">设离线</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Alert
        message="默认审批人配置"
        description="配置各角色的默认审批人。首期只支持角色级审批人配置，排班功能后续实现。"
        type="info"
        showIcon
        style={{ marginBottom: spacing.lg }}
      />

      <Table
        columns={columns}
        dataSource={approvers}
        rowKey="id"
        loading={loading}
        pagination={false}
      />

      <Card style={{ marginTop: spacing.lg, maxWidth: 700 }} title="审批值班表">
        <Text type="secondary">排班功能开发中，敬请期待...</Text>
        <div style={{ marginTop: spacing.md }}>
          <Descriptions column={3} size="small">
            <Descriptions.Item label="时间段">09:00-18:00</Descriptions.Item>
            <Descriptions.Item label="周一">张三</Descriptions.Item>
            <Descriptions.Item label="周二">李四</Descriptions.Item>
            <Descriptions.Item label="周三">张三</Descriptions.Item>
            <Descriptions.Item label="周四">王五</Descriptions.Item>
            <Descriptions.Item label="周五">李四</Descriptions.Item>
            <Descriptions.Item label="夜间">oncall</Descriptions.Item>
          </Descriptions>
        </div>
      </Card>
    </div>
  );
};

// ============== Timeout Strategy Tab ==============
const TimeoutStrategyTab: React.FC = () => {
  return (
    <div>
      <Alert
        message="超时策略配置"
        description="配置审批超时后的自动处理策略"
        type="info"
        showIcon
        style={{ marginBottom: spacing.lg }}
      />

      <Card style={{ maxWidth: 700 }} title="超时策略">
        <Descriptions column={1} bordered>
          <Descriptions.Item label="一级超时时间">
            <Space>
              <InputNumber min={1} max={1440} defaultValue={30} style={{ width: 100 }} />
              <Text>分钟</Text>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="一级超时动作">
            <Select
              defaultValue="remind"
              style={{ width: 200 }}
              options={[
                { label: '发送提醒', value: 'remind' },
                { label: '自动批准', value: 'auto_approve' },
                { label: '自动拒绝', value: 'auto_reject' },
                { label: '转交代理', value: 'escalate' },
              ]}
            />
          </Descriptions.Item>
          <Descriptions.Item label="二级超时时间">
            <Space>
              <InputNumber min={0} max={1440} defaultValue={120} style={{ width: 100 }} />
              <Text>分钟 (0 表示不启用)</Text>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="二级超时动作">
            <Select
              defaultValue="escalate"
              style={{ width: 200 }}
              options={[
                { label: '转交代理', value: 'escalate' },
                { label: '自动批准', value: 'auto_approve' },
                { label: '自动拒绝', value: 'auto_reject' },
              ]}
            />
          </Descriptions.Item>
        </Descriptions>

        <div style={{ marginTop: spacing.lg }}>
          <Button type="primary" icon={<SaveOutlined />}>
            保存超时策略
          </Button>
        </div>
      </Card>
    </div>
  );
};

// ============== Emergency Flow Tab ==============
const EmergencyFlowTab: React.FC = () => {
  const [enabled, setEnabled] = useState(true);

  return (
    <div>
      <Alert
        message="紧急流程配置"
        description="配置紧急情况下的跳过审批流程"
        type="warning"
        showIcon
        style={{ marginBottom: spacing.lg }}
      />

      <Card style={{ maxWidth: 700 }} title="紧急流程设置">
        <Form layout="vertical">
          <Form.Item label="启用紧急流程">
            <Switch
              checked={enabled}
              onChange={setEnabled}
              checkedChildren="已启用"
              unCheckedChildren="已禁用"
            />
          </Form.Item>

          {enabled && (
            <>
              <Alert
                message="紧急流程说明"
                description="启用后，具有紧急权限的用户可以通过特殊标记跳过审批流程。紧急操作会被记录并发送通知给管理员。"
                type="info"
                style={{ marginBottom: spacing.md }}
              />

              <Form.Item label="紧急权限角色">
                <Select
                  mode="multiple"
                  defaultValue={['super_admin', 'oncall']}
                  options={[
                    { label: 'super_admin', value: 'super_admin' },
                    { label: 'admin', value: 'admin' },
                    { label: 'oncall', value: 'oncall' },
                  ]}
                />
              </Form.Item>

              <Form.Item label="紧急通知人员">
                <Select
                  mode="multiple"
                  placeholder="选择通知人员"
                  options={[
                    { label: '张三 (admin1)', value: 'admin1' },
                    { label: '李四 (admin2)', value: 'admin2' },
                  ]}
                />
              </Form.Item>
            </>
          )}

          <Form.Item>
            <Button type="primary" icon={<SaveOutlined />}>
              保存设置
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

// ============== Main Component ==============
const ApprovalConfig: React.FC = () => {
  const [activeTab, setActiveTab] = useState('capability');

  const tabItems = [
    {
      key: 'capability',
      label: (
        <span>
          <SafetyOutlined /> 能力域配置
        </span>
      ),
      children: <CapabilityApprovalTab />,
    },
    {
      key: 'approver',
      label: (
        <span>
          <UserOutlined /> 审批人配置
        </span>
      ),
      children: <ApproverConfigTab />,
    },
    {
      key: 'timeout',
      label: (
        <span>
          <ClockCircleOutlined /> 超时策略
        </span>
      ),
      children: <TimeoutStrategyTab />,
    },
    {
      key: 'emergency',
      label: (
        <span>
          <ThunderboltOutlined /> 紧急流程
        </span>
      ),
      children: <EmergencyFlowTab />,
    },
  ];

  return (
    <div style={{ padding: '0 0 16px' }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
      />
    </div>
  );
};

export default ApprovalConfig;