/**
 * Code Management - Repository List Page
 * Displays repositories in a card grid with adapter filter buttons
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Typography, Button, Space, Card, Row, Col, Tag, message, Modal } from 'antd';
import { ReloadOutlined, EyeOutlined, DeleteOutlined, BranchesOutlined, MergeOutlined } from '@ant-design/icons';
import { getCodeRepoAdapters, getCodeRepos, getCodeRepoBranches, getPullRequests, type CodeRepo } from '@/api/code-mgmt';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

interface AdapterOption {
  id: string;
  name: string;
  type: string;
}

const RepoList: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [adapters, setAdapters] = useState<AdapterOption[]>([]);
  const [selectedAdapter, setSelectedAdapter] = useState<string | undefined>();
  const [repos, setRepos] = useState<CodeRepo[]>([]);
  const [repoBranchCounts, setRepoBranchCounts] = useState<Record<string, number>>({});
  const [repoPrCounts, setRepoPrCounts] = useState<Record<string, number>>({});

  // Load adapters
  const loadAdapters = useCallback(async () => {
    try {
      const response = await getCodeRepoAdapters();
      const data = response.data.data as AdapterOption[];
      setAdapters(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load adapters:', error);
    }
  }, []);

  // Load repos for selected adapter
  const loadRepos = useCallback(async (adapterId: string | undefined) => {
    if (!adapterId) return;
    setLoading(true);
    try {
      const response = await getCodeRepos(adapterId);
      const data = response.data.data as CodeRepo[];
      setRepos(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load repos:', error);
      message.error('加载仓库列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdapters();
  }, [loadAdapters]);

  useEffect(() => {
    if (selectedAdapter) {
      loadRepos(selectedAdapter);
    }
  }, [selectedAdapter, loadRepos]);

  // Load branch count for a repo
  const loadRepoDetails = useCallback(async (repo: CodeRepo) => {
    try {
      const branchesResp = await getCodeRepoBranches(repo.adapterId, repo.id);
      const branches = branchesResp.data.data as any[];
      if (Array.isArray(branches)) {
        setRepoBranchCounts((prev) => ({ ...prev, [repo.id]: branches.length }));
      }
    } catch {
      // silently ignore
    }
    try {
      const prResp = await getPullRequests(repo.adapterId, repo.id);
      const prs = prResp.data.data as any[];
      if (Array.isArray(prs)) {
        setRepoPrCounts((prev) => ({ ...prev, [repo.id]: prs.length }));
      }
    } catch {
      // silently ignore
    }
  }, []);

  const handleAdapterChange = useCallback((adapterId: string) => {
    setSelectedAdapter(adapterId === selectedAdapter ? undefined : adapterId);
  }, [selectedAdapter]);

  const handleDeleteRepo = useCallback((repo: CodeRepo) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除仓库 "${repo.name}" 吗？此操作不可撤销。`,
      okText: '删除',
      okButtonProps: { danger: true },
      onOk: () => {
        message.info('删除功能需要后端支持');
      },
    });
  }, []);

  const filteredRepos = useMemo(() => {
    return repos;
  }, [repos]);

  const handleRefresh = () => {
    if (selectedAdapter) {
      loadRepos(selectedAdapter);
    }
  };

  return (
    <div style={{ padding: 0 }}>
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            代码仓库
          </Title>
          <Text type="secondary">
            管理所有代码仓库、分支和 Pull Request
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
          刷新
        </Button>
      </div>

      {/* Adapter filter buttons */}
      {adapters.length > 0 && (
        <Space wrap style={{ marginBottom: 24 }}>
          <Text strong>Adapter:</Text>
          {adapters.map((adapter) => (
            <Button
              key={adapter.id}
              type={selectedAdapter === adapter.id ? 'primary' : 'default'}
              onClick={() => handleAdapterChange(adapter.id)}
            >
              {adapter.name} ({adapter.type})
            </Button>
          ))}
        </Space>
      )}

      {/* Repo card grid */}
      {!selectedAdapter ? (
        <Card>
          <Text type="secondary">请选择一个 Adapter 以加载仓库列表</Text>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {filteredRepos.map((repo) => {
            const branchCount = repoBranchCounts[repo.id] ?? repo.branchCount;
            const prCount = repoPrCounts[repo.id] ?? repo.pullRequestCount;
            return (
              <Col xs={24} sm={12} lg={8} xl={6} key={repo.id}>
                <Card
                  hoverable
                  size="small"
                  title={
                    <Space>
                      <Text strong style={{ fontSize: 14 }}>
                        {repo.name}
                      </Text>
                    </Space>
                  }
                  extra={
                    <Space size="small">
                      <Button
                        type="text"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => {
                          loadRepoDetails(repo);
                          navigate(`/code-mgmt/repos/${repo.id}`);
                        }}
                      />
                      <Button
                        type="text"
                        size="small"
                        icon={<DeleteOutlined />}
                        danger
                        onClick={() => handleDeleteRepo(repo)}
                      />
                    </Space>
                  }
                  actions={[
                    <Button
                      key="branches"
                      type="text"
                      size="small"
                      icon={<BranchesOutlined />}
                      onClick={() => navigate(`/code-mgmt/repos/${repo.id}`)}
                    >
                      {branchCount} 分支
                    </Button>,
                    <Button
                      key="prs"
                      type="text"
                      size="small"
                      icon={<MergeOutlined />}
                      onClick={() => navigate(`/code-mgmt/repos/${repo.id}?tab=prs`)}
                    >
                      {prCount} PR
                    </Button>,
                  ]}
                >
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                      {repo.url}
                    </Text>
                    <Space size={8}>
                      <Tag color="geekblue">{repo.adapterId}</Tag>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        创建于 {dayjs(repo.createdAt).format('YYYY-MM-DD')}
                      </Text>
                    </Space>
                  </Space>
                </Card>
              </Col>
            );
          })}
          {filteredRepos.length === 0 && !loading && (
            <Col span={24}>
              <Card>
                <Text type="secondary">该 Adapter 下暂无仓库</Text>
              </Card>
            </Col>
          )}
        </Row>
      )}
    </div>
  );
};

export default RepoList;
