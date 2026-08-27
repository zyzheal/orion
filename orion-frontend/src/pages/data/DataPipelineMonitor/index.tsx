/**
 * Data Pipeline Health Monitor (P3-17)
 * 数据管道健康度监控 — 管道状态 / SLA / 延迟告警 / 数据新鲜度
 *
 * Features:
 * - 统计卡片（总数 / 运行中 / 异常 / 平均延迟）
 * - 管道列表 Table（筛选 + 操作）
 * - SVG 管道拓扑图（DAG）
 * - 告警记录列表
 */

import React, { useState, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Table,
  Tag,
  Statistic,
  Select,
  Space,
  Button,
  Switch,
  Tooltip,
  Divider,
  Empty,
} from 'antd';
import {
  BranchesOutlined,
  PlayCircleOutlined,
  EyeOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
  DatabaseOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import { colors, spacing, themeVars } from '@/tokens';

const { Title, Text } = Typography;
const { Option } = Select;

// ==================== Types ====================

interface Pipeline {
  id: string;
  name: string;
  source: string;
  target: string;
  frequency: 'realtime' | 'hourly' | 'daily';
  status: 'running' | 'error' | 'paused' | 'maintenance';
  lastRun: string;
  latency: number;
  successRate: number;
  isPaused: boolean;
}

interface AlertRecord {
  id: string;
  pipelineName: string;
  alertType: 'delay' | 'missing' | 'quality' | 'interrupted';
  message: string;
  time: string;
  status: 'active' | 'resolved' | 'acknowledged';
}

interface TopologyNode {
  id: string;
  label: string;
  type: 'source' | 'transform' | 'target';
  status: 'running' | 'error' | 'idle';
}

interface TopologyEdge {
  source: string;
  target: string;
}

// ==================== Mock Data ====================

const MOCK_PIPELINES: Pipeline[] = [];

const MOCK_ALERTS: AlertRecord[] = [];

const MOCK_TOPOLOGY_NODES: TopologyNode[] = [];

const MOCK_TOPOLOGY_EDGES: TopologyEdge[] = [];

// ==================== Config ====================

const FREQUENCY_CONFIG: Record<string, { color: string; label: string }> = {
  realtime: { color: colors.success[500], label: '实时' },
  hourly: { color: colors.info[500], label: '每小时' },
  daily: { color: colors.warning[500], label: '每天' },
};

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  running: { color: colors.success[500], label: '运行中' },
  error: { color: colors.error[500], label: '异常' },
  paused: { color: colors.neutral[400], label: '已暂停' },
  maintenance: { color: colors.info[500], label: '维护中' },
};

const ALERT_TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  delay: { color: colors.warning[500], label: '延迟超标' },
  missing: { color: colors.error[500], label: '数据缺失' },
  quality: { color: colors.purple[500], label: '质量不达标' },
  interrupted: { color: colors.error[500], label: '管道中断' },
};

const ALERT_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  active: { color: colors.error[500], label: '活跃' },
  resolved: { color: colors.success[500], label: '已解决' },
  acknowledged: { color: colors.warning[500], label: '已确认' },
};

const NODE_STATUS_COLOR: Record<string, string> = {
  running: colors.success[500],
  error: colors.error[500],
  idle: colors.neutral[400],
};

// ==================== Main Component ====================

