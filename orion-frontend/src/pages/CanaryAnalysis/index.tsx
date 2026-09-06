/**
 * ML Canary Analysis Page
 * P2-9 Phase 80: 拆分为 state hook + types + columns + 3 Modal
 */
import React, { useMemo } from 'react';
import { Typography, Button, Space, Card, Row, Col, Statistic } from 'antd';
import { colors, spacing } from '@/tokens';
import {
  ReloadOutlined,
  SettingOutlined,
  PlayCircleOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import Table from '@/components/Table';
import SearchFilterBar from '@/components/SearchFilterBar';
import { useCanaryAnalysisState } from './useCanaryAnalysisState';
import { makeRunColumns, canaryFilterDefs } from './RunColumns';
import { RunDetailModal } from './RunDetailModal';
import { TriggerModal } from './TriggerModal';
import { ConfigModal } from './ConfigModal';

const { Title, Text } = Typography;

const CanaryAnalysis: React.FC = () => {
  const {
    loading,
    runs,
    selectedRun,
    metrics,
    mlResults,
    runDetailVisible,
    setRunDetailVisible,
    triggerModalVisible,
    setTriggerModalVisible,
    configModalVisible,
    setConfigModalVisible,
    setSearchQuery,
    setFilters,
    triggerForm,
    configForm,
    triggerSubmitting,
    configSubmitting,
    filteredRuns,
    runningCount,
    promotedCount,
    rolledbackCount,
    loadData,
    handleViewRun,
    handleTrigger,
    handleForcePromote,
    handleForceRollback,
    handleSaveConfig,
  } = useCanaryAnalysisState();

  const runColumns = useMemo(() => makeRunColumns(handleViewRun), [handleViewRun]);

  return (
    <div style={{ padding: 0 }}>
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
            <ExperimentOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            ML 金丝雀分析
          </Title>
          <Text type="secondary">全指标比对与智能决策</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button icon={<PlayCircleOutlined />} onClick={() => setTriggerModalVisible(true)}>
            触发分析
          </Button>
          <Button icon={<SettingOutlined />} onClick={() => setConfigModalVisible(true)}>
            配置管理
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: spacing.lg }}>
        <Col span={6}>
          <Card>
            <Statistic title="总运行数" value={runs.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="运行中"
              value={runningCount}
              valueStyle={{ color: colors.primary[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已升级"
              value={promotedCount}
              valueStyle={{ color: colors.success[600] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已回滚"
              value={rolledbackCount}
              valueStyle={{ color: colors.error[600] }}
            />
          </Card>
        </Col>
      </Row>

      {/* Runs Table */}
      <Card title="分析运行历史">
        <div style={{ marginBottom: spacing.md }}>
          <SearchFilterBar
            onSearch={setSearchQuery}
            onFilter={setFilters}
            filters={canaryFilterDefs}
            searchPlaceholder="搜索部署 ID..."
          />
        </div>
        <Table
          columns={runColumns}
          dataSource={filteredRuns}
          loading={loading}
          rowKey="id"
          size="middle"
          striped
        />
      </Card>

      {/* Run Detail Modal */}
      <RunDetailModal
        visible={runDetailVisible}
        selectedRun={selectedRun}
        metrics={metrics}
        mlResults={mlResults}
        onCancel={() => setRunDetailVisible(false)}
        onForcePromote={handleForcePromote}
        onForceRollback={handleForceRollback}
      />

      {/* Trigger Modal */}
      <TriggerModal
        visible={triggerModalVisible}
        form={triggerForm}
        submitting={triggerSubmitting}
        onCancel={() => setTriggerModalVisible(false)}
        onOk={handleTrigger}
      />

      {/* Config Modal */}
      <ConfigModal
        visible={configModalVisible}
        form={configForm}
        submitting={configSubmitting}
        onCancel={() => setConfigModalVisible(false)}
        onOk={handleSaveConfig}
      />
    </div>
  );
};

export default CanaryAnalysis;
