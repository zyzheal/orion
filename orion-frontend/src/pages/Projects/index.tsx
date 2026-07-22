/**
 * Project Management Page (M7)
 * List, create, edit, view details, delete projects
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
  Popconfirm,
  Drawer,
  Tooltip,
  Descriptions,
  Table as AntTable,
  Avatar,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  FolderOutlined,
  TeamOutlined,
  EnvironmentOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import PageSkeleton from '@/components/PageSkeleton';
import {
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  getProjectResources,
  type Project,
  type CreateProjectInput,
  type UpdateProjectInput,
  type ProjectResource,
} from '@/api/projects';
import { colors } from '@/tokens/colors';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { spacing } from '@/tokens';

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

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getProjects({ tenantId: 'tenant-1' });
      const data = res.data?.data;
      if (Array.isArray(data)) {
        setProjects(data);
      } else if (Array.isArray((data as any).data)) {
        setProjects((data as any).data);
      } else {
        setProjects([]);
      }
    } catch (error: unknown) {
      setProjects([]);
      message.error(`加载项目数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredData = useMemo(() => {
    return projects.filter((p) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !p.name.toLowerCase().includes(q) &&
          !(p.description && p.description.toLowerCase().includes(q)) &&
          !(p.slug && p.slug.toLowerCase().includes(q))
        )
          return false;
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
          ? values.teamMembers
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean)
          : undefined,
        environments: values.environments
          ? values.environments
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean)
          : undefined,
      };
      await createProject(payload);
      message.success('项目创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`创建失败：${error.message}`);
      } else {
        message.error('创建失败');
      }
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
          ? values.teamMembers
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean)
          : undefined,
        environments: values.environments
          ? values.environments
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean)
          : undefined,
      };
      await updateProject(editingProject.id, payload);
      message.success('项目更新成功');
      setEditModalVisible(false);
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        if (error instanceof Error) {
          message.error(`更新失败：${error.message}`);
        } else {
          message.error('更新失败');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProject(id);
      message.success('项目已删除');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`删除失败：${error.message}`);
      } else {
        message.error('删除失败');
      }
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
      setProjectResources(Array.isArray(res.data) ? res.data : []);
    } catch (error: unknown) {
      setProjectResources([]);
    }
  };

  // ---- Table columns ----

  const columns: TableColumn<Project>[] = [
    {
      key: 'name',
      title: '项目名称',
      dataIndex: 'name',
      width: 200,
      sortable: true,
      render: (v: unknown, record: Project) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ cursor: 'pointer' }} onClick={() => openDetail(record)}>
            <FolderOutlined style={{ marginRight: 6, color: colors.primary[500] }} />
            {String(v)}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            / {record.slug}
          </Text>
        </Space>
      ),
    },
    {
      key: 'description',
      title: '描述',
      dataIndex: 'description',
      width: 250,
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {v ? String(v).slice(0, 50) + (String(v).length > 50 ? '...' : '') : '-'}
        </Text>
      ),
    },
    {
      key: 'status',
      title: '状态',
      width: 100,
      render: (_: unknown, record: Project) => (
        <Tag color={statusColorMap[record.status] || 'default'}>
          {statusLabelMap[record.status] || record.status}
        </Tag>
      ),
    },
    {
      key: 'team',
      title: '负责人',
      width: 120,
      render: (_: unknown, record: Project) => (
        <Space>
          <Avatar size="small" style={{ backgroundColor: colors.primary[500] }}>
            {record.teamLead ? record.teamLead.charAt(0) : '?'}
          </Avatar>
          <Text>{record.teamLead || '-'}</Text>
        </Space>
      ),
    },
    {
      key: 'members',
      title: '团队成员',
      width: 120,
      render: (_: unknown, record: Project) => (
        <Tooltip title={record.teamMembers?.join(', ')}>
          <Space>
            <TeamOutlined />
            <Text>{record.teamMembers?.length || 0} 人</Text>
          </Space>
        </Tooltip>
      ),
    },
    {
      key: 'environments',
      title: '环境',
      width: 150,
      render: (_: unknown, record: Project) => (
        <Space wrap>
          {record.environments?.map((env: string) => (
            <Tag key={env} color="blue" style={{ fontSize: 11 }}>
              {env}
            </Tag>
          )) || <Text type="secondary">-</Text>}
        </Space>
      ),
    },
    {
      key: 'updatedAt',
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 140,
      sortable: true,
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(String(v)).fromNow()}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 160,
      render: (_: unknown, record: Project) => (
        <Space size="small" wrap>
          <Tooltip title="详情">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => openDetail(record)}
            >
              详情
            </Button>
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEdit(record)}
            />
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
      key: 'status',
      label: '状态',
      options: [
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
      title: '资源名称',
      dataIndex: 'name',
      key: 'name',
      render: (v: unknown) => <Text strong>{String(v)}</Text>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (v: unknown) => <Tag>{resourceTypeLabelMap[String(v)] || String(v)}</Tag>,
    },
    {
      title: '外部ID',
      dataIndex: 'externalId',
      key: 'externalId',
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {String(v)}
        </Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: unknown) => (
        <Tag color={String(v) === 'active' ? 'green' : 'default'}>{String(v)}</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(String(v)).format('YYYY-MM-DD')}
        </Text>
      ),
    },
  ];

  const isInitialLoading = loading && projects.length === 0;

  return (
    <div style={{ padding: 0 }}>
      {/* Page loading skeleton (initial load) */}
      {isInitialLoading && <PageSkeleton rows={8} />}

      {isInitialLoading ? null : (
        <>
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: spacing.lg,
            }}
          >
            <div>
              <Title level={2} style={{ marginBottom: spacing.sm }}>
                <FolderOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
                项目管理
              </Title>
              <Text type="secondary">管理项目、团队关联和资源分配</Text>
            </div>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
                刷新
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateModalVisible(true)}
              >
                创建项目
              </Button>
            </Space>
          </div>

          {/* Project List */}
          <Card>
            <div style={{ marginBottom: spacing.md }}>
              <SearchFilterBar
                onSearch={setSearchQuery}
                onFilter={setFilters}
                filters={filterDefs}
                searchPlaceholder="搜索项目..."
              />
            </div>
            <Table
              columns={columns}
              dataSource={filteredData}
              loading={loading}
              rowKey="id"
              size="middle"
              striped
            />
          </Card>

          {/* Create Modal */}
          <Modal
            title="创建项目"
            open={createModalVisible}
            onCancel={() => setCreateModalVisible(false)}
            onOk={handleCreate}
            confirmLoading={submitting}
            width={640}
            destroyOnClose
          >
            <Form form={createForm} layout="vertical">
              <Form.Item
                name="name"
                label="项目名称"
                rules={[{ required: true, message: '请输入项目名称' }]}
              >
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
            title="编辑项目"
            open={editModalVisible}
            onCancel={() => setEditModalVisible(false)}
            onOk={handleEdit}
            confirmLoading={submitting}
            width={640}
            destroyOnClose
          >
            <Form form={editForm} layout="vertical">
              <Form.Item
                name="name"
                label="项目名称"
                rules={[{ required: true, message: '请输入项目名称' }]}
              >
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
            title={
              selectedProject ? (
                <Space>
                  <FolderOutlined style={{ color: colors.primary[500] }} />
                  <span>{selectedProject.name}</span>
                  <Tag color={statusColorMap[selectedProject.status]}>
                    {statusLabelMap[selectedProject.status]}
                  </Tag>
                </Space>
              ) : (
                '项目详情'
              )
            }
            open={detailDrawerVisible}
            onClose={() => setDetailDrawerVisible(false)}
            width={800}
            destroyOnClose
          >
            {selectedProject && (
              <>
                <Descriptions column={2} bordered size="small" style={{ marginBottom: spacing.lg }}>
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
                    <Tag color={statusColorMap[selectedProject.status]}>
                      {statusLabelMap[selectedProject.status]}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="团队成员" span={2}>
                    <Space wrap>
                      {selectedProject.teamMembers?.map((m: string) => (
                        <Tag key={m} icon={<TeamOutlined />}>
                          {m}
                        </Tag>
                      )) || '-'}
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="环境" span={2}>
                    <Space>
                      {selectedProject.environments?.map((env: string) => (
                        <Tag key={env} color="blue" icon={<EnvironmentOutlined />}>
                          {env}
                        </Tag>
                      )) || '-'}
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="描述" span={2}>
                    {selectedProject.description || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="创建时间">
                    <Text type="secondary">
                      <ClockCircleOutlined style={{ marginRight: 4 }} />
                      {dayjs(selectedProject.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                    </Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="更新时间">
                    <Text type="secondary">
                      <ClockCircleOutlined style={{ marginRight: 4 }} />
                      {dayjs(selectedProject.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
                    </Text>
                  </Descriptions.Item>
                </Descriptions>

                <Title level={5} style={{ marginBottom: spacing[3] }}>
                  关联资源
                </Title>
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
        </>
      )}
    </div>
  );
};

export default ProjectManagement;