const DataPipelineMonitor: React.FC = () => {
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterFrequency, setFilterFrequency] = useState<string | null>(null);
  const pipelines = MOCK_PIPELINES;

  const stats = useMemo(() => {
    const total = pipelines.length;
    const running = pipelines.filter((p) => p.status === 'running').length;
    const error = pipelines.filter((p) => p.status === 'error').length;
    const avgLatency =
      pipelines.filter((p) => p.latency > 0).reduce((s, p) => s + p.latency, 0) /
      Math.max(pipelines.filter((p) => p.latency > 0).length, 1);
    return { total, running, error, avgLatency: avgLatency.toFixed(1) };
  }, [pipelines]);

  const filteredPipelines = useMemo(() => {
    return pipelines.filter((p) => {
      if (filterStatus && p.status !== filterStatus) return false;
      if (filterFrequency && p.frequency !== filterFrequency) return false;
      return true;
    });
  }, [pipelines, filterStatus, filterFrequency]);

  const tableColumns = [
    {
      title: '管道名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (text: string) => (
        <Text strong style={{ fontSize: 13 }}>
          {text}
        </Text>
      ),
    },
    {
      title: '源 → 目标',
      key: 'sourceTarget',
      width: 220,
      render: (_: any, record: Pipeline) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 12, color: colors.neutral[500] }}>源：{record.source}</Text>
          <Text style={{ fontSize: 12, color: colors.neutral[500] }}>目标：{record.target}</Text>
        </Space>
      ),
    },
    {
      title: '频率',
      dataIndex: 'frequency',
      key: 'frequency',
      width: 80,
      render: (freq: string) => (
        <Tag color={FREQUENCY_CONFIG[freq]?.color || colors.neutral[400]}>
          {FREQUENCY_CONFIG[freq]?.label || freq}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (st: string) => (
        <Tag color={STATUS_CONFIG[st]?.color || colors.neutral[400]}>
          {STATUS_CONFIG[st]?.label || st}
        </Tag>
      ),
    },
    {
      title: '最近运行',
      dataIndex: 'lastRun',
      key: 'lastRun',
      width: 150,
      render: (t: string) => <Text style={{ fontSize: 12 }}>{t}</Text>,
    },
    {
      title: '延迟(分)',
      dataIndex: 'latency',
      key: 'latency',
      width: 80,
      render: (val: number) => {
        if (val === 0) return <Text type="secondary">—</Text>;
        const color =
          val > 30 ? colors.error[500] : val > 10 ? colors.warning[500] : colors.success[500];
        return <Text style={{ color, fontWeight: 500 }}>{val}</Text>;
      },
    },
    {
      title: '成功率(%)',
      dataIndex: 'successRate',
      key: 'successRate',
      width: 90,
      render: (val: number) => {
        if (val === 0) return <Text type="secondary">—</Text>;
        const color =
          val >= 99 ? colors.success[500] : val >= 90 ? colors.warning[500] : colors.error[500];
        return <Text style={{ color, fontWeight: 500 }}>{val.toFixed(1)}%</Text>;
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 240,
      render: (_: any, record: Pipeline) => (
        <Space size="small" wrap>
          <Tooltip title="详情查看功能开发中">
            <Button size="small" type="link" icon={<EyeOutlined />} disabled>
              详情
            </Button>
          </Tooltip>
          <Tooltip title="手动触发功能开发中">
            <Button size="small" type="link" icon={<SyncOutlined />} disabled>
              触发
            </Button>
          </Tooltip>
          <Tooltip title="暂停/恢复功能开发中">
            <Switch
              size="small"
              checked={record.isPaused}
              checkedChildren="暂停"
              unCheckedChildren="运行"
              disabled
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // SVG Topology layout
  const nodePositions: Record<string, [number, number]> = {
    s1: [40, 30],
    s2: [40, 150],
    s3: [40, 270],
    s4: [40, 390],
    t1: [250, 90],
    t2: [250, 210],
    t3: [250, 390],
    o1: [460, 60],
    o2: [460, 160],
    o3: [460, 290],
    o4: [460, 390],
  };

  return (
    <div style={{ padding: spacing.lg }}>
      {/* Header */}
      <Row style={{ marginBottom: spacing.md }}>
        <Col>
          <Title level={2} style={{ marginBottom: 8 }}>
            <BranchesOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            数据管道健康度监控
          </Title>
          <Text type="secondary">管道状态 · SLA 监控 · 延迟告警 · 数据新鲜度</Text>
        </Col>
      </Row>

      {/* Stats Cards */}
      <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总管道数"
              value={stats.total}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: colors.primary[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="运行中"
              value={stats.running}
              prefix={<PlayCircleOutlined />}
              valueStyle={{ color: colors.success[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="异常/失败"
              value={stats.error}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: colors.error[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均延迟 (分钟)"
              value={stats.avgLatency}
              prefix={<SyncOutlined />}
              valueStyle={{ color: colors.warning[500] }}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Content */}
      <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
        {/* Pipeline List */}
        <Col span={14}>
          <Card title="管道列表">
            <Space size="small" style={{ marginBottom: spacing.sm }}>
              <FilterOutlined style={{ color: colors.neutral[500] }} />
              <Select
                style={{ width: 110 }}
                placeholder="状态筛选"
                value={filterStatus || undefined}
                onChange={(v) => setFilterStatus(v || null)}
                allowClear
              >
                <Option value="running">运行中</Option>
                <Option value="error">异常</Option>
                <Option value="paused">已暂停</Option>
                <Option value="maintenance">维护中</Option>
              </Select>
              <Select
                style={{ width: 110 }}
                placeholder="频率筛选"
                value={filterFrequency || undefined}
                onChange={(v) => setFilterFrequency(v || null)}
                allowClear
              >
                <Option value="realtime">实时</Option>
                <Option value="hourly">每小时</Option>
                <Option value="daily">每天</Option>
              </Select>
            </Space>
            <Table
              columns={tableColumns}
              dataSource={filteredPipelines}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 8, showSizeChanger: false }}
              scroll={{ x: 900 }}
              locale={{ emptyText: <Empty description="暂无数据管道" /> }}
            />
          </Card>
        </Col>

        {/* Pipeline Topology */}
        <Col span={10}>
          <Card title="管道拓扑图">
            <div
              style={{
                width: '100%',
                height: 460,
                position: 'relative',
                background: themeVars.bgSecondary,
                borderRadius: spacing.sm,
                overflow: 'hidden',
              }}
            >
              <svg
                width="100%"
                height="100%"
                style={{ position: 'absolute', top: 0, left: 0 }}
                viewBox="0 0 560 460"
                preserveAspectRatio="xMidYMid meet"
              >
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="8"
                    markerHeight="6"
                    refX="8"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill={colors.neutral[400]} />
                  </marker>
                </defs>
                {MOCK_TOPOLOGY_EDGES.map((edge, i) => {
                  const srcPos = nodePositions[edge.source];
                  const tgtPos = nodePositions[edge.target];
                  if (!srcPos || !tgtPos) return null;
                  return (
                    <line
                      key={String(i)}
                      x1={srcPos[0] + 80}
                      y1={srcPos[1] + 25}
                      x2={tgtPos[0]}
                      y2={tgtPos[1] + 25}
                      stroke={colors.neutral[400]}
                      strokeWidth="1.5"
                      markerEnd="url(#arrowhead)"
                      opacity="0.5"
                    />
                  );
                })}
              </svg>
              {MOCK_TOPOLOGY_NODES.map((node) => {
                const pos = nodePositions[node.id];
                if (!pos) return null;
                const color = NODE_STATUS_COLOR[node.status] || colors.neutral[400];
                const border =
                  node.type === 'source'
                    ? '3px solid'
                    : node.type === 'transform'
                      ? '2px dashed'
                      : '3px solid';
                const bgColor = color + '18';
                return (
                  <div
                    key={node.id}
                    style={{
                      position: 'absolute',
                      left: pos[0],
                      top: pos[1],
                      width: 78,
                      height: 50,
                      backgroundColor: bgColor,
                      border: `${border} ${color}`,
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      lineHeight: 1.3,
                      color: colors.neutral[700],
                      textAlign: 'center',
                      boxShadow:
                        node.status === 'error'
                          ? `0 0 12px ${colors.error[500]}66`
                          : node.status === 'running'
                            ? `0 0 8px ${colors.success[500]}44`
                            : 'none',
                    }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: 500 }}>{node.label}</Text>
                  </div>
                );
              })}
              {/* Legend */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 8,
                  left: 8,
                  right: 8,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Space size="small">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 3,
                        backgroundColor: colors.success[500],
                        display: 'inline-block',
                      }}
                    />
                    <Text type="secondary" style={{ fontSize: 10 }}>
                      运行中
                    </Text>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 3,
                        backgroundColor: colors.error[500],
                        display: 'inline-block',
                      }}
                    />
                    <Text type="secondary" style={{ fontSize: 10 }}>
                      异常
                    </Text>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 3,
                        backgroundColor: colors.neutral[400],
                        display: 'inline-block',
                      }}
                    />
                    <Text type="secondary" style={{ fontSize: 10 }}>
                      空闲
                    </Text>
                  </span>
                </Space>
                <Space size="small">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 3,
                        backgroundColor: 'transparent',
                        border: `3px solid ${colors.neutral[500]}`,
                        display: 'inline-block',
                      }}
                    />
                    <Text type="secondary" style={{ fontSize: 10 }}>
                      源
                    </Text>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 3,
                        backgroundColor: 'transparent',
                        border: `2px dashed ${colors.neutral[500]}`,
                        display: 'inline-block',
                      }}
                    />
                    <Text type="secondary" style={{ fontSize: 10 }}>
                      转换
                    </Text>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 3,
                        backgroundColor: colors.neutral[100],
                        border: `3px solid ${colors.neutral[500]}`,
                        display: 'inline-block',
                      }}
                    />
                    <Text type="secondary" style={{ fontSize: 10 }}>
                      目标
                    </Text>
                  </span>
                </Space>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Alert Records */}
      <Card title="最近告警记录">
        <Table
          dataSource={MOCK_ALERTS}
          rowKey="id"
          size="small"
          pagination={false}
          locale={{ emptyText: <Empty description="暂无告警记录" /> }}
          columns={[
            {
              title: '管道名',
              dataIndex: 'pipelineName',
              key: 'pipelineName',
              width: 160,
              render: (text: string) => (
                <Text strong style={{ fontSize: 12 }}>
                  {text}
                </Text>
              ),
            },
            {
              title: '告警类型',
              dataIndex: 'alertType',
              key: 'alertType',
              width: 120,
              render: (t: string) => (
                <Tag color={ALERT_TYPE_CONFIG[t]?.color || colors.neutral[400]}>
                  {ALERT_TYPE_CONFIG[t]?.label || t}
                </Tag>
              ),
            },
            {
              title: '描述',
              dataIndex: 'message',
              key: 'message',
              render: (text: string) => <Text style={{ fontSize: 12 }}>{text}</Text>,
            },
            {
              title: '时间',
              dataIndex: 'time',
              key: 'time',
              width: 160,
              render: (t: string) => (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t}
                </Text>
              ),
            },
            {
              title: '状态',
              dataIndex: 'status',
              key: 'status',
              width: 80,
              render: (st: string) => (
                <Tag color={ALERT_STATUS_CONFIG[st]?.color || colors.neutral[400]}>
                  {ALERT_STATUS_CONFIG[st]?.label || st}
                </Tag>
              ),
            },
          ]}
        />
        <Divider style={{ margin: `${spacing.sm} 0` }} />
        <Space size="small">
          <Tooltip title="告警规则配置功能开发中">
            <Button size="small" type="primary" ghost disabled>
              告警规则配置
            </Button>
          </Tooltip>
          <Tooltip title="SLA 达标率报告功能开发中">
            <Button size="small" type="primary" ghost disabled>
              SLA 达标率报告
            </Button>
          </Tooltip>
        </Space>
      </Card>
    </div>
  );
};

export default DataPipelineMonitor;
