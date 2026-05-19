/**
 * ChatOps 审批配置后台
 * 全局审批开关、能力域审批规则、审批人配置
 */
import React, { useState } from 'react';
import {
  Card,
  Tabs,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  message,
  Badge,
  Typography,
  Alert,
  Divider,
  Radio,
  InputNumber,
  Popconfirm,
  Row,
  Col,
  Descriptions,
} from 'antd';
import {
  SettingOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SaveOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  UserOutlined,
  SafetyOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Text, Title } = Typography;

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

// ============== Mock Data ==============
const MOCK_APPROVAL_CONFIGS: ApprovalConfig[] = [
  {
    id: 'ap-1',
    capabilityId: 'deployment_operations.deploy_prod',
    capabilityName: '生产环境部署',
    riskLevel: 4,
    enabled: true,
    approvalMode: 'strict',
    approvalLevel: 1,
    approverRoles: ['super_admin'],
    approverUsers: ['admin1'],
    proxyRoles: ['admin'],
    proxyUsers: [],
    timeoutMinutes: 30,
    timeoutAction: 'remind',
    secondTimeoutMinutes: 120,
    secondTimeoutAction: 'escalate',
    environments: ['prod'],
  },
  {
    id: 'ap-2',
    capabilityId: 'deployment_operations.rollback',
    capabilityName: '回滚操作',
    riskLevel: 4,
    enabled: true,
    approvalMode: 'strict',
    approvalLevel: 1,
    approverRoles: ['super_admin'],
    approverUsers: [],
    proxyRoles: ['admin'],
    proxyUsers: [],
    timeoutMinutes: 30,
    timeoutAction: 'auto_approve',
    secondTimeoutMinutes: 60,
    secondTimeoutAction: 'escalate',
    environments: ['prod'],
  },
  {
    id: 'ap-3',
    capabilityId: 'infrastructure_operations.env_restart',
    capabilityName: '环境重启',
    riskLevel: 3,
    enabled: true,
    approvalMode: 'relaxed',
    approvalLevel: 1,
    approverRoles: ['admin'],
    approverUsers: [],
    proxyRoles: [],
    proxyUsers: [],
    timeoutMinutes: 60,
    timeoutAction: 'remind',
    secondTimeoutMinutes: 120,
    secondTimeoutAction: 'escalate',
    environments: ['prod', 'staging'],
  },
  {
    id: 'ap-4',
    capabilityId: 'chatops_config.webhook',
    capabilityName: 'Webhook 配置',
    riskLevel: 3,
    enabled: true,
    approvalMode: 'strict',
    approvalLevel: 1,
    approverRoles: ['admin'],
    approverUsers: [],
    proxyRoles: [],
    proxyUsers: [],
    timeoutMinutes: 60,
    timeoutAction: 'remind',
    secondTimeoutMinutes: 0,
    secondTimeoutAction: 'escalate',
    environments: ['prod'],
  },
  {
    id: 'ap-5',
    capabilityId: 'bulk_operations.delete',
    capabilityName: '批量删除',
    riskLevel: 4,
    enabled: false,
    approvalMode: 'strict',
    approvalLevel: 2,
    approverRoles: ['super_admin'],
    approverUsers: [],
    proxyRoles: ['admin'],
    proxyUsers: [],
    timeoutMinutes: 60,
    timeoutAction: 'auto_reject',
    secondTimeoutMinutes: 240,
    secondTimeoutAction: 'auto_reject',
    environments: ['prod', 'staging', 'dev'],
  },
];

const MOCK_APPROVERS: ApproverInfo[] = [
  {
    id: 'approver-1',
    role: 'super_admin',
    userName: '张三',
    userId: 'admin1',
    status: 'online',
    isDefault: true,
  },
  {
    id: 'approver-2',
    role: 'admin',
    userName: '李四',
    userId: 'admin2',
    status: 'online',
    isDefault: true,
  },
  {
    id: 'approver-3',
    role: 'oncall',
    userName: '王五',
    userId: 'ops1',
    status: 'offline',
    isDefault: false,
  },
];

// ============== Global Settings Tab ==============
const GlobalSettingsTab: React.FC = () => {
  const [settings, setSettings] = useState<GlobalApprovalSettings>({
    enabled: true,
    approvalMode: 'strict',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      message.success('全局审批设置已保存');
    }, 500);
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
        style={{ marginBottom: 24 }}
      />

      <Card style={{ maxWidth: 700 }}>
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
            <div style={{ marginTop: 12 }}>
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
  const [configs, setConfigs] = useState<ApprovalConfig[]>(MOCK_APPROVAL_CONFIGS);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ApprovalConfig | null>(null);
  const [form] = Form.useForm();

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
        setConfigs(configs.map(c =>
          c.id === editingConfig.id ? { ...c, ...values } : c
        ));
        message.success('审批规则已更新');
      }
      setModalVisible(false);
    } catch {
      // validation error
    }
  };

  const handleToggle = (id: string, enabled: boolean) => {
    setConfigs(configs.map(c =>
      c.id === id ? { ...c, enabled } : c
    ));
    message.success(enabled ? '审批规则已启用' : '审批规则已禁用');
  };

  const handleBatchEnable = () => {
    setConfigs(configs.map(c => ({ ...c, enabled: true })));
    message.success('已批量启用');
  };

  const handleBatchDisable = () => {
    setConfigs(configs.map(c => ({ ...c, enabled: false })));
    message.success('已批量禁用');
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
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
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
  const [approvers] = useState<ApproverInfo[]>(MOCK_APPROVERS);

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
        style={{ marginBottom: 24 }}
      />

      <Table
        columns={columns}
        dataSource={approvers}
        rowKey="id"
        pagination={false}
      />

      <Card style={{ marginTop: 24, maxWidth: 700 }} title="审批值班表">
        <Text type="secondary">排班功能开发中，敬请期待...</Text>
        <div style={{ marginTop: 16 }}>
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
        style={{ marginBottom: 24 }}
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

        <div style={{ marginTop: 24 }}>
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
        style={{ marginBottom: 24 }}
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
                style={{ marginBottom: 16 }}
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
      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 16, fontWeight: 600, lineHeight: '24px' }}>审批流程配置</span>
        <br />
        <Text type="secondary" style={{ fontSize: 12 }}>
          ChatOps 审批规则配置 - 能力域审批、审批人管理、超时策略
        </Text>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
      />
    </div>
  );
};

export default ApprovalConfig;