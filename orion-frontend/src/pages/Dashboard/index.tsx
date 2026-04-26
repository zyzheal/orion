import React from 'react';
import { Card, Row, Col, Statistic, Progress, Table, Tag } from 'antd';
import { colors } from '@/tokens';
import {
  ProjectOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  UsergroupAddOutlined,
} from '@ant-design/icons';
import { useFetch } from '@/hooks/useFetch';
import type { DashboardStats } from '@/api/types';

const Dashboard: React.FC = () => {
  // 模拟数据，实际项目中会使用 useFetch 获取真实数据
  const { data, loading } = useFetch<DashboardStats>('/api/dashboard/stats');

  // 模拟数据用于展示
  const mockStats: DashboardStats = {
    totalProjects: 12,
    activePipelines: 8,
    totalUsers: 156,
    systemHealth: 'healthy',
  };

  const stats = data || mockStats;

  const pipelineData = [
    {
      key: '1',
      name: '数据同步 Pipeline',
      status: 'running',
      progress: 75,
      lastRun: '2024-01-15 10:30:00',
    },
    {
      key: '2',
      name: '日志处理 Pipeline',
      status: 'success',
      progress: 100,
      lastRun: '2024-01-15 09:15:00',
    },
    {
      key: '3',
      name: '报表生成 Pipeline',
      status: 'pending',
      progress: 0,
      lastRun: '2024-01-14 18:00:00',
    },
    {
      key: '4',
      name: '数据清洗 Pipeline',
      status: 'failed',
      progress: 45,
      lastRun: '2024-01-14 16:30:00',
    },
  ];

  const columns = [
    {
      title: 'Pipeline 名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusMap: Record<string, { color: string; icon: React.ReactNode }> = {
          running: { color: 'blue', icon: <SyncOutlined spin /> },
          success: { color: 'green', icon: <CheckCircleOutlined /> },
          pending: { color: 'orange', icon: <SyncOutlined /> },
          failed: { color: 'red', icon: <SyncOutlined /> },
        };
        const { color, icon } = statusMap[status] || { color: 'default', icon: null };
        return (
          <Tag color={color}>
            {icon} {status}
          </Tag>
        );
      },
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      render: (progress: number) => (
        <Progress
          percent={progress}
          status={progress === 100 ? 'success' : progress < 100 ? 'active' : 'exception'}
          size="small"
        />
      ),
    },
    {
      title: '最后运行时间',
      dataIndex: 'lastRun',
      key: 'lastRun',
    },
  ];

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="项目总数"
              value={stats.totalProjects}
              prefix={<ProjectOutlined />}
              valueStyle={{ color: colors.primary[500] }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="活跃 Pipeline"
              value={stats.activePipelines}
              prefix={<SyncOutlined spin />}
              valueStyle={{ color: colors.success[500] }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="用户总数"
              value={stats.totalUsers}
              prefix={<UsergroupAddOutlined />}
              valueStyle={{ color: colors.purple[500] }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="系统健康度"
              value={
                stats.systemHealth === 'healthy'
                  ? '健康'
                  : stats.systemHealth === 'warning'
                    ? '警告'
                    : '严重'
              }
              valueStyle={{
                color:
                  stats.systemHealth === 'healthy'
                    ? colors.success[500]
                    : stats.systemHealth === 'warning'
                      ? colors.warning[500]
                      : colors.error[500],
              }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Pipeline 列表" style={{ marginTop: 16 }} loading={loading}>
        <Table columns={columns} dataSource={pipelineData} pagination={false} />
      </Card>
    </div>
  );
};

export default Dashboard;
