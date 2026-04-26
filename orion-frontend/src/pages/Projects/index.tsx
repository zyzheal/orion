/**
 * Project Management Page (M7)
 * List, create, edit, view details, delete projects
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography, Button, Space, Tag, Card, Modal, Form, Input, message, Alert,
  Popconfirm, Drawer, Tooltip, Descriptions, Table as AntTable, Avatar,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined,
  EyeOutlined, FolderOutlined, TeamOutlined, EnvironmentOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import {
  getProjects, createProject, updateProject, deleteProject, getProjectResources,
  type Project, type CreateProjectInput, type UpdateProjectInput,
  type ProjectResource,
} from '@/api/projects';
import { colors } from '@/tokens/colors';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

// ---- Color maps ----

const statusColorMap: Record<string, string> = {
  active: 'green',
  archived: 'default',
  suspended: 'red',
};

const statusLabelMap: Record<string, string> = {
  active: '运行中',
  archived: '已归档',
  suspended: '已暂停',
};

const resourceTypeLabelMap: Record<string, string> = {
  repository: '代码仓库',
  pipeline: '流水线',
  deployment: '部署',
  monitoring: '监控',
  alert_rule: '告警规则',
  database: '数据库',
  secret: '密钥',
};

// ---- Mock data ----

const MOCK_PROJECTS: Project[] = [
  {
    id: 'proj-1', tenantId: 'tenant-1', name: 'orion-platform', slug: 'orion-platform',
    description: 'Orion 核心平台项目，包含所有微服务组件', status: 'active',
    teamLead: '张伟', teamMembers: ['张伟', '李娜', '王磊', '赵敏'],
    productLineId: 'pl-1', environments: ['dev', 'staging', 'production'],
    createdAt: '2024-01-15T08:00:00Z', updatedAt: '2024-04-20T10:00:00Z',
  },
  {
    id: 'proj-2', tenantId: 'tenant-1', name: 'orion-ai-service', slug: 'orion-ai-service',
    description: 'AI 算法引擎与智能分析服务', status: 'active',
    teamLead: '陈思', teamMembers: ['陈思', '刘洋'],
    productLineId: 'pl-1', environments: ['dev', 'staging'],
    createdAt: '2024-02-01T08:00:00Z', updatedAt: '2024-04-18T14:00:00Z',
  },
  {
    id: 'proj-3', tenantId: 'tenant-1', name: 'frontend-app', slug: 'frontend-app',
    description: '前端微应用与组件库', status: 'active',
    teamLead: '孙艺', teamMembers: ['孙艺', '周涛', '吴欣'],
    productLineId: 'pl-2', environments: ['dev', 'staging', 'production'],
    createdAt: '2024-03-01T08:00:00Z', updatedAt: '2024-04-15T09:00:00Z',
  },
  {
    id: 'proj-4', tenantId: 'tenant-1', name: 'data-pipeline', slug: 'data-pipeline',
    description: '数据处理管道与 ETL 服务', status: 'suspended',
    teamLead: '马超', teamMembers: ['马超', '郑丽'],
    productLineId: 'pl-2', environments: ['dev'],
    createdAt: '2024-03-15T08:00:00Z', updatedAt: '2024-04-10T11:00:00Z',
  },
  {
    id: 'proj-5', tenantId: 'tenant-1', name: 'legacy-migration', slug: 'legacy-migration',
    description: '旧系统迁移项目（已归档）', status: 'archived',
    teamLead: '黄强', teamMembers: ['黄强'],
    productLineId: 'pl-3', environments: ['production'],
    createdAt: '2023-06-01T08:00:00Z', updatedAt: '2024-01-10T08:00:00Z',
  },
];

const MOCK_RESOURCES: ProjectResource[] = [
  { id: 'r1', projectId: 'proj-1', type: 'repository', name: 'orion-platform-service', externalId: 'repo-101', status: 'active', createdAt: '2024-01-15T08:00:00Z' },
  { id: 'r2', projectId: 'proj-1', type: 'pipeline', name: 'platform-ci', externalId: 'pipe-201', status: 'active', createdAt: '2024-01-16T08:00:00Z' },
  { id: 'r3', projectId: 'proj-1', type: 'deployment', name: 'platform-deploy-prod', externalId: 'dep-301', status: 'active', createdAt: '2024-01-17T08:00:00Z' },
  { id: 'r4', projectId: 'proj-1', type: 'monitoring', name: 'platform-prometheus', externalId: 'mon-401', status: 'active', createdAt: '2024-01-18T08:00:00Z' },
  { id: 'r5', projectId: 'proj-2', type: 'repository', name: 'orion-ai-service', externalId: 'repo-102', status: 'active', createdAt: '2024-02-01T08:00:00Z' },
  { id: 'r6', projectId: 'proj-2', type: 'pipeline', name: 'ai-ci', externalId: 'pipe-202', status: 'active', createdAt: '2024-02-02T08:00:00Z' },
];

// ---- Main Component ----

const ProjectManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectResources, setProjectResources] = useState<ProjectResource[]>([]);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [usingMockData, setUsingMockData] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getProjects({ tenantId: 'tenant-1' });
      const data = res.data?.data;
      if (Array.isArray(data)) {
        setProjects(data);
      } else if (Array.isArray(data?.data)) {
        setProjects(data.data);
      } else {
        setUsingMockData(true);
        setProjects(MOCK_PROJECTS);
      }
    } catch {
      setUsingMockData(true);
      setProjects(MOCK_PROJECTS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filteredData = useMemo(() => {
    return projects.filter((p) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !p.name.toLowerCase().includes(q) &&
          !(p.description && p.description.toLowerCase().includes(q)) &&
          !(p.slug && p.slug.toLowerCase().includes(q))
        ) return false;
      }
      if (filters.status && filters.status !== 'all' && p.status !== filters.status) return false;
      return true;
    });
  }, [searchQuery, filters, projects]);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      const payload: CreateProjectInput = {
        name: values.name,
        tenantId: values.tenantId || 'tenant-1',
        description: values.description,
        teamLead: values.teamLead,
        teamMembers: values.teamMembers
          ? values.teamMembers.split(',').map((s: string) => s.trim()).filter(Boolean)
          : undefined,
        environments: values.environments
          ? values.environments.split(',').map((s: string) => s.trim()).filter(Boolean)
          : undefined,
      };
      await createProject(payload);
      message.success('项目创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      loadData();
    } catch {
      message.error('创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editingProject) return;
    try {
      const values = await editForm.validateFields();
      setSubmitting(true);
      const payload: UpdateProjectInput = {
        name: values.name,
        description: values.description,
        teamLead: values.teamLead,
        teamMembers: values.teamMembers
          ? values.teamMembers.split(',').map((s: string) => s.trim()).filter(Boolean)
          : undefined,
        environments: values.environments
          ? values.environments.split(',').map((s: string) => s.trim()).filter(Boolean)
          : undefined,
      };
      await updateProject(editingProject.id, payload);
      message.success('项目更新成功');
      setEditModalVisible(false);
      loadData();
    } catch {
      message.error('更新失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProject(id);
      message.success('项目已删除');
      loadData();
    } catch {
      message.error('删除失败');
    }
  };

  const openEdit = (p: Project) => {
    setEditingProject(p);
    editForm.setFieldsValue({
      name: p.name,
      description: p.description,
      teamLead: p.teamLead,
      teamMembers: p.teamMembers?.join(', '),
      environments: p.environments?.join(', '),
    });
    setEditModalVisible(true);
  };

  const openDetail = async (p: Project) => {
    setSelectedProject(p);
    setDetailDrawerVisible(true);
    loadResources(p.id);
  };

  const loadResources = async (projectId: string) => {
    try {
      const res = await getProjectResources(projectId);
      setProjectResources(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      setUsingMockData(true);
      setProjectResources(MOCK_RESOURCES.filter((r) => r.projectId === projectId));
    }
  };

  // ---- Table columns ----

  const columns: TableColumn<any>[] = [
    {
      key: 'name', title: '项目名称', dataIndex: 'name', width: 200, sortable: true,
      render: (v: unknown, record: any) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ cursor: 'pointer' }} onClick={() => openDetail(record)}>
            <FolderOutlined style={{ marginRight: 6, color: colors.primary[500] }} />
            {String(v)}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>/ {record.slug}</Text>
        </Space>
      ),
    },
    {
      key: 'description', title: '描述', dataIndex: 'description', width: 250,
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: 12 }}>{v ? String(v).slice(0, 50) + (String(v).length > 50 ? '...' : '') : '-'}</Text>
      ),
    },
    {
      key: 'status', title: '状态', width: 100,
      render: (_: unknown, record: any) => (
        <Tag color={statusColorMap[record.status] || 'default'}>
          {statusLabelMap[record.status] || record.status}
        </Tag>
      ),
    },
    {
      key: 'team', title: '负责人', width: 120,
      render: (_: unknown, record: any) => (
        <Space>
          <Avatar size="small" style={{ backgroundColor: colors.primary[500] }}>
            {record.teamLead ? record.teamLead.charAt(0) : '?'}
          </Avatar>
          <Text>{record.teamLead || '-'}</Text>
        </Space>
      ),
    },
    {
      key: 'members', title: '团队成员', width: 120,
      render: (_: unknown, record: any) => (
        <Tooltip title={record.teamMembers?.join(', ')}>
          <Space>
            <TeamOutlined />
            <Text>{record.teamMembers?.length || 0} 人</Text>
          </Space>
        </Tooltip>
      ),
    },
    {
      key: 'environments', title: '环境', width: 150,
      render: (_: unknown, record: any) => (
        <Space wrap>
          {record.environments?.map((env: string) => (
            <Tag key={env} color="blue" style={{ fontSize: 11 }}>{env}</Tag>
          )) || <Text type="secondary">-</Text>}
        </Space>
      ),
    },
    {
      key: 'updatedAt', title: '更新时间', dataIndex: 'updatedAt', width: 140, sortable: true,
      render: (v: unknown) => <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(String(v)).fromNow()}</Text>,
    },
    {
      key: 'actions', title: '操作', width: 160,
      render: (_: unknown, record: any) => (
        <Space size="small" wrap>
          <Tooltip title="详情">
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>详情</Button>
          </Tooltip>
          <Tooltip title="编辑">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
          <Tooltip title="删除">
            <Popconfirm title="确认删除该项目?" onConfirm={() => handleDelete(record.id)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  const filterDefs: FilterDefinition[] = [
    {
      key: 'status', label: '状态', options: [
        { label: '全部', value: 'all' },
        { label: '运行中', value: 'active' },
        { label: '已暂停', value: 'suspended' },
        { label: '已归档', value: 'archived' },
      ],
    },
  ];

  // Resource columns in detail drawer
  const resourceColumns: TableColumn<ProjectResource>[] = [
    {
      title: '资源名称', dataIndex: 'name', key: 'name',
      render: (v: unknown) => <Text strong>{String(v)}</Text>,
    },
    {
      title: '类型', dataIndex: 'type', key: 'type',
      render: (v: unknown) => <Tag>{resourceTypeLabelMap[String(v)] || String(v)}</Tag>,
    },
    {
      title: '外部ID', dataIndex: 'externalId', key: 'externalId',
      render: (v: unknown) => <Text type="secondary" style={{ fontSize: 12 }}>{String(v)}</Text>,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (v: unknown) => <Tag color={String(v) === 'active' ? 'green' : 'default'}>{String(v)}</Tag>,
    },
    {
      title: '创建时间', dataIndex: 'createdAt', key: 'createdAt',
      render: (v: unknown) => <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(String(v)).format('YYYY-MM-DD')}</Text>,
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>项目管理</Title>
          <Text type="secondary">管理项目、团队关联和资源分配</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>创建项目</Button>
        </Space>
      </div>

      {/* Mock data warning banner */}
      {usingMockData && (
        <Alert
          message="使用模拟数据"
          description="后端服务暂时不可用，当前显示的是模拟数据，可能不是最新状态。"
          type="warning"
          showIcon
          closable
          style={{ marginBottom: 16 }}
          onClose={() => setUsingMockData(false)}
        />
      )}

      {/* Project List */}
      <Card>
        <div style={{ marginBottom: 16 }}>
          <SearchFilterBar onSearch={setSearchQuery} onFilter={setFilters} filters={filterDefs} searchPlaceholder="搜索项目..." />
        </div>
        <Table
          columns={columns}
          dataSource={filteredData as unknown as Record<string, unknown>[]}
          loading={loading}
          rowKey="id"
          size="middle"
          striped
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title="创建项目" open={createModalVisible} onCancel={() => setCreateModalVisible(false)}
        onOk={handleCreate} confirmLoading={submitting} width={640} destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="name" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
            <Input placeholder="如: orion-platform" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="项目描述..." />
          </Form.Item>
          <Form.Item name="teamLead" label="负责人">
            <Input placeholder="负责人姓名" />
          </Form.Item>
          <Form.Item name="teamMembers" label="团队成员 (逗号分隔)">
            <Input placeholder="如: 张三, 李四, 王五" />
          </Form.Item>
          <Form.Item name="environments" label="环境 (逗号分隔)">
            <Input placeholder="如: dev, staging, production" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="编辑项目" open={editModalVisible} onCancel={() => setEditModalVisible(false)}
        onOk={handleEdit} confirmLoading={submitting} width={640} destroyOnClose
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="name" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="teamLead" label="负责人">
            <Input />
          </Form.Item>
          <Form.Item name="teamMembers" label="团队成员 (逗号分隔)">
            <Input />
          </Form.Item>
          <Form.Item name="environments" label="环境 (逗号分隔)">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title={selectedProject ? (
          <Space>
            <FolderOutlined style={{ color: colors.primary[500] }} />
            <span>{selectedProject.name}</span>
            <Tag color={statusColorMap[selectedProject.status]}>
              {statusLabelMap[selectedProject.status]}
            </Tag>
          </Space>
        ) : '项目详情'}
        open={detailDrawerVisible} onClose={() => setDetailDrawerVisible(false)} width={800} destroyOnClose
      >
        {selectedProject && (
          <>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: 24 }}>
              <Descriptions.Item label="项目名称">{selectedProject.name}</Descriptions.Item>
              <Descriptions.Item label="Slug">{selectedProject.slug}</Descriptions.Item>
              <Descriptions.Item label="负责人">
                <Space>
                  <Avatar size="small" style={{ backgroundColor: colors.primary[500] }}>
                    {selectedProject.teamLead?.charAt(0) || '?'}
                  </Avatar>
                  {selectedProject.teamLead || '-'}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColorMap[selectedProject.status]}>{statusLabelMap[selectedProject.status]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="团队成员" span={2}>
                <Space wrap>
                  {selectedProject.teamMembers?.map((m: string) => (
                    <Tag key={m} icon={<TeamOutlined />}>{m}</Tag>
                  )) || '-'}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="环境" span={2}>
                <Space>
                  {selectedProject.environments?.map((env: string) => (
                    <Tag key={env} color="blue" icon={<EnvironmentOutlined />}>{env}</Tag>
                  )) || '-'}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>{selectedProject.description || '-'}</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                <Text type="secondary"><ClockCircleOutlined style={{ marginRight: 4 }} />
                  {dayjs(selectedProject.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                <Text type="secondary"><ClockCircleOutlined style={{ marginRight: 4 }} />
                  {dayjs(selectedProject.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
                </Text>
              </Descriptions.Item>
            </Descriptions>

            <Title level={5} style={{ marginBottom: 12 }}>关联资源</Title>
            <AntTable
              columns={resourceColumns}
              dataSource={projectResources}
              rowKey="id"
              size="small"
              locale={{ emptyText: '暂无关联资源' }}
            />
          </>
        )}
      </Drawer>
    </div>
  );
};

export default ProjectManagement;
