/**
 * Chaos Engineering Page
 * Phase 3 - Chaos experiments dashboard with resilience score tracking
 *
 * 重构自 P2-9 Phase 91 (634 → ~120 行):
 *  - constants.ts - faultTypeConfig/statusConfig/envConfig
 *  - useChaosEngineeringState.ts - 全部状态 + loadData + handleRunExperiment + handleCreateExperiment + openDetail
 *  - columns.tsx - makeExperimentColumns
 *  - Modals/CreateExperimentModal.tsx - 创建实验弹窗
 *  - Components/DetailDrawer.tsx - 实验详情抽屉
 *  - Components/ResilienceScoreCard.tsx - 系统弹性评分卡
 */
import React from 'react';
import {
  Card,
  Table,
  Button,
  Alert,
  Typography,
  Space,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  ThunderboltOutlined,
  ReloadOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import { useChaosEngineeringState } from './useChaosEngineeringState';
import { makeExperimentColumns } from './columns';
import { CreateExperimentModal } from './Modals/CreateExperimentModal';
import { DetailDrawer } from './Components/DetailDrawer';
import { ResilienceScoreCard } from './Components/ResilienceScoreCard';

const { Title, Text } = Typography;

const ChaosEngineering: React.FC = () => {
  const {
    experiments,
    score,
    loading,
    error,
    setError,
    createModal,
    setCreateModal,
    detailDrawer,
    setDetailDrawer,
    selectedExperiment,
    form,
    submitting,
    runningId,
    runError,
    setRunError,
    loadData,
    handleRunExperiment,
    handleCreateExperiment,
    openDetail,
    openCreate,
    stats,
  } = useChaosEngineeringState();

  const columns = React.useMemo(
    () => makeExperimentColumns({ runningId, openDetail, handleRunExperiment }),
    [runningId, openDetail, handleRunExperiment]
  );

  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
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
            <ThunderboltOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            混沌工程
          </Title>
          <Text type="secondary">故障注入实验与系统弹性测试</Text>
        </div>
        <Space>
          {error && (
            <Button danger size="small" onClick={() => setError(null)}>
              清除错误提示
            </Button>
          )}
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {/* Error display */}
      {error && (
        <Alert
          message="加载失败"
          description={error}
          type="error"
          showIcon
          closable
          onClose={() => setError(null)}
          style={
            { marginBottom: spacing.md } as React.CSSProperties
          }
        />
      )}

      {/* Run error display */}
      {runError && (
        <Alert
          message="实验运行失败"
          description={runError}
          type="error"
          showIcon
          closable
          onClose={() => setRunError(null)}
          style={
            { marginBottom: spacing.md } as React.CSSProperties
          }
        />
      )}

      {/* Resilience Score */}
      <ResilienceScoreCard score={score} />

      {/* Experiment Stats */}
      <Row gutter={16} style={{ marginBottom: spacing.lg }} align="stretch">
        <Col span={6}>
          <Card size="small">
            <Statistic title="实验总数" value={stats.total} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="就绪"
              value={stats.active}
              valueStyle={{ color: colors.success[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="已归档"
              value={stats.archived}
              valueStyle={{ color: colors.neutral[400] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="已完成"
              value={stats.completed}
              valueStyle={{ color: colors.neutral[400] }}
            />
          </Card>
        </Col>
      </Row>

      {/* Warning for production experiments */}
      {stats.hasProductionActive && (
        <Alert
          message="注意"
          description="存在生产环境的混沌实验，执行前请确认影响范围"
          type="warning"
          showIcon
          style={
            { marginBottom: spacing.md } as React.CSSProperties
          }
        />
      )}

      {/* Experiments Table */}
      <Card
        title={
          <>
            <ThunderboltOutlined style={{ marginRight: spacing.sm }} />
            混沌实验列表
          </>
        }
        extra={
          <Space>
            <Button
              icon={<PlusOutlined />}
              type="primary"
              onClick={openCreate}
            >
              创建实验
            </Button>
            <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
              刷新
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={experiments}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </Card>

      {/* Create Experiment Modal */}
      <CreateExperimentModal
        open={createModal}
        submitting={submitting}
        form={form}
        onCancel={() => setCreateModal(false)}
        onFinish={handleCreateExperiment}
      />

      {/* Detail Drawer */}
      <DetailDrawer
        open={detailDrawer}
        experiment={selectedExperiment}
        runningId={runningId}
        onClose={() => setDetailDrawer(false)}
        onRun={handleRunExperiment}
      />
    </div>
  );
};

export default ChaosEngineering;
