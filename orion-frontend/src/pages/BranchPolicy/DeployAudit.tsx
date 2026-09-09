import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Drawer,
  Empty,
  Input,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Steps,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  AuditOutlined,
  HistoryOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { spacing } from '@/tokens';
import PageSkeleton from '@/components/PageSkeleton';
import {
  getAuditTrail,
  getDeployEvents,
  rollbackDeployEvent,
  type AuditTrailResult,
  type DeployEvent,
  type DeployOutcome,
  type EnvName,
} from '@/api/branch-policy';

const { Title, Text } = Typography;

const ENV_ORDER: EnvName[] = ['dev', 'staging', 'prod'];
const ENV_LABELS: Record<EnvName, string> = { dev: '开发', staging: '预发', prod: '生产' };
const OUTCOME_COLORS: Record<DeployOutcome, string> = {
  success: 'green',
  'rolled-back': 'orange',
  failed: 'red',
};
const OUTCOME_LABELS: Record<DeployOutcome, string> = {
  success: '成功',
  'rolled-back': '已回滚',
  failed: '失败',
};

const ENV_COLORS: Record<string, string> = { dev: 'green', staging: 'orange', prod: 'red' };

export default function DeployAudit() {
  const [events, setEvents] = useState<DeployEvent[]>([]);
  const [auditTrail, setAuditTrail] = useState<AuditTrailResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const [detail, setDetail] = useState<DeployEvent | null>(null);

  // filters
  const [filterBranch, setFilterBranch] = useState<string | undefined>();
  const [filterEnv, setFilterEnv] = useState<EnvName | undefined>();
  const [filterActor, setFilterActor] = useState<string>('');
  const [filterOutcome, setFilterOutcome] = useState<DeployOutcome | undefined>();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [eventsRes, trailRes] = await Promise.all([
        getDeployEvents({ limit: 200 }),
        getAuditTrail({ limit: 200 }),
      ]);
      setEvents((eventsRes.data ?? []) as unknown as DeployEvent[]);
      setAuditTrail(trailRes.data as unknown as AuditTrailResult);
    } catch (err) {
      message.error(`加载变更审计失败：${(err as Error).message ?? err}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const branchOptions = useMemo(
    () => Array.from(new Set(events.map((e) => e.branch))).sort(),
    [events],
  );

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (filterBranch && e.branch !== filterBranch) return false;
      if (filterEnv && e.env !== filterEnv) return false;
      if (filterOutcome && e.outcome !== filterOutcome) return false;
      if (filterActor && !(e.actorId.includes(filterActor) || e.actorName.includes(filterActor)))
        return false;
      return true;
    });
  }, [events, filterBranch, filterEnv, filterActor, filterOutcome]);

  const stats = useMemo(() => {
    const success = events.filter((e) => e.outcome === 'success').length;
    const rolledBack = events.filter((e) => e.outcome === 'rolled-back').length;
    const failed = events.filter((e) => e.outcome === 'failed').length;
    return { total: events.length, success, rolledBack, failed };
  }, [events]);

  const handleRollback = async (evt: DeployEvent) => {
    setRollingBack(evt.id);
    try {
      const res = await rollbackDeployEvent(evt.id);
      const newEvent = res.data as unknown as DeployEvent;
      message.success(
        newEvent?.id
          ? `回滚已发起，生成新事件 ${newEvent.id.slice(0, 8)}`
          : '回滚已发起',
      );
      setDetail(null);
      void fetchAll();
    } catch (err) {
      message.error(`回滚失败：${(err as Error).message ?? err}`);
    } finally {
      setRollingBack(null);
    }
  };

  const openDetail = (evt: DeployEvent) => {
    setDetail(evt);
  };

  const columns = useMemo(
    () => [
      {
        title: '部署时间',
        dataIndex: 'startedAt',
        key: 'startedAt',
        width: 170,
        render: (v: string) => new Date(v).toLocaleString(),
      },
      {
        title: '分支',
        dataIndex: 'branch',
        key: 'branch',
        width: 140,
        render: (v: string) => <Tag color="blue">{v}</Tag>,
      },
      {
        title: '环境',
        dataIndex: 'env',
        key: 'env',
        width: 90,
        render: (v: EnvName) => <Tag color={ENV_COLORS[v]}>{ENV_LABELS[v] ?? v}</Tag>,
      },
      {
        title: '操作人',
        dataIndex: 'actorName',
        key: 'actorName',
        width: 120,
        render: (v: string, row: DeployEvent) => (
          <Space direction="vertical" size={0}>
            <Text>{v || '-'}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {row.actorId.slice(0, 8)}
            </Text>
          </Space>
        ),
      },
      {
        title: '提交变更',
        key: 'commit',
        width: 170,
        render: (_: unknown, row: DeployEvent) => (
          <Space size={4}>
            <Text code>{row.fromCommit ? row.fromCommit.slice(0, 7) : '-'}</Text>
            <Text type="secondary">→</Text>
            <Text code>{row.toCommit.slice(0, 7)}</Text>
          </Space>
        ),
      },
      {
        title: '制品',
        dataIndex: 'artifactId',
        key: 'artifactId',
        width: 110,
        render: (v: string) => (v ? <Text code>{v.slice(0, 8)}</Text> : '-'),
      },
      {
        title: '变更单',
        dataIndex: 'approvalId',
        key: 'approvalId',
        width: 120,
        render: (v: string) => (v ? <Tag color="purple">{v}</Tag> : '-'),
      },
      {
        title: '结果',
        dataIndex: 'outcome',
        key: 'outcome',
        width: 100,
        render: (v: DeployOutcome) => (
          <Tag color={OUTCOME_COLORS[v]}>{OUTCOME_LABELS[v] ?? v}</Tag>
        ),
      },
      {
        title: '操作',
        key: 'action',
        width: 90,
        fixed: 'right' as const,
        render: (_: unknown, row: DeployEvent) => (
          <Button type="link" size="small" onClick={() => openDetail(row)}>
            详情
          </Button>
        ),
      },
    ],
    [],
  );

  const renderTrailChain = () => {
    if (!detail) return null;
    const { env, branch, artifactId, approvalId } = detail;
    const steps = [
      { title: '环境', desc: ENV_LABELS[env as EnvName] ?? env, color: 'blue' },
      { title: '分支', desc: branch, color: 'green' },
      { title: '制品', desc: artifactId ? artifactId.slice(0, 12) : '未关联', color: 'purple' },
      { title: '变更单', desc: approvalId ?? '未关联', color: 'orange' },
    ];
    return (
      <Steps
        direction="vertical"
        size="small"
        current={steps.length}
        items={steps.map((s) => ({
          title: (
            <Text>
              {s.title}
              <Text type="secondary"> · </Text>
              <Tag color={s.color}>{s.desc}</Tag>
            </Text>
          ),
        }))}
      />
    );
  };

  const renderDetail = () => {
    if (!detail) return null;
    const e = detail;
    const infoItems: Array<{ label: string; value: React.ReactNode }> = [
      {
        label: '开始时间',
        value: new Date(e.startedAt).toLocaleString(),
      },
      {
        label: '完成时间',
        value: e.completedAt ? new Date(e.completedAt).toLocaleString() : '进行中',
      },
      {
        label: '耗时',
        value: `${(e.durationMs / 1000).toFixed(1)}s`,
      },
      {
        label: '错误率',
        value: `${(e.errorRate * 100).toFixed(2)}%`,
      },
      {
        label: 'P99 延迟',
        value: `${e.p99Latency.toFixed(1)}ms`,
      },
      {
        label: '镜像摘要',
        value: e.imageDigest ? <Text code>{e.imageDigest.slice(0, 16)}</Text> : '未记录',
      },
    ];
    return (
      <>
        <Card title="部署事件详情" size="small" style={{ marginBottom: spacing.md }}>
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Tag color="blue">{e.branch}</Tag>
              <Tag color={ENV_COLORS[e.env]}>{ENV_LABELS[e.env as EnvName] ?? e.env}</Tag>
              <Tag color={OUTCOME_COLORS[e.outcome]}>{OUTCOME_LABELS[e.outcome] ?? e.outcome}</Tag>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {infoItems.map((it) => (
                <div key={it.label}>
                  <Text type="secondary">{it.label}</Text>
                  <div>
                    <Text strong>{it.value}</Text>
                  </div>
                </div>
              ))}
            </div>
          </Space>
        </Card>

        <Card title="Gate 结果" size="small" style={{ marginBottom: spacing.md }}>
          {e.gateResult ? (
            <Alert
              type={e.outcome === 'success' ? 'success' : e.outcome === 'failed' ? 'error' : 'warning'}
              showIcon
              icon={<SafetyCertificateOutlined />}
              message="预发布门禁"
              description={<Text style={{ fontSize: 13 }}>{e.gateResult}</Text>}
            />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无 Gate 结果记录" />
          )}
        </Card>

        <Card title="追溯视图" size="small" style={{ marginBottom: spacing.md }}>
          {renderTrailChain()}
        </Card>

        {e.errorMsg && (
          <Alert
            type="error"
            showIcon
            message="错误信息"
            description={<Text style={{ fontSize: 13 }}>{e.errorMsg}</Text>}
            style={{ marginBottom: spacing.md }}
          />
        )}

        <Card size="small">
          <Popconfirm
            title="确认回滚该次部署？"
            description={`将 ${e.branch} 在 ${ENV_LABELS[e.env as EnvName] ?? e.env} 环境回滚到上一个版本，并记录新的回滚事件`}
            okText="发起回滚"
            okButtonProps={{ danger: true }}
            cancelText="取消"
            disabled={e.outcome === 'failed'}
            onConfirm={() => void handleRollback(e)}
          >
            <Button
              danger
              icon={<RollbackOutlined />}
              loading={rollingBack === e.id}
              disabled={e.outcome === 'failed'}
            >
              一键回滚
            </Button>
          </Popconfirm>
          <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
            已失败的事件不再回滚；回滚会创建一个 outcome=rolled-back 的新事件
          </Text>
        </Card>
      </>
    );
  };

  if (loading && events.length === 0) {
    return <PageSkeleton rows={12} />;
  }

  return (
    <div>
      <Title level={2} style={{ marginBottom: 8 }}>
        <AuditOutlined style={{ marginRight: 12, color: '#3370E6' }} />
        变更审计
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
        部署变更全程审计追踪：环境 → 分支 → 制品 → 变更单，支持一键回滚
      </Text>

      <Row gutter={[16, 16]} style={{ marginBottom: spacing.md }}>
        <StatCard title="部署总次数" value={stats.total} />
        <StatCard title="成功" value={stats.success} color="#52c41a" />
        <StatCard title="已回滚" value={stats.rolledBack} color="#faad14" />
        <StatCard title="失败" value={stats.failed} color="#f5222d" />
      </Row>

      <Card>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: spacing.md,
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <Space size={8} wrap>
            <Select
              allowClear
              placeholder="分支"
              style={{ width: 160 }}
              options={branchOptions.map((b) => ({ label: b, value: b }))}
              value={filterBranch}
              onChange={(v) => setFilterBranch(v)}
            />
            <Select
              allowClear
              placeholder="环境"
              style={{ width: 120 }}
              options={ENV_ORDER.map((e) => ({ label: ENV_LABELS[e], value: e }))}
              value={filterEnv}
              onChange={(v) => setFilterEnv(v)}
            />
            <Select
              allowClear
              placeholder="结果"
              style={{ width: 120 }}
              options={(Object.keys(OUTCOME_LABELS) as DeployOutcome[]).map((o) => ({
                label: OUTCOME_LABELS[o],
                value: o,
              }))}
              value={filterOutcome}
              onChange={(v) => setFilterOutcome(v)}
            />
            <Input
              allowClear
              placeholder="按操作人搜索"
              style={{ width: 160 }}
              value={filterActor}
              onChange={(e) => setFilterActor(e.target.value)}
            />
          </Space>
          <Button icon={<ReloadOutlined />} onClick={() => void fetchAll()}>
            刷新
          </Button>
        </div>

        {filtered.length === 0 ? (
          <Empty description="暂无部署事件" />
        ) : (
          <Table
            rowKey="id"
            columns={columns}
            dataSource={filtered}
            pagination={{ pageSize: 20, showSizeChanger: false }}
            scroll={{ x: 1100 }}
          />
        )}
      </Card>

      <Card title="审计追踪" size="small" style={{ marginTop: spacing.md }}>
        {auditTrail ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <div style={{ display: 'flex', gap: 24 }}>
              <Statistic title="涉及分支" value={auditTrail.branches.length} />
              <Statistic title="涉及环境" value={auditTrail.envs.length} />
              <Statistic title="制品数" value={auditTrail.artifactIds.length} />
              <Statistic title="变更单数" value={auditTrail.approvalIds.length} />
            </div>
            <Space wrap>
              <Text type="secondary">环境：</Text>
              {auditTrail.envs.map((v) => (
                <Tag key={v} color={ENV_COLORS[v]}>
                  {ENV_LABELS[v as EnvName] ?? v}
                </Tag>
              ))}
              <Text type="secondary">分支：</Text>
              {auditTrail.branches.map((v) => (
                <Tag key={v} color="blue">
                  {v}
                </Tag>
              ))}
              <Text type="secondary">变更单：</Text>
              {auditTrail.approvalIds.map((v) => (
                <Tag key={v} color="purple">
                  {v}
                </Tag>
              ))}
            </Space>
            <Text type="secondary" style={{ fontSize: 12 }}>
              生成时间：{new Date(auditTrail.generatedAt).toLocaleString()}
            </Text>
          </Space>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无审计数据" />
        )}
      </Card>

      <Drawer
        title={`部署详情 · ${detail?.branch ?? ''}`}
        width={560}
        open={!!detail}
        onClose={() => setDetail(null)}
      >
        {renderDetail()}
      </Drawer>
    </div>
  );
}

function StatCard({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color?: string;
}) {
  return (
    <div style={{ flex: 1, minWidth: 160 }}>
      <Card>
        <Statistic title={title} value={value} valueStyle={color ? { color } : undefined} />
      </Card>
    </div>
  );
}
