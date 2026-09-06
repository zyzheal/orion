/**
 * ReportsTab.tsx - 容量报告 Tab
 * 抽取自 CapacityPlanningPage.tsx (P2-9 Phase 92)
 */
import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Typography, Progress, message } from 'antd';
import { BarChartOutlined, ReloadOutlined, PlusOutlined } from '@ant-design/icons';
import {
  listCapacityReports,
  generateCapacityReport,
  type CapacityReport,
} from '@/api/capacity';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

const { Title, Text } = Typography;

export const ReportsTab: React.FC = () => {
  const [reports, setReports] = useState<CapacityReport[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listCapacityReports();
      setReports((res.data as { data?: CapacityReport[] })?.data ?? []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载报告失败');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    try {
      await generateCapacityReport({ title: `容量规划报告 ${new Date().toLocaleDateString()}` });
      message.success('报告生成成功');
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '生成失败');
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns = [
    { title: '标题', dataIndex: 'title', key: 'title' },
    {
      title: '健康评分',
      dataIndex: 'summary',
      key: 'summary',
      render: (s: CapacityReport['summary']) => (
        <Progress
          percent={s.overallScore}
          size="small"
          status={s.overallScore >= 80 ? 'success' : s.overallScore >= 60 ? 'normal' : 'exception'}
          style={
            { width: 100 } as React.CSSProperties
          }
        />
      ),
    },
    {
      title: '总资源数',
      dataIndex: 'summary',
      key: 'total',
      render: (s: CapacityReport['summary']) => s.totalResources,
    },
    {
      title: '健康',
      dataIndex: 'summary',
      key: 'healthy',
      render: (s: CapacityReport['summary']) => (
        <span style={{ color: colors.success[500] }}>{s.healthyCount}</span>
      ),
    },
    {
      title: '警告',
      dataIndex: 'summary',
      key: 'warning',
      render: (s: CapacityReport['summary']) => (
        <span style={{ color: colors.warning[500] }}>{s.warningCount}</span>
      ),
    },
    {
      title: '严重',
      dataIndex: 'summary',
      key: 'critical',
      render: (s: CapacityReport['summary']) => (
        <span style={{ color: colors.error[500] }}>{s.criticalCount}</span>
      ),
    },
    {
      title: '生成时间',
      dataIndex: 'generatedAt',
      key: 'generatedAt',
      render: (v: string) => new Date(v).toLocaleString(),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <div>
          <Title level={3} style={{ marginBottom: spacing.sm }}>
            <BarChartOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            容量报告
          </Title>
          <Text type="secondary">容量规划报告汇总</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleGenerate}>
            生成报告
          </Button>
        </Space>
      </div>
      <Table
        columns={columns}
        dataSource={reports}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
};
