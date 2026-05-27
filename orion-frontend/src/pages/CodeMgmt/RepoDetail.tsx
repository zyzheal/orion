/**
 * Code Management - Repository Detail Page
 * Tabs for Branches and Pull Requests with table views
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Tabs,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  message,
  Spin,
  Select,
} from 'antd';
import { colors, spacing } from '@/tokens';
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  PlusOutlined,
  DeleteOutlined,
  LockOutlined,
  UnlockOutlined,
  FolderOpenOutlined,} from '@ant-design/icons';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Table, { type TableColumn } from '@/components/Table';
import StatusBadge from '@/components/StatusBadge';
import {
  getCodeRepos,
  getCodeRepoAdapters,
  getCodeRepoBranches,
  createCodeRepoBranch,
  deleteCodeRepoBranch,
  getPullRequests,
  createPullRequest,
  type Branch,
  type PullRequest,
  type CreateBranchInput,
  type CreatePullRequestInput,
} from '@/api/code-mgmt';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const RepoDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  const [pullRequests, setPullRequests] = useState<any[]>([]);
  const [adapterId, setAdapterId] = useState<string>('');
  const [repoName, setRepoName] = useState<string>('');
  const [repoLoading, setRepoLoading] = useState(true);

  // Modal states
  const [createBranchModal, setCreateBranchModal] = useState(false);
  const [createPrModal, setCreatePrModal] = useState(false);
  const [branchForm] = Form.useForm<CreateBranchInput>();
  const [prForm] = Form.useForm<CreatePullRequestInput>();

  // Load adapter info to resolve adapterId for this repo
  const resolveAdapterId = useCallback(async () => {
    if (!id) return;
    setRepoLoading(true);
    try {
      const adaptersResp = await getCodeRepoAdapters();
      const adapters = adaptersResp.data as Array<{ id: string; name: string; type: string }>;
      if (!Array.isArray(adapters)) return;

      for (const adapter of adapters) {
        try {
          const reposResp = await getCodeRepos(adapter.id);
          const repos = reposResp.data as Array<{
            id: string;
            name: string;
            adapterId: string;
          }>;
          if (Array.isArray(repos)) {
            const found = repos.find((r) => r.id === id);
            if (found) {
              setAdapterId(adapter.id);
              setRepoName(found.name);
              return;
            }
          }
        } catch {
          // continue to next adapter - optional loading
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`解析适配器信息失败：${error.message}`);
      } else {
        message.error('解析适配器信息失败，请稍后重试');
      }
    } finally {
      setRepoLoading(false);
    }
  }, [id]);

  const loadBranches = useCallback(async () => {
    if (!adapterId || !id) return;
    setLoading(true);
    try {
      const response = await getCodeRepoBranches(adapterId, id);
      const data = response.data as Branch[];
      setBranches(Array.isArray(data) ? data : []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载分支列表失败：${error.message}`);
      } else {
        message.error('加载分支列表失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  }, [adapterId, id]);

  const loadPullRequests = useCallback(async () => {
    if (!adapterId || !id) return;
    setLoading(true);
    try {
      const response = await getPullRequests(adapterId, id);
      const data = response.data as PullRequest[];
      setPullRequests(Array.isArray(data) ? data : []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载 Pull Request 列表失败：${error.message}`);
      } else {
        message.error('加载 Pull Request 列表失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  }, [adapterId, id]);

  useEffect(() => {
    resolveAdapterId();
  }, [resolveAdapterId]);

  useEffect(() => {
    if (adapterId) {
      loadBranches();
      loadPullRequests();
    }
  }, [adapterId, loadBranches, loadPullRequests]);

  const handleCreateBranch = async (values: CreateBranchInput) => {
    try {
      await createCodeRepoBranch(adapterId, id!, values);
      message.success('分支创建成功');
      setCreateBranchModal(false);
      branchForm.resetFields();
      loadBranches();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`创建分支失败：${error.message}`);
      } else {
        message.error('创建分支失败，请稍后重试');
      }
    }
  };

  const handleDeleteBranch = (branchName: string) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除分支 "${branchName}" 吗？`,
      okText: '删除',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteCodeRepoBranch(adapterId, id!, branchName);
          message.success('分支已删除');
          loadBranches();
        } catch (error) {
          message.error('删除分支失败');
        }
      },
    });
  };

  const handleCreatePR = async (values: CreatePullRequestInput) => {
    try {
      await createPullRequest(adapterId, id!, values);
      message.success('Pull Request 创建成功');
      setCreatePrModal(false);
      prForm.resetFields();
      loadPullRequests();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`创建 Pull Request 失败：${error.message}`);
      } else {
        message.error('创建 Pull Request 失败，请稍后重试');
      }
    }
  };

  const branchColumns: TableColumn<Branch>[] = [
    {
      key: 'name',
      title: '分支名称',
      dataIndex: 'name',
      width: 250,
      sortable: true,
      render: (value: unknown, record: any) => (
        <Space>
          <Text strong>{String(value)}</Text>
          {record.isProtected && <Tag color="red">受保护</Tag>}
        </Space>
      ),
    },
    {
      key: 'commitSha',
      title: '最新提交',
      dataIndex: 'commitSha',
      width: 180,
      render: (value: unknown) => (
        <Text code style={{ fontSize: spacing[3] }}>
          {String(value).substring(0, 8)}
        </Text>
      ),
    },
    {
      key: 'lastCommitDate',
      title: '最后提交时间',
      dataIndex: 'lastCommitDate',
      width: 200,
      sortable: true,
      render: (value: unknown) => <Text type="secondary">{dayjs(String(value)).fromNow()}</Text>,
    },
    {
      key: 'actions',
      title: '操作',
      width: 120,
      render: (_: unknown, record: any) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={record.isProtected ? <UnlockOutlined /> : <LockOutlined />}
          >
            {record.isProtected ? '解锁' : '保护'}
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteBranch(record.name)}
          />
        </Space>
      ),
    },
  ];

  const prColumns: TableColumn<PullRequest>[] = [
    {
      key: 'title',
      title: 'Pull Request',
      dataIndex: 'title',
      width: 300,
      sortable: true,
      render: (value: unknown, record: any) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ cursor: 'pointer', color: colors.primary[500] }}>
            {String(value)}
          </Text>
          <Text type="secondary" style={{ fontSize: spacing[3] }}>
            #{record.id}
          </Text>
        </Space>
      ),
    },
    {
      key: 'state',
      title: '状态',
      dataIndex: 'state',
      width: 120,
      render: (value: unknown) => {
        const statusMap: Record<string, any> = {
          open: { status: 'running', label: 'Open' },
          closed: { status: 'cancelled', label: 'Closed' },
          merged: { status: 'success', label: 'Merged' },
        };
        const config = statusMap[String(value)] || { status: 'unknown', label: String(value) };
        return <StatusBadge status={config.status} label={config.label} size="small" />;
      },
    },
    {
      key: 'branches',
      title: '分支',
      width: 250,
      render: (_: unknown, record: any) => (
        <Space size={4}>
          <Tag color="blue">{record.sourceBranch}</Tag>
          <Text type="secondary">→</Text>
          <Tag color="green">{record.targetBranch}</Tag>
        </Space>
      ),
    },
    {
      key: 'author',
      title: '作者',
      dataIndex: 'author',
      width: 120,
      render: (value: unknown) => <Text code>{String(value)}</Text>,
    },
    {
      key: 'reviewCount',
      title: '评论',
      dataIndex: 'reviewCount',
      width: 80,
      render: (value: unknown) => <Text>{String(value)}</Text>,
    },
    {
      key: 'createdAt',
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
      sortable: true,
      render: (value: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {dayjs(String(value)).fromNow()}
        </Text>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'branches',
      label: `分支 (${branches.length})`,
      children: (
        <>
          <div style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateBranchModal(true)}
            >
              创建分支
            </Button>
          </div>
          <Table
            columns={branchColumns}
            dataSource={branches}
            loading={loading}
            rowKey="name"
            size="middle"
            striped
          />
        </>
      ),
    },
    {
      key: 'prs',
      label: `Pull Requests (${pullRequests.length})`,
      children: (
        <>
          <div style={{ marginBottom: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreatePrModal(true)}>
              创建 Pull Request
            </Button>
          </div>
          <Table
            columns={prColumns}
            dataSource={pullRequests}
            loading={loading}
            rowKey="id"
            size="middle"
            striped
          />
        </>
      ),
    },
  ];

  const defaultTab = searchParams.get('tab') || 'branches';

  if (repoLoading) {
    return <Spin size="large" style={{ display: 'block', textAlign: 'center', padding: 48 }} />;
  }

  return (
    <div style={{ padding: 0 }}>
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/code-mgmt')}>
          返回
        </Button>
        <div style={{ flex: 1 }}>
          <Title level={2} style={{ marginBottom: 8 }}>
            <FolderOpenOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            {repoName || id}
          </Title>
          <Text type="secondary">仓库详情</Text>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => {
            loadBranches();
            loadPullRequests();
          }}
          loading={loading}
        >
          刷新
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultActiveKey={defaultTab} items={tabItems} size="large" />

      {/* Create Branch Modal */}
      <Modal
        title="创建分支"
        open={createBranchModal}
        onCancel={() => {
          setCreateBranchModal(false);
          branchForm.resetFields();
        }}
        onOk={() => branchForm.submit()}
      >
        <Form form={branchForm} onFinish={handleCreateBranch} layout="vertical">
          <Form.Item
            label="分支名称"
            name="name"
            rules={[{ required: true, message: '请输入分支名称' }]}
          >
            <Input placeholder="例如：feature/new-feature" />
          </Form.Item>
          <Form.Item label="基于分支" name="sourceBranch">
            <Input placeholder="例如：main (可选)" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Create Pull Request Modal */}
      <Modal
        title="创建 Pull Request"
        open={createPrModal}
        onCancel={() => {
          setCreatePrModal(false);
          prForm.resetFields();
        }}
        onOk={() => prForm.submit()}
        width={600}
      >
        <Form form={prForm} onFinish={handleCreatePR} layout="vertical">
          <Form.Item
            label="标题"
            name="title"
            rules={[{ required: true, message: '请输入 PR 标题' }]}
          >
            <Input placeholder="PR 标题" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={3} placeholder="PR 描述 (可选)" />
          </Form.Item>
          <Form.Item
            label="源分支"
            name="sourceBranch"
            rules={[{ required: true, message: '请选择源分支' }]}
          >
            <Select
              placeholder="选择源分支"
              options={branches.map((b) => ({ label: b.name, value: b.name }))}
            />
          </Form.Item>
          <Form.Item
            label="目标分支"
            name="targetBranch"
            rules={[{ required: true, message: '请选择目标分支' }]}
          >
            <Select
              placeholder="选择目标分支"
              options={branches.map((b) => ({ label: b.name, value: b.name }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default RepoDetail;
