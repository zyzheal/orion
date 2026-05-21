/**
 * PipelineMonitor - 运行监控面板
 * 展示 Pipeline 运行统计、失败分析、趋势图表、性能指标
 */
import React, { useState, useEffect } from 'react';
import { Space, Select, Button, Empty, message, Statistic, Row, Col, Table } from 'antd';
import { colors, spacing } from '@/tokens';
import { ReloadOutlined, DashboardOutlined, ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import CardPanel from '@/components/CardPanel';
import { getRunStats, type RunStats } from './api';
import { getAllPipelineRuns, type PipelineRunSummary } from '@/api/pipelineRuns';
import dayjs from 'dayjs';

const PipelineMonitor: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<RunStats | null>(null);
  const [days, setDays] = useState(7);
  const [failedRuns, setFailedRuns] = useState<PipelineRunSummary[]>([]);
  const [recentRuns, setRecentRuns] = useState<PipelineRunSummary[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 尝试从 API 获取统计数据
      try {
        const statsRes = await getRunStats({ days });
        if (statsRes.data && statsRes.data.totalRuns !== undefined) {
          setStats(statsRes.data);
        }
      } catch {
        // API 不存在，使用 fallback 逻辑
      }

      // 使用 getAllPipelineRuns 聚合数据
      const endDate = dayjs();
      const startDate = endDate.subtract(days, 'day');

      const runsRes = await getAllPipelineRuns({
        limit: 500,
      });

      const apiData = runsRes.data;
      const runs = Array.isArray(apiData.data) ? apiData.data : [];
      // 按日期过滤
      const filteredRuns = runs.filter((run: PipelineRunSummary) => {
        if (!run.createdAt) return false;
        const runDate = dayjs(run.createdAt);
        return runDate.isAfter(startDate) && runDate.isBefore(endDate.add(1, 'day'));
      });

      // 计算统计数据
      const totalRuns = filteredRuns.length;
      const successRuns = filteredRuns.filter((r: PipelineRunSummary) => r.status === 'success').length;
      const failedCount = filteredRuns.filter((r: PipelineRunSummary) => r.status === 'failed').length;
      const successRate = totalRuns > 0 ? (successRuns / totalRuns) * 100 : 0;

      // 计算平均耗时
      const completedRuns = filteredRuns.filter((r: PipelineRunSummary) => r.durationMs && r.durationMs > 0);
      const totalDuration = completedRuns.reduce((sum: number, r: PipelineRunSummary) => sum + (r.durationMs || 0), 0);
      const avgDuration = completedRuns.length > 0 ? totalDuration / completedRuns.length : 0;

      setStats({
        totalRuns,
        successRate,
        avgDuration,
        failedCount,
      });

      // 记录失败的运行
      setFailedRuns(filteredRuns.filter((r: PipelineRunSummary) => r.status === 'failed'));

      // 记录最近的运行
      setRecentRuns(
        [...filteredRuns]
          .sort((a: PipelineRunSummary, b: PipelineRunSummary) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
          })
          .slice(0, 10)
      );
    } catch (error) {
      console.error('Failed to load pipeline monitor data:', error);
      message.error('加载监控数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [days]);

  // 计算失败阶段 Top 5
  const failedStageCounts = React.useMemo(() => {
    // 简化版本：按 pipelineId 统计失败次数
    const stageMap = new Map<string, number>();
    failedRuns.forEach((run) => {
      const key = run.pipelineId || 'Unknown Pipeline';
      stageMap.set(key, (stageMap.get(key) || 0) + 1);
    });

    return Array.from(stageMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [failedRuns]);

  // 格式化耗时
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    const hours = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${mins}m`;
  };

  // 状态颜色映射
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return colors.success[500];
      case 'failed':
        return colors.error[500];
      case 'running':
        return colors.primary[500];
      case 'cancelled':
        return colors.neutral[500];
      default:
        return colors.neutral[500];
    }
  };

  // 最近运行表格列
  const recentColumns = [
    {
      title: 'Pipeline ID',
      dataIndex: 'pipelineId',
      key: 'pipelineId',
      width: 150,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <span style={{ color: getStatusColor(status), fontWeight: 500 }}>
          {status === 'success' && <CheckCircleOutlined style={{ marginRight: 4 }} />}
          {status === 'failed' && <CloseCircleOutlined style={{ marginRight: 4 }} />}
          {status === 'running' && <ClockCircleOutlined style={{ marginRight: 4 }} />}
          {status}
        </span>
      ),
    },
    {
      title: '触发方式',
      dataIndex: 'triggerType',
      key: 'triggerType',
      width: 100,
    },
    {
      title: '耗时',
      dataIndex: 'durationMs',
      key: 'durationMs',
      width: 100,
      render: (ms: number) => (ms ? formatDuration(ms) : '-'),
    },
    {
      title: '开始时间',
      dataIndex: 'startedAt',
      key: 'startedAt',
      width: 180,
      render: (time: string) => (time ? dayjs(time).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
            <DashboardOutlined style={{ marginRight: 8, color: colors.primary[500] }} />
            运行监控
          </h2>
        </div>
        <Space>
          <Select
            value={days}
            onChange={setDays}
            style={{ width: 120 }}
            options={[
              { label: '近 7 天', value: 7 },
              { label: '近 30 天', value: 30 },
              { label: '近 90 天', value: 90 },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {/* Stats Cards */}
      <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
        <Col xs={24} sm={12} lg={6}>
          <CardPanel>
            <Statistic
              title="总运行次数"
              value={stats?.totalRuns ?? 0}
              prefix={<ClockCircleOutlined style={{ color: colors.primary[500] }} />}
            />
          </CardPanel>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <CardPanel>
            <Statistic
              title="成功率"
              value={(stats?.successRate ?? 0).toFixed(1)}
              suffix="%"
              prefix={<CheckCircleOutlined style={{ color: colors.success[500] }} />}
              valueStyle={{ color: colors.success[500] }}
            />
          </CardPanel>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <CardPanel>
            <Statistic
              title="失败次数"
              value={stats?.failedCount ?? 0}
              prefix={<CloseCircleOutlined style={{ color: colors.error[500] }} />}
              valueStyle={{ color: colors.error[500] }}
            />
          </CardPanel>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <CardPanel>
            <Statistic
              title="平均耗时"
              value={formatDuration(stats?.avgDuration ?? 0)}
              prefix={<ClockCircleOutlined style={{ color: colors.info[500] }} />}
            />
          </CardPanel>
        </Col>
      </Row>

      {/* Failure Analysis & Top Failed Stages */}
      <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
        <Col xs={24} lg={12}>
          <CardPanel title="失败模式分布">
            {failedRuns.length > 0 ? (
              <div>
                <div style={{ marginBottom: spacing.sm }}>
                  <span style={{ fontSize: 24, fontWeight: 600, color: colors.error[500] }}>
                    {failedRuns.length}
                  </span>
                  <span style={{ marginLeft: spacing.sm, color: colors.neutral[500] }}>
                    次失败 ({((failedRuns.length / (stats?.totalRuns || 1)) * 100).toFixed(1)}%)
                  </span>
                </div>
                {/* 简化版进度条展示 */}
                <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${stats?.successRate ?? 0}%`,
                      background: colors.success[500],
                    }}
                  />
                  <div
                    style={{
                      width: `${((stats?.failedCount ?? 0) / (stats?.totalRuns || 1)) * 100}%`,
                      background: colors.error[500],
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: spacing.xs, fontSize: 12 }}>
                  <span style={{ color: colors.success[500] }}>成功</span>
                  <span style={{ color: colors.error[500] }}>失败</span>
                </div>
              </div>
            ) : (
              <Empty description="暂无失败记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </CardPanel>
        </Col>
        <Col xs={24} lg={12}>
          <CardPanel title="失败阶段 Top 5">
            {failedStageCounts.length > 0 ? (
              <div>
                {failedStageCounts.map((item, index) => (
                  <div
                    key={item.name}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: `${spacing.xs} 0`,
                      borderBottom: index < failedStageCounts.length - 1 ? `1px solid ${colors.neutral[200]}` : 'none',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: index < 3 ? colors.error[500] : colors.neutral[300],
                          color: '#fff',
                          fontSize: 12,
                          marginRight: spacing.sm,
                        }}
                      >
                        {index + 1}
                      </span>
                      <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.name}
                      </span>
                    </span>
                    <span style={{ fontWeight: 500, color: colors.error[500] }}>{item.count} 次</span>
                  </div>
                ))}
              </div>
            ) : (
              <Empty description="暂无失败数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </CardPanel>
        </Col>
      </Row>

      {/* Recent Runs */}
      <CardPanel title="最近运行">
        {recentRuns.length > 0 ? (
          <Table
            dataSource={recentRuns}
            columns={recentColumns}
            rowKey="id"
            pagination={false}
            size="small"
          />
        ) : (
          <Empty description="暂无运行记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
        {recentRuns.length > 0 && (
          <div style={{ fontSize: spacing[3], color: colors.neutral[600], marginTop: spacing.sm }}>
            共 {stats?.totalRuns ?? 0} 次运行，成功率 {(stats?.successRate ?? 0).toFixed(1)}%
          </div>
        )}
      </CardPanel>
    </div>
  );
};

export default PipelineMonitor;