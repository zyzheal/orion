/**
 * 合并预检查 (Merge Preview)
 * 后端: /api/v1/branch-policy/merge-preview — 合并冲突预检、风险等级评估
 *
 * 功能:
 * - 合并预检查表单：选择源分支 + 目标分支（可选 commit 定位）
 * - 冲突文件列表：按目录分组 + 冲突数量 + 严重度标记
 * - 变更统计：新增 / 修改 / 删除文件数
 * - 风险等级徽章：low / medium / high / critical
 * - 预览 diff：点击冲突文件展示片段
 * - 历史记录：最近合并预检记录
 *
 * 设计文档: docs/multi-branch-strategy-design-v2-impl-2026-09-08.md §5.7
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Collapse,
  Descriptions,
  Empty,
  Form,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  BranchesOutlined,
  ExperimentOutlined,
  ReloadOutlined,
  SendOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { spacing } from '@/tokens';
import PageSkeleton from '@/components/PageSkeleton';
import {
  createMergePreview,
  getBranchProfiles,
  getMergePreview,
  listMergePreviews,
  type BranchProfile,
  type MergePreview,
  type MergePreviewInput,
  type RiskLevel,
} from '@/api/branch-policy';

const { Title, Text } = Typography;

const RISK_LEVELS: RiskLevel[] = ['low', 'medium', 'high', 'critical'];

const RISK_META: Record<RiskLevel, { color: string; label: string }> = {
  low: { color: 'green', label: '低' },
  medium: { color: 'gold', label: '中' },
  high: { color: 'orange', label: '高' },
  critical: { color: 'red', label: '严重' },
};

/** 按顶层目录归组冲突文件，返回 { dir -> { files, count } } */
function groupConflicts(files: string[]): Array<{ dir: string; files: string[]; count: number }> {
  const grouped = new Map<string, string[]>();
  for (const f of files) {
    const parts = f.split('/');
    const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '（根目录）';
    if (!grouped.has(dir)) grouped.set(dir, []);
    grouped.get(dir)!.push(f);
  }
  return Array.from(grouped.entries())
    .map(([dir, fs]) => ({ dir, files: fs.sort(), count: fs.length }))
    .sort((a, b) => b.count - a.count);
}

