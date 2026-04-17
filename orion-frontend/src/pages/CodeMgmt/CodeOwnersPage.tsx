/**
 * Code Management - CODEOWNERS Page
 * Editor for CODEOWNERS file with validate and save functionality
 */
import React, { useState, useCallback } from 'react';
import { Typography, Button, Space, Select, Input, message, Card, Alert } from 'antd';
import {
  SaveOutlined, CheckCircleOutlined, ReloadOutlined,
  DeleteOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import { Modal, Tag } from 'antd';
import {
  getCodeOwners, registerCodeOwners, deleteCodeOwners, validateCodeOwners, recommendCodeOwnersApprovers,
  getCodeRepoAdapters, getCodeRepos,
} from '@/api/code-mgmt';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface RepoOption {
  id: string;
  name: string;
  adapterId: string;
}

const CodeOwnersPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);

  // Repo selection
  const [repoOptions, setRepoOptions] = useState<RepoOption[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string | undefined>();

  // CODEOWNERS content
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');

  // Validation result
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    message: string;
  } | null>(null);

  // Recommendations
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<any[]>([]);

  // Load repos for selection
  const loadRepos = useCallback(async () => {
    setLoading(true);
    try {
      const adaptersResp = await getCodeRepoAdapters();
      const adapters = adaptersResp.data.data as Array<{ id: string; name: string; type: string }>;
      if (!Array.isArray(adapters)) return;

      const allRepos: RepoOption[] = [];
      for (const adapter of adapters) {
        try {
          const reposResp = await getCodeRepos(adapter.id);
          const repos = reposResp.data.data as Array<{ id: string; name: string }>;
          if (Array.isArray(repos)) {
            repos.forEach((repo) => allRepos.push({ ...repo, adapterId: adapter.id }));
          }
        } catch {
          // skip
        }
      }
      setRepoOptions(allRepos);
    } catch (error) {
      console.error('Failed to load repos:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadRepos();
  }, [loadRepos]);

  // Load existing CODEOWNERS for selected repo
  const loadCodeOwners = useCallback(async () => {
    if (!selectedRepoId) return;
    setLoading(true);
    setValidationResult(null);
    try {
      const response = await getCodeOwners(selectedRepoId);
      const data = response.data.data as { content?: string } | null;
      if (data?.content) {
        setContent(data.content);
        setSavedContent(data.content);
      } else {
        setContent('');
        setSavedContent('');
      }
    } catch (error) {
      console.error('Failed to load CODEOWNERS:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedRepoId]);

  React.useEffect(() => {
    if (selectedRepoId) {
      loadCodeOwners();
    }
  }, [selectedRepoId, loadCodeOwners]);

  const handleValidate = async () => {
    if (!content.trim()) {
      message.warning('请输入 CODEOWNERS 内容');
      return;
    }
    setValidating(true);
    try {
      const response = await validateCodeOwners(content);
      const data = response.data.data as { valid: boolean; message?: string };
      setValidationResult({
        valid: data.valid ?? true,
        message: data.message || (data.valid ? 'CODEOWNERS 格式正确' : 'CODEOWNERS 格式错误'),
      });
      if (data.valid) {
        message.success('CODEOWNERS 验证通过');
      } else {
        message.error('CODEOWNERS 验证失败');
      }
    } catch (error) {
      console.error('Failed to validate CODEOWNERS:', error);
      setValidationResult({ valid: false, message: '验证请求失败' });
      message.error('验证请求失败');
    } finally {
      setValidating(false);
    }
  };

  const handleSave = async () => {
    if (!selectedRepoId) {
      message.warning('请先选择一个仓库');
      return;
    }
    if (!content.trim()) {
      message.warning('请输入 CODEOWNERS 内容');
      return;
    }
    setSaving(true);
    try {
      await registerCodeOwners({ repoId: selectedRepoId, content });
      message.success('CODEOWNERS 已保存');
      setSavedContent(content);
    } catch (error) {
      console.error('Failed to save CODEOWNERS:', error);
      message.error('保存 CODEOWNERS 失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!selectedRepoId) return;
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除仓库 "${selectedRepoId}" 的 CODEOWNERS 配置吗？`,
      okText: '删除',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteCodeOwners(selectedRepoId);
          message.success('CODEOWNERS 已删除');
          setContent('');
          setSavedContent('');
          setValidationResult(null);
        } catch (error) {
          message.error('删除 CODEOWNERS 失败');
        }
      },
    });
  };

  const handleRecommend = async () => {
    if (!selectedRepoId) {
      message.warning('请先选择一个仓库');
      return;
    }
    setRecommendLoading(true);
    try {
      // Recommend approvers for common paths
      const filePaths = ['src/', 'tests/', 'docs/'];
      const response = await recommendCodeOwnersApprovers(selectedRepoId, filePaths);
      const data = response.data.data as any[];
      if (Array.isArray(data)) {
        setRecommendations(data);
        message.success('推荐加载完成');
      }
    } catch (error) {
      console.error('Failed to get recommendations:', error);
      message.error('获取推荐失败');
    } finally {
      setRecommendLoading(false);
    }
  };

  const isDirty = content !== savedContent;

  const recommendationColumns: TableColumn<any>[] = [
    {
      key: 'filePath',
      title: '文件路径',
      dataIndex: 'filePath',
      width: 200,
      render: (value: unknown) => <Text code>{String(value)}</Text>,
    },
    {
      key: 'approvers',
      title: '推荐审批人',
      dataIndex: 'approvers',
      render: (value: unknown) => (
        <Space wrap>
          {(Array.isArray(value) ? value : []).map((user: string, idx: number) => (
            <Tag key={idx} color="blue">@{user}</Tag>
          ))}
        </Space>
      ),
    },
  ];

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
            CODEOWNERS
          </Title>
          <Text type="secondary">
            配置代码仓库的 CODEOWNERS 文件，定义文件/目录的负责人
          </Text>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadCodeOwners}
            loading={loading}
            disabled={!selectedRepoId}
          >
            重新加载
          </Button>
          <Button
            icon={<DeleteOutlined />}
            danger
            onClick={handleDelete}
            disabled={!selectedRepoId || !savedContent}
          >
            删除
          </Button>
        </Space>
      </div>

      {/* Repo selector */}
      <Card style={{ marginBottom: 16 }} size="small">
        <Space>
          <Text strong>选择仓库:</Text>
          <Select
            style={{ width: 300 }}
            placeholder="选择一个仓库"
            value={selectedRepoId}
            onChange={setSelectedRepoId}
            options={repoOptions.map((repo) => ({
              label: `${repo.name} (${repo.adapterId})`,
              value: repo.id,
            }))}
            allowClear
            loading={loading}
          />
        </Space>
      </Card>

      {/* Editor */}
      <Card
        title={
          <Space>
            CODEOWNERS 编辑器
            {isDirty && <Text type="warning">(已修改未保存)</Text>}
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<ThunderboltOutlined />}
              onClick={handleRecommend}
              loading={recommendLoading}
            >
              获取推荐
            </Button>
            <Button
              icon={<CheckCircleOutlined />}
              onClick={handleValidate}
              loading={validating}
            >
              验证
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={saving}
              disabled={!selectedRepoId || !isDirty}
            >
              保存
            </Button>
          </Space>
        }
      >
        <TextArea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={`# CODEOWNERS 文件格式示例:\n# 路径模式  负责人\n\n# 默认负责人\n*       @default-owner\n\n# 前端代码负责人\nsrc/frontend/    @frontend-team\n\n# 后端代码负责人\nsrc/backend/     @backend-team\n\n# 测试文件\n**/*.test.ts     @qa-team`}
          rows={20}
          style={{ fontFamily: 'monospace', fontSize: 14, lineHeight: 1.6 }}
        />
      </Card>

      {/* Validation result */}
      {validationResult && (
        <Alert
          style={{ marginTop: 16 }}
          type={validationResult.valid ? 'success' : 'error'}
          message={validationResult.valid ? '验证通过' : '验证失败'}
          description={validationResult.message}
          showIcon
        />
      )}

      {/* Recommendations table */}
      {recommendations.length > 0 && (
        <Card title="推荐审批人" style={{ marginTop: 16 }}>
          <Table
            columns={recommendationColumns}
            dataSource={recommendations}
            rowKey="filePath"
            size="small"
            striped
          />
        </Card>
      )}
    </div>
  );
};

export default CodeOwnersPage;
