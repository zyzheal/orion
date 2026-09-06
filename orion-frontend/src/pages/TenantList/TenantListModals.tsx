/**
 * TenantList Modals
 */
import React from 'react';
import {Modal,
  Form,
  Input,
  InputNumber,
  Switch,
  Button,
  Space,
  Tag,
  Divider,
  Empty,
  Row,
  Col,
  Table,
  Typography,
  message, Tabs, Tooltip
} from 'antd';
import { PlusOutlined,
  EditOutlined,
  SettingOutlined, DatabaseOutlined, InfoCircleOutlined, TeamOutlined
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { TenantEntity } from '@/api/tenant';
import type { TenantUser } from '@/api/tenant';

type FormInstance = ReturnType<typeof Form.useForm>[0];
const { Text } = Typography;


interface QuotaTemplate {
  name: string;
  label: string;
  quota: {
    maxPipelines: number;
    maxPipelineRunsPerDay: number;
    maxConcurrentRuns: number;
    maxRunners: number;
    maxCpuCores: number;
    maxMemoryGb: number;
    maxStorageGb: number;
    maxNamespaces: number;
  };
}

interface TenantListModalsProps {
  createModalOpen: boolean;
  setCreateModalOpen: (v: boolean) => void;
  editModalOpen: boolean;
  setEditModalOpen: (v: boolean) => void;
  editingTenant: TenantEntity | null;
  setEditingTenant: (v: TenantEntity | null) => void;
  submitting: boolean;
  createForm: FormInstance;
  editForm: FormInstance;
  handleCreate: (values: any) => void;
  handleEdit: (values: any) => void;
  selectedTemplate: string;
  setSelectedTemplate: (v: string) => void;
  userModalOpen: boolean;
  setUserModalOpen: (v: boolean) => void;
  userModalTenant: TenantEntity | null;
  users: TenantUser[];
  usersLoading: boolean;
  QUOTA_TEMPLATES: QuotaTemplate[];
  setUserModalTenant: (v: TenantEntity | null) => void;
  setUsers: (v: TenantUser[]) => void;
}

export const TenantListModals: React.FC<TenantListModalsProps> = (props) => (
  <>
      {/* Create Tenant Modal */}
      <Modal
        title={
          <Space>
            <PlusOutlined />
            创建租户
          </Space>
        }
        open={props.createModalOpen}
        onCancel={() => {
          props.setCreateModalOpen(false);
          props.createForm.resetFields();
          // P2-5 修复: 重置模板选择
          props.setSelectedTemplate('enterprise');
        }}
        onOk={() => props.createForm.submit()}
        confirmLoading={props.submitting}
        width={700}
        okText="创建"
        cancelText="取消"
      >
        <Form
          form={props.createForm}
          layout="vertical"
          onFinish={props.handleCreate}
          initialValues={{
            autoAllocateNamespace: true,
            initialNamespaceCount: 1,
            maxPipelines: 100,
            maxPipelineRunsPerDay: 1000,
            maxConcurrentRuns: 10,
            maxRunners: 5,
            maxCpuCores: 16,
            maxMemoryGb: 32,
            maxStorageGb: 100,
            maxNamespaces: 10,
          }}
        >
          <Divider orientation="left">基本信息</Divider>
          <Form.Item
            label="租户标识"
            name="name"
            rules={[
              { required: true, message: '请输入租户标识' },
              { pattern: /^[a-zA-Z0-9_-]+$/, message: '只能包含字母、数字、下划线和连字符' },
            ]}
            tooltip="租户的唯一标识，创建后不可修改"
          >
            <Input placeholder="例如：acme-corp" />
          </Form.Item>
          <Form.Item label="显示名称" name="display_name">
            <Input placeholder="例如：ACME 公司" />
          </Form.Item>

          <Divider orientation="left">Namespace 分配</Divider>
          <Form.Item
            label="自动分配 Namespace"
            name="autoAllocateNamespace"
            valuePropName="checked"
            tooltip="创建租户时自动从池中分配 Namespace"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.autoAllocateNamespace !== curr.autoAllocateNamespace}
          >
            {({ getFieldValue }) =>
              getFieldValue('autoAllocateNamespace') && (
                <Form.Item label="初始 Namespace 数量" name="initialNamespaceCount">
                  <InputNumber min={1} max={10} style={{ width: '100%' }} />
                </Form.Item>
              )
            }
          </Form.Item>

          <Divider orientation="left">
            <Space>
              资源配额
              <Tooltip title="租户可使用的资源上限，可随时修改">
                <InfoCircleOutlined style={{ color: colors.neutral[500] }} />
              </Tooltip>
            </Space>
          </Divider>
          {/* P2-5 修复: 模板选择 */}
          <Form.Item label="选择模板" style={{ marginBottom: spacing.md }}>
            <Space>
              {props.QUOTA_TEMPLATES.map((template) => (
                <Button
                  key={template.name}
                  type={props.selectedTemplate === template.name ? 'primary' : 'default'}
                  onClick={() => {
                    props.setSelectedTemplate(template.name);
                    props.createForm.setFieldsValue({
                      customQuota: true,
                      ...template.quota,
                    });
                    message.success(`已应用 "${template.label}" 模板`);
                  }}
                >
                  {template.label}
                </Button>
              ))}
            </Space>
          </Form.Item>
          <Form.Item name="customQuota" valuePropName="checked" initialValue={false}>
            <Switch checkedChildren="自定义配额" unCheckedChildren="使用默认配额" />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.customQuota !== curr.customQuota}>
            {({ getFieldValue }) =>
              getFieldValue('customQuota') && (
                <>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item label="最大 Pipeline 数" name="maxPipelines">
                        <InputNumber min={1} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="每日最大运行次数" name="maxPipelineRunsPerDay">
                        <InputNumber min={1} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item label="最大并发运行数" name="maxConcurrentRuns">
                        <InputNumber min={1} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="最大 Runner 数" name="maxRunners">
                        <InputNumber min={1} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item label="最大 CPU 核心数" name="maxCpuCores">
                        <InputNumber min={1} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="最大内存 (GB)" name="maxMemoryGb">
                        <InputNumber min={1} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item label="最大存储 (GB)" name="maxStorageGb">
                        <InputNumber min={1} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="最大 Namespace 数" name="maxNamespaces">
                        <InputNumber min={1} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              )
            }
          </Form.Item>
        </Form>
      </Modal>

      {/* P1-1 修复：编辑 Modal 增加配额设置 Tab */}
      <Modal
        title={
          <Space>
            <EditOutlined />
            编辑租户
          </Space>
        }
        open={props.editModalOpen}
        onCancel={() => {
          props.setEditModalOpen(false);
          props.setEditingTenant(null);
        }}
        onOk={() => props.editForm.submit()}
        okText="保存"
        cancelText="取消"
        width={700}
      >
        <Form
          form={props.editForm}
          layout="vertical"
          onFinish={props.handleEdit}
          initialValues={{
            maxPipelines: 100,
            maxPipelineRunsPerDay: 1000,
            maxConcurrentRuns: 10,
            maxRunners: 5,
            maxCpuCores: 16,
            maxMemoryGb: 32,
            maxStorageGb: 100,
            maxNamespaces: 10,
          }}
        >
          <Tabs
            defaultActiveKey="basic"
            items={[
              {
                key: 'basic',
                label: (
                  <span>
                    <SettingOutlined />
                    基本信息
                  </span>
                ),
                children: (
                  <>
                    <Form.Item label="租户标识" name="name">
                      <Input disabled />
                    </Form.Item>
                    <Form.Item label="显示名称" name="display_name">
                      <Input placeholder="例如：ACME 公司" />
                    </Form.Item>
                  </>
                ),
              },
              {
                key: 'quota',
                label: (
                  <span>
                    <DatabaseOutlined />
                    资源配额
                  </span>
                ),
                children: (
                  <>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item label="最大 Pipeline 数" name="maxPipelines">
                          <InputNumber min={1} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item label="每日最大运行次数" name="maxPipelineRunsPerDay">
                          <InputNumber min={1} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item label="最大并发运行数" name="maxConcurrentRuns">
                          <InputNumber min={1} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item label="最大 Runner 数" name="maxRunners">
                          <InputNumber min={1} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item label="最大 CPU 核心数" name="maxCpuCores">
                          <InputNumber min={1} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item label="最大内存 (GB)" name="maxMemoryGb">
                          <InputNumber min={1} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item label="最大存储 (GB)" name="maxStorageGb">
                          <InputNumber min={1} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item label="最大 Namespace 数" name="maxNamespaces">
                          <InputNumber min={1} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    </Row>
                  </>
                ),
              },
            ]}
          />
        </Form>
      </Modal>

      {/* P1-3 修复：用户管理 Modal */}
      <Modal
        title={
          <Space>
            <TeamOutlined />
            用户管理 - {props.userModalTenant?.display_name || props.userModalTenant?.name}
          </Space>
        }
        open={props.userModalOpen}
        onCancel={() => {
          props.setUserModalOpen(false);
          props.setUserModalTenant(null);
          props.setUsers([]);
        }}
        footer={[
          <Button key="close" onClick={() => props.setUserModalOpen(false)}>
            关闭
          </Button>,
        ]}
        width={700}
      >
        {props.usersLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>
        ) : props.users.length === 0 ? (
          <Empty description="该租户暂无用户" />
        ) : (
          <Table
            dataSource={props.users}
            rowKey="id"
            size="small"
            pagination={false}
            columns={[
              {
                title: '用户名',
                dataIndex: 'username',
                key: 'username',
                render: (val: string, record: TenantUser) => (
                  <Space>
                    <Text strong>{record.name || val}</Text>
                    {record.name && (
                      <Text type="secondary" code>
                        {val}
                      </Text>
                    )}
                  </Space>
                ),
              },
              {
                title: '邮箱',
                dataIndex: 'email',
                key: 'email',
                render: (val: string | null) => val || '-',
              },
              {
                title: '角色',
                dataIndex: 'role',
                key: 'role',
                render: (val: string) => {
                  const roleMap: Record<string, string> = {
                    admin: '管理员',
                    member: '成员',
                    viewer: '查看者',
                  };
                  return <Tag>{roleMap[val] || val}</Tag>;
                },
              },
              {
                title: '状态',
                dataIndex: 'status',
                key: 'status',
                render: (val: string) => {
                  const colorMap: Record<string, string> = {
                    active: 'green',
                    inactive: 'default',
                    locked: 'red',
                  };
                  return <Tag color={colorMap[val] || 'default'}>{val}</Tag>;
                },
              },
              {
                title: '最后登录',
                dataIndex: 'last_login_at',
                key: 'last_login_at',
                render: (val: string | null) => (val ? new Date(val).toLocaleString() : '未登录'),
              },
            ]}
          />
        )}
      </Modal>
  </>
);