export default function MergePreview() {
  const [profiles, setProfiles] = useState<BranchProfile[]>([]);
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [history, setHistory] = useState<MergePreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [form] = Form.useForm();

  const fetchProfilesAndHistory = useCallback(async () => {
    setLoading(true);
    try {
      const [profilesRes, historyRes] = await Promise.all([
        getBranchProfiles({ status: 'active' }),
        listMergePreviews({ limit: 10 }),
      ]);
      setProfiles((profilesRes.data ?? []) as unknown as BranchProfile[]);
      setHistory((historyRes.data ?? []) as unknown as MergePreview[]);
    } catch (err) {
      message.error(`加载分支/历史失败：${(err as Error).message ?? err}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProfilesAndHistory();
  }, [fetchProfilesAndHistory]);

  const branchOptions = useMemo(
    () =>
      profiles.map((p) => ({ label: `${p.name}（${p.semantic}）`, value: p.name })).sort((a, b) =>
        a.label.localeCompare(b.label),
      ),
    [profiles],
  );

  const handleCheck = async () => {
    try {
      const values = await form.validateFields();
      const payload: MergePreviewInput = {
        sourceBranch: values.sourceBranch,
        targetBranch: values.targetBranch,
        sourceCommit: values.sourceCommit,
        targetCommit: values.targetCommit,
      };
      setChecking(true);
      const res = await createMergePreview(payload);
      setPreview(res.data as unknown as MergePreview);
      message.success('合并预检查完成');
      void fetchProfilesAndHistory();
    } catch (err) {
      if ((err as { errorFields?: unknown }).errorFields) return;
      message.error(`预检查失败：${(err as Error).message ?? err}`);
    } finally {
      setChecking(false);
    }
  };

  const openHistory = async (id: string) => {
    try {
      const res = await getMergePreview(id);
      setPreview(res.data as unknown as MergePreview);
    } catch (err) {
      message.error(`加载预检记录失败：${(err as Error).message ?? err}`);
    }
  };

  const conflictGroups = useMemo(
    () => (preview ? groupConflicts(preview.conflictFiles) : []),
    [preview],
  );

  const renderDiffSnippet = (file: string) => {
    // 无真实 git diff 数据时给出占位提示（预检结果通常不内嵌 diff 内容）
    return (
      <Alert
        type="info"
        showIcon
        message={`${file} 存在冲突`}
        description="该文件在源/目标分支上均有改动，需要人工合并。可在目标分支 checkout 后执行 git mergetool 处理。"
      />
    );
  };

  const renderResult = () => {
    if (!preview) return null;
    const risk = RISK_META[preview.riskLevel];
    return (
      <>
        <Card title="预检结果" size="small" style={{ marginBottom: spacing.md }}>
          <Row gutter={[16, 16]}>
            <Col flex="auto">
              <Statistic
                title="风险等级"
                value={risk.label}
                valueStyle={{ color: risk.color === 'gold' ? '#faad14' : risk.color }}
              />
            </Col>
            <Col flex="auto">
              <Statistic title="冲突文件" value={preview.conflictCount} />
            </Col>
            <Col flex="auto">
              <Statistic title="新增" value={preview.addedFiles.length} />
            </Col>
            <Col flex="auto">
              <Statistic title="修改" value={preview.modifiedFiles.length} />
            </Col>
            <Col flex="auto">
              <Statistic title="删除" value={preview.deletedFiles.length} />
            </Col>
          </Row>
          <div style={{ marginTop: spacing.md }}>
            <Descriptions size="small" column={2}>
              <Descriptions.Item label="源分支">
                <Tag color="blue">{preview.sourceBranch}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="目标分支">
                <Tag color="green">{preview.targetBranch}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="源提交">
                <Text code>{preview.sourceCommit ? preview.sourceCommit.slice(0, 10) : '-'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="目标提交">
                <Text code>{preview.targetCommit ? preview.targetCommit.slice(0, 10) : '-'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="预检时间" span={2}>
                {new Date(preview.previewedAt).toLocaleString()}
              </Descriptions.Item>
            </Descriptions>
          </div>
          {preview.conflictCount > 0 ? (
            <Alert
              style={{ marginTop: spacing.md }}
              type={preview.riskLevel === 'critical' || preview.riskLevel === 'high' ? 'warning' : 'info'}
              showIcon
              icon={<WarningOutlined />}
              message={`检测到 ${preview.conflictCount} 个冲突文件，合并风险等级：${risk.label}`}
              description="冲突文件需要人工解决后才能安全合并。点击下方文件条目查看冲突说明。"
            />
          ) : (
            <Alert
              style={{ marginTop: spacing.md }}
              type="success"
              showIcon
              message="未检测到冲突，可以安全合并"
            />
          )}
        </Card>

        <Card title="冲突文件" size="small" style={{ marginBottom: spacing.md }}>
          {conflictGroups.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无冲突文件" />
          ) : (
            <Collapse
              accordion={false}
              items={conflictGroups.map((g) => ({
                key: g.dir,
                label: (
                  <Space size={8}>
                    <Text code>{g.dir}</Text>
                    <Tag color="red">{g.count} 个冲突</Tag>
                  </Space>
                ),
                children: (
                  <Space direction="vertical" style={{ width: '100%' }} size={4}>
                    {g.files.map((f) => (
                      <div key={f}>
                        <Button
                          type="text"
                          size="small"
                          style={{ paddingLeft: 0, height: 'auto' }}
                          onClick={() => setExpandedFile(expandedFile === f ? null : f)}
                        >
                          <Text code>{f}</Text>
                        </Button>
                        {expandedFile === f && (
                          <div style={{ marginLeft: 8, marginBottom: 8 }}>{renderDiffSnippet(f)}</div>
                        )}
                      </div>
                    ))}
                  </Space>
                ),
              }))}
            />
          )}
        </Card>
      </>
    );
  };

  const historyColumns = useMemo(
    () => [
      {
        title: '预检时间',
        dataIndex: 'previewedAt',
        key: 'previewedAt',
        width: 170,
        render: (v: string) => new Date(v).toLocaleString(),
      },
      {
        title: '源分支',
        dataIndex: 'sourceBranch',
        key: 'sourceBranch',
        width: 150,
        render: (v: string) => <Tag color="blue">{v}</Tag>,
      },
      {
        title: '目标分支',
        dataIndex: 'targetBranch',
        key: 'targetBranch',
        width: 150,
        render: (v: string) => <Tag color="green">{v}</Tag>,
      },
      {
        title: '冲突',
        dataIndex: 'conflictCount',
        key: 'conflictCount',
        width: 80,
        render: (v: number) => (v > 0 ? <Tag color="red">{v}</Tag> : <Tag color="green">0</Tag>),
      },
      {
        title: '风险',
        dataIndex: 'riskLevel',
        key: 'riskLevel',
        width: 100,
        render: (v: RiskLevel) => (
          <Tag color={RISK_META[v].color}>{RISK_META[v].label}</Tag>
        ),
      },
      {
        title: '操作',
        key: 'action',
        width: 90,
        render: (_: unknown, row: MergePreview) => (
          <Button type="link" size="small" onClick={() => void openHistory(row.id)}>
            查看
          </Button>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (loading && history.length === 0 && !preview) {
    return <PageSkeleton rows={8} searchBar={false} />;
  }

  return (
    <div>
      <Title level={2} style={{ marginBottom: 8 }}>
        <BranchesOutlined style={{ marginRight: 12, color: '#3370E6' }} />
        合并预检查
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
        合并前冲突预检：选择源/目标分支，评估合并风险与冲突文件清单
      </Text>

      <Card title="发起合并预检查" size="small" style={{ marginBottom: spacing.md }}>
        <Form form={form} layout="vertical" style={{ maxWidth: 700 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="sourceBranch"
                label="源分支"
                rules={[{ required: true, message: '请选择源分支' }]}
              >
                <Select
                  showSearch
                  placeholder="选择源分支"
                  options={branchOptions}
                  filterOption={(input, option) =>
                    ((option?.label ?? '') as string).toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="targetBranch"
                label="目标分支"
                rules={[{ required: true, message: '请选择目标分支' }]}
              >
                <Select
                  showSearch
                  placeholder="选择目标分支"
                  options={branchOptions}
                  filterOption={(input, option) =>
                    ((option?.label ?? '') as string).toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="sourceCommit" label="源提交（可选）">
                <Input placeholder="留空使用最新提交" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="targetCommit" label="目标提交（可选）">
                <Input placeholder="留空使用最新提交" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item>
            <Space>
              <Button
                type="primary"
                icon={<ExperimentOutlined />}
                loading={checking}
                onClick={() => void handleCheck()}
              >
                发起预检查
              </Button>
              <Button icon={<ReloadOutlined />} onClick={() => void fetchProfilesAndHistory()}>
                刷新
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {renderResult()}

      <Card title="最近预检记录" size="small">
        {history.length === 0 ? (
          <Empty description="暂无预检记录" />
        ) : (
          <Table
            rowKey="id"
            columns={historyColumns}
            dataSource={history}
            pagination={false}
            size="small"
          />
        )}
      </Card>
    </div>
  );
}
