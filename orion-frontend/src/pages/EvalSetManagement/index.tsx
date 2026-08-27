/**
 * EvalSet Management Page (TR-05)
 *
 * RAG 评测集管理系统 — 管理评测集（EvalSet）及其评测用例（Cases），
 * 支持创建/查看/删除/运行/对比。后端 /api/v1/knowledge/eval/* 已实现。
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Modal,
  Form,
  Input,
  Table,
  Statistic,
  message,
  Popconfirm,
  Empty,
  Row,
  Col,
  Divider,
  Descriptions,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  EyeOutlined,
  SwapOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  FormOutlined,
  ExportOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;
const { TextArea } = Input;

// --- Types ---

interface EvalSetCase {
  id: string;
  query: string;
  gold_answer?: string;
  gold_sources?: string;
  tags?: string;
}

interface EvalSet {
  id: string;
  name: string;
  description?: string;
  version: number;
  is_active: boolean;
  cases?: EvalSetCase[];
  created_by?: string;
  created_at?: string;
}

interface EvalRun {
  id: string;
  set_id: string;
  model: string;
  status: 'running' | 'completed' | 'failed';
  pass_count: number;
  total_count: number;
  avg_recall: number;
  avg_score: number;
  created_by?: string;
  created_at?: string;
}

// --- API Client ---

async function apiCall<T>(path: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`/api/v1/knowledge${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
      ...options?.headers,
    },
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    const msg = err.message || err.error?.message || err.error?.Message || `HTTP ${resp.status}`;
    throw new Error(msg);
  }
  const json = await resp.json();
  return json.data as T;
}

// --- Color helpers ---

const statusColor: Record<string, string> = {
  running: colors.warning[500],
  completed: colors.success[500],
  failed: colors.error[500],
};

const statusLabel: Record<string, string> = {
  running: '运行中',
  completed: '已完成',
  failed: '失败',
};

// --- Page Component ---

const EvalSetManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [sets, setSets] = useState<EvalSet[]>([]);
  const [runs, setRuns] = useState<EvalRun[]>([]);
  const [selectedSet, setSelectedSet] = useState<EvalSet | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm] = Form.useForm<{ name: string; description?: string; cases: string }>();
  const [selectedRuns, setSelectedRuns] = useState<EvalRun[]>([]);
  const [runLoading, setRunLoading] = useState<string | null>(null);

  const loadSets = useCallback(async () => {
    setLoading(true);
    try {
      const [setsRes, runsRes] = await Promise.all([
        apiCall<EvalSet[]>('/eval/sets'),
        apiCall<EvalRun[]>('/eval/runs'),
      ]);
      setSets(Array.isArray(setsRes) ? setsRes : []);
      setRuns(Array.isArray(runsRes) ? runsRes : []);
    } catch (error: unknown) {
      message.error(`加载评测集失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const [seeding, setSeeding] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const result = await apiCall<{ seeded: number }>('/eval/sets/seed', { method: 'POST' });
      const count = (result as unknown as { seeded?: number })?.seeded ?? 0;
      message.success(`已初始化 ${count} 个评测集（TR-09/10/11 演示数据）`);
      loadSets();
    } catch (error: unknown) {
      message.warning(`初始化失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setSeeding(false);
    }
  };

  const handleExportReport = async () => {
    if (runs.length === 0) {
      message.warning('暂无评测运行记录可导出');
      return;
    }
    setExporting(true);
    try {
      const report = {
        reportTitle: 'Orion RAG 评测报告',
        exportTime: new Date().toISOString(),
        totalRuns: runs.length,
        summary: {
          totalSets: sets.length,
          totalCases: sets.reduce((sum, s) => sum + (s.cases?.length || 0), 0),
          avgPassRate: runs.length > 0
            ? runs.reduce((s, r) => s + (r.total_count > 0 ? r.pass_count / r.total_count : 0), 0) / runs.length
            : 0,
          avgRecall: runs.length > 0
            ? runs.reduce((s, r) => s + (r.avg_recall ?? 0), 0) / runs.length
            : 0,
          avgScore: runs.length > 0
            ? runs.reduce((s, r) => s + (r.avg_score ?? 0), 0) / runs.length
            : 0,
        },
        runs: runs.map((r) => ({
          runId: r.id,
          setId: r.set_id,
          model: r.model,
          status: r.status,
          passCount: r.pass_count,
          totalCount: r.total_count,
          passRate: r.total_count > 0 ? Number((r.pass_count / r.total_count * 100).toFixed(2)) : 0,
          avgRecall: r.avg_recall ?? 0,
          avgScore: r.avg_score ?? 0,
          createdAt: r.created_at,
        })),
      };
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `eval-report-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('评测报告已导出');
    } catch (error: unknown) {
      message.warning(`导出失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    loadSets();
  }, [loadSets]);

  const handleCreateSet = async () => {
    const values = await createForm.validateFields();
    const lines = values.cases
      ? String(values.cases)
          .split('\n')
          .map((l: string) => l.trim())
          .filter(Boolean)
      : [];

    if (lines.length === 0) {
      message.warning('请至少输入一个评测用例');
      return;
    }

    const cases: Array<{ query: string; gold_answer?: string }> = lines.map((line) => {
      const parts = line.split('|||');
      return {
        query: parts[0].trim(),
        gold_answer: parts[1]?.trim() || '',
      };
    });

    try {
      await apiCall<EvalSet>('/eval/sets', {
        method: 'POST',
        body: JSON.stringify({
          name: values.name,
          description: values.description,
          cases,
        }),
      });
      message.success(`评测集 "${values.name}" 创建成功，含 ${cases.length} 个用例`);
      setCreateModalOpen(false);
      createForm.resetFields();
      loadSets();
    } catch (error: unknown) {
      message.error(`创建失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleDeleteSet = async (id: string, name: string) => {
    try {
      await apiCall<void>(`/eval/sets/${id}`, { method: 'DELETE' });
      message.success(`评测集 "${name}" 已删除`);
      loadSets();
    } catch (error: unknown) {
      message.error(`删除失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleViewSet = async (id: string) => {
    try {
      const set = await apiCall<EvalSet>(`/eval/sets/${id}`);
      setSelectedSet(set);
    } catch (error: unknown) {
      message.error(`加载失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleRunEval = async (setId: string, setName: string) => {
    setRunLoading(setId);
    try {
      const run = await apiCall<EvalRun>(`/eval/sets/${setId}/run`, { method: 'POST' });
      message.success({
        content: (
          <div>
            <strong>评测已启动</strong>
            <br />
            <Text type="secondary">
              评测集: {setName} | Run ID: {run.id}
            </Text>
          </div>
        ),
        duration: 5,
      });
      loadSets();
    } catch (error: unknown) {
      message.error(`启动评测失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setRunLoading(null);
    }
  };

  const handleCompare = async () => {
    if (selectedRuns.length !== 2) {
      message.warning('请勾选两条评测运行记录进行对比');
      return;
    }
    try {
      await apiCall<{ run_a: EvalRun; run_b: EvalRun }>('/eval/compare', {
        method: 'POST',
        body: JSON.stringify({
          run_a_id: selectedRuns[0].id,
          run_b_id: selectedRuns[1].id,
        }),
      });
      message.success({
        content: (
          <div>
            <strong>对比分析完成</strong>
            <br />
            <Text type="secondary">
              {selectedRuns[0].model} vs {selectedRuns[1].model}
            </Text>
            <br />
            <Text>
              得分 A: {selectedRuns[0].avg_score?.toFixed(2)} | 得分 B:{' '}
              {selectedRuns[1].avg_score?.toFixed(2)}
            </Text>
          </div>
        ),
        duration: 8,
      });
      setSelectedRuns([]);
    } catch (error: unknown) {
      message.error(`对比失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const setColumns: ColumnsType<EvalSet> = useMemo(
    () => [
      {
        title: '评测集名称',
        dataIndex: 'name',
        key: 'name',
        render: (val: string, record: EvalSet) => (
          <Space>
            <Text strong>{val}</Text>
            {record.is_active && <Tag color="green">活跃</Tag>}
          </Space>
        ),
      },
      {
        title: '描述',
        dataIndex: 'description',
        key: 'description',
        ellipsis: true,
      },
      {
        title: '版本',
        dataIndex: 'version',
        key: 'version',
        render: (val: number) => <Tag>v{val}</Tag>,
        width: 60,
      },
      {
        title: '用例数',
        key: 'cases',
        render: (_, record: EvalSet) => record.cases?.length ?? 0,
        width: 80,
      },
      {
        title: '创建人',
        dataIndex: 'created_by',
        key: 'created_by',
        width: 100,
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        key: 'created_at',
        width: 160,
      },
      {
        title: '操作',
        key: 'actions',
        width: 220,
        render: (_, record: EvalSet) => (
          <Space size="small">
            <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewSet(record.id)}>
              查看
            </Button>
            <Button
              size="small"
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={runLoading === record.id}
              onClick={() => handleRunEval(record.id, record.name)}
            >
              运行
            </Button>
            <Popconfirm
              title="确定删除此评测集？"
              onConfirm={() => handleDeleteSet(record.id, record.name)}
              okText="确定"
              cancelText="取消"
            >
              <Button size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [runLoading]
  );

  const runColumns: ColumnsType<EvalRun> = useMemo(
    () => [
      {
        title: 'Run ID',
        dataIndex: 'id',
        key: 'id',
        render: (val: string) => (
          <Text code style={{ fontSize: 11 }}>
            {val.slice(0, 8)}...
          </Text>
        ),
        width: 100,
      },
      {
        title: '评测集',
        dataIndex: 'set_id',
        key: 'set_id',
        render: (val: string) => (
          <Text code style={{ fontSize: 11 }}>
            {val.slice(0, 8)}
          </Text>
        ),
        width: 100,
      },
      {
        title: '模型',
        dataIndex: 'model',
        key: 'model',
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 80,
        render: (val: string) => (
          <Tag color={statusColor[val] || 'default'}>{statusLabel[val] || val}</Tag>
        ),
      },
      {
        title: '通过率',
        key: 'pass_rate',
        width: 100,
        render: (_, record: EvalRun) => {
          const rate = record.total_count > 0 ? (record.pass_count / record.total_count) * 100 : 0;
          return <Text>{rate.toFixed(1)}%</Text>;
        },
      },
      {
        title: '平均 Recall',
        dataIndex: 'avg_recall',
        key: 'avg_recall',
        width: 100,
        render: (val: number) => (val !== undefined ? val.toFixed(3) : '-'),
      },
      {
        title: '平均 Score',
        dataIndex: 'avg_score',
        key: 'avg_score',
        width: 100,
        render: (val: number) => (val !== undefined ? val.toFixed(3) : '-'),
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        key: 'created_at',
        width: 160,
      },
    ],
    []
  );

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <ThunderboltOutlined style={{ marginRight: spacing.sm, color: colors.purple[500] }} />
        评测集管理
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
        管理 RAG 评测集及评测用例，支持创建/查看/删除/运行/对比。用例格式: query ||| gold_answer
      </Text>

      <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="评测集总数" value={sets.length} prefix={<FormOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="评测用例总数"
              value={sets.reduce((sum, s) => sum + (s.cases?.length || 0), 0)}
              prefix={<EyeOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="评测运行数" value={runs.length} prefix={<PlayCircleOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="最近通过率"
              value={
                runs[0]?.total_count
                  ? `${((runs[0].pass_count / runs[0].total_count) * 100).toFixed(1)}%`
                  : '-'
              }
              valueStyle={{
                color: runs[0]?.pass_count > 0 ? colors.success[500] : colors.neutral[500],
              }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="评测集列表"
        extra={
          <Space>
            {sets.length === 0 && (
              <Button
                icon={<RocketOutlined />}
                loading={seeding}
                onClick={handleSeed}
              >
                初始化演示数据
              </Button>
            )}
            <Button icon={<ReloadOutlined />} onClick={loadSets}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
              新建评测集
            </Button>
          </Space>
        }
        style={{ marginBottom: spacing.md }}
      >
        <Table
          dataSource={sets}
          columns={setColumns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={false}
          locale={{ emptyText: <Empty description="暂无评测集，点击「新建评测集」创建" /> }}
        />
      </Card>

      <Card
        title="评测运行记录"
        extra={
          <Space>
            <Button
              icon={<ExportOutlined />}
              loading={exporting}
              onClick={handleExportReport}
              disabled={runs.length === 0}
            >
              导出报告
            </Button>
            <Button
              icon={<SwapOutlined />}
              onClick={handleCompare}
              disabled={selectedRuns.length !== 2}
            >
              对比分析
            </Button>
          </Space>
        }
      >
        <Table
          dataSource={runs}
          columns={runColumns}
          rowKey="id"
          rowSelection={{
            type: 'checkbox',
            selectedRowKeys: selectedRuns.map((r) => r.id),
            onChange: (keys: React.Key[]) => {
              setSelectedRuns(runs.filter((r) => keys.includes(r.id)).slice(0, 2));
            },
          }}
          loading={loading}
          size="small"
          pagination={false}
          locale={{ emptyText: <Empty description="暂无评测运行记录" /> }}
        />
      </Card>

      {/* Create EvalSet Modal */}
      <Modal
        title="新建评测集"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          createForm.resetFields();
        }}
        onOk={handleCreateSet}
        okText="创建"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            label="评测集名称"
            name="name"
            rules={[{ required: true, message: '请输入评测集名称' }]}
          >
            <Input placeholder="例: RAG 检索质量评测 v2" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={2} placeholder="评测目的说明" />
          </Form.Item>
          <Form.Item
            label="评测用例"
            name="cases"
            rules={[{ required: true, message: '请至少输入一个评测用例' }]}
          >
            <TextArea
              rows={8}
              placeholder={
                '每行一个用例，格式: query ||| gold_answer\n' +
                '例:\nOrion Pipeline 是什么？ ||| Orion Pipeline 是基于 Tekton 的 CI/CD 流水线引擎\n' +
                '如何创建变更请求？ ||| 在变更管理页面点击「新建」按钮即可'
              }
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* View Detail Modal */}
      {selectedSet && (
        <Modal
          title={`评测集详情: ${selectedSet.name}`}
          open={!!selectedSet}
          onCancel={() => setSelectedSet(null)}
          footer={[
            <Button key="close" onClick={() => setSelectedSet(null)}>
              关闭
            </Button>,
            <Button
              key="run"
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={runLoading === selectedSet.id}
              onClick={() => handleRunEval(selectedSet.id, selectedSet.name)}
            >
              运行评测
            </Button>,
          ]}
          width={700}
        >
          <Descriptions column={2} bordered size="small" style={{ marginBottom: spacing.md }}>
            <Descriptions.Item label="名称">{selectedSet.name}</Descriptions.Item>
            <Descriptions.Item label="版本">v{selectedSet.version}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={selectedSet.is_active ? 'green' : 'default'}>
                {selectedSet.is_active ? '活跃' : '非活跃'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="用例数">{selectedSet.cases?.length || 0}</Descriptions.Item>
          </Descriptions>
          {selectedSet.cases && selectedSet.cases.length > 0 ? (
            <>
              <Text strong>评测用例</Text>
              <Divider />
              <div style={{ maxHeight: 400, overflow: 'auto' }}>
                {selectedSet.cases.map((c, idx) => (
                  <div
                    key={c.id}
                    style={{
                      marginBottom: spacing.sm,
                      display: 'flex',
                      gap: spacing.sm,
                      padding: spacing.sm,
                      background: colors.light.bg.secondary,
                      borderRadius: 4,
                    }}
                  >
                    <Text type="secondary" style={{ flexShrink: 0 }}>
                      #{idx + 1}
                    </Text>
                    <div style={{ flex: 1 }}>
                      <div>
                        <Text strong>Q:</Text> {c.query}
                      </div>
                      {c.gold_answer && (
                        <div>
                          <Text strong>A:</Text> {c.gold_answer}
                        </div>
                      )}
                      {c.gold_sources && (
                        <div>
                          <Text strong type="secondary">
                            来源:
                          </Text>{' '}
                          {c.gold_sources}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <Empty description="暂无评测用例" />
          )}
        </Modal>
      )}
    </div>
  );
};

export default EvalSetManagement;
