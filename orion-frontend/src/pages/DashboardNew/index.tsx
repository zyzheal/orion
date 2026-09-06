/**
 * 全新 Dashboard - 工作看板
 * 展示待处理事项、系统状态、快速入口
 * 对接真实后端API获取数据
 * 8 文件拆分: types.ts + constants.tsx + useDashboardState.ts + DashboardColumns.tsx + RightPanel.tsx + index.tsx
 * 抽取自 705 行原始文件 (P2-9 Phase 67)
 */
import React from 'react';
import {
  Card,
  Row,
  Col,
  Table,
  Typography,
  Button,
  Spin,
  Alert,
  Empty,
} from 'antd';
import { colors, spacing } from '@/tokens';
import { StatCard } from '@/components/charts';
import { DashboardOutlined, RocketOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useDashboardState } from './useDashboardState';
import { useTaskColumns, usePipelineColumns } from './DashboardColumns';
import {
  DashboardLinksCard,
  SystemHealthCard,
  QuickActionsCard,
  AlertsCard,
} from './RightPanel';

const { Title, Text } = Typography;

const DashboardNew: React.FC = () => {
  const navigate = useNavigate();

  const {
    loading,
    error,
    pipelineStats,
    tasks,
    taskStats,
    recentPipelineRecords,
    systemHealth,
    loadData,
    handleRetry,
  } = useDashboardState();

  const taskColumns = useTaskColumns();
  const pipelineColumns = usePipelineColumns({ navigate, handleRetry });

  if (loading) {
    return (
      <div
        style={{
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 400,
          gap: spacing[3],
        }}
      >
        <Spin size="large" />
        <Typography.Text type="secondary">加载数据中...</Typography.Text>
      </div>
    );
  }

  return (
    <div style={{ padding: 0 }}>
      {error && (
        <Alert
          message="提示"
          description={error}
          type="warning"
          showIcon
          closable
          style={{ marginBottom: spacing.md }}
        />
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing.lg,
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <DashboardOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            工作台
          </Title>
          <Text type="secondary">个人工作与效能度量</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
          刷新
        </Button>
      </div>

      {/* 顶部统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: spacing.lg }}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Pipeline 总数"
            value={pipelineStats.total}
            trend={{ value: 0, direction: 'up', good: 'up' }}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard title="运行中" value={pipelineStats.running} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard title="成功" value={pipelineStats.success} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard title="待处理任务" value={taskStats.todo} />
        </Col>
      </Row>

      {/* 主要内容区 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card
            title="待处理任务"
            extra={<Button type="link">查看全部</Button>}
            style={{ marginBottom: spacing.md }}
          >
            {tasks.length > 0 ? (
              <Table columns={taskColumns} dataSource={tasks} pagination={false} size="small" />
            ) : (
              <Empty description="暂无待处理任务" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>

          <Card
            title="最近 Pipeline 执行"
            extra={
              <Button type="link" onClick={() => navigate('/pipeline-runs')}>
                查看全部
              </Button>
            }
          >
            {recentPipelineRecords.length > 0 ? (
              <Table
                columns={pipelineColumns}
                dataSource={recentPipelineRecords}
                pagination={false}
                size="small"
              />
            ) : (
              <Empty description="暂无 Pipeline 运行记录" image={Empty.PRESENTED_IMAGE_SIMPLE}>
                <Button
                  type="primary"
                  icon={<RocketOutlined />}
                  onClick={() => navigate('/pipelines/new')}
                >
                  创建 Pipeline
                </Button>
              </Empty>
            )}
          </Card>
        </Col>

        <Col xs={24} xl={8}>
          <DashboardLinksCard navigate={navigate} />
          <SystemHealthCard health={systemHealth} />
          <QuickActionsCard navigate={navigate} />
          <AlertsCard failed={pipelineStats.failed} running={pipelineStats.running} />
        </Col>
      </Row>
    </div>
  );
};

export default DashboardNew;
