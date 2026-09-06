/**
 * Disaster Recovery Management Page (P4-04)
 * RTO/RPO 配置、灾备演练历史、灾备策略管理
 *
 * Features:
 * - 4 stats cards (RTO/RPO target, last drill, DR coverage)
 * - RTO/RPO configuration table with status indicators
 * - Disaster drill history (last 5)
 * - DR strategy info (Descriptions)
 * - Create DR plan Modal
 *
 * 主入口 (P2-9 Phase 100 refactor: 已抽取 constants / useDisasterRecoveryState /
 * columns / Components/StatsCards / Components/StrategyInfo / Components/CreatePlanModal)
 */
import React, { useMemo } from 'react';
import {
  Typography,
  Button,
  Space,
  Card,
  Tag,
  Row,
  Col,
  Descriptions,
  Table,
} from 'antd';
import {
  SafetyCertificateOutlined,
  ReloadOutlined,
  PlusOutlined,
  HistoryOutlined,
  CloudServerOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { useDisasterRecoveryState } from './useDisasterRecoveryState';
import { buildRtoRpoColumns, buildDrillColumns } from './columns';
import { StatsCards } from './Components/StatsCards';
import { StrategyInfo } from './Components/StrategyInfo';
import { CreatePlanModal } from './Components/CreatePlanModal';

const { Title, Text } = Typography;

const DisasterRecovery: React.FC = () => {
  const state = useDisasterRecoveryState();

  const rtoRpoColumns = useMemo(
    () =>
      buildRtoRpoColumns({
        rtoRpoRecords: state.rtoRpoRecords,
        selectedRecordId: state.selectedRecordId,
        testingType: state.testingType,
        handleTest: state.handleTest,
      }),
    [state.rtoRpoRecords, state.selectedRecordId, state.testingType, state.handleTest],
  );

  const drillColumns = useMemo(() => buildDrillColumns(), []);

  return (
    <div style={{ padding: spacing.lg }}>
      {/* Title */}
      <Title level={2} style={{ marginBottom: 8 }}>
        <SafetyCertificateOutlined style={{ marginRight: 12, color: colors.error[500] }} />
        灾备管理
      </Title>
      <Text type="secondary">RTO/RPO 配置 · 灾备演练 · 恢复计划</Text>

      <StatsCards
        rtoTarget={state.rtoTarget}
        rpoTarget={state.rpoTarget}
        lastDrill={state.lastDrill}
        coverage={state.coverage}
      />

      {/* Middle Row: Table + Drill History */}
      <Row gutter={16} style={{ marginBottom: spacing.md }}>
        {/* Left: RTO/RPO Configuration Table */}
        <Col span={14}>
          <Card
            title={
              <Space>
                <CloudServerOutlined />
                <Text strong>RTO/RPO 配置</Text>
              </Space>
            }
            extra={
              <Space>
                <Button icon={<ReloadOutlined />} size="small" loading={state.loading} onClick={state.handleRefresh} />
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  size="small"
                  onClick={() => state.setCreateModalOpen(true)}
                >
                  新建灾备计划
                </Button>
              </Space>
            }
            style={{ borderRadius: 12 }}
          >
            <Table
              columns={rtoRpoColumns}
              dataSource={state.rtoRpoRecords}
              rowKey="id"
              size="small"
              pagination={false}
              loading={state.loading}
            />
          </Card>
        </Col>

        {/* Right: Drill History */}
        <Col span={10}>
          <Card
            title={
              <Space>
                <HistoryOutlined />
                <Text strong>灾备演练历史</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  (最近 5 次)
                </Text>
              </Space>
            }
            style={{ borderRadius: 12 }}
          >
            <Table
              columns={drillColumns}
              dataSource={state.drillRecords}
              rowKey="id"
              size="small"
              pagination={false}
              expandable={{
                expandedRowRender: (record) => (
                  <Descriptions column={1} size="small" style={{ margin: 0, padding: '8px 16px' }}>
                    <Descriptions.Item label="服务">
                      <Tag color="blue">{record.service}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="描述">
                      <Text>{record.description}</Text>
                    </Descriptions.Item>
                  </Descriptions>
                ),
              }}
            />
          </Card>
        </Col>
      </Row>

      <StrategyInfo />

      <CreatePlanModal
        open={state.createModalOpen}
        onCancel={() => state.setCreateModalOpen(false)}
        onOk={state.handleCreate}
        confirmLoading={state.loading}
        createForm={state.createForm}
      />
    </div>
  );
};

export default DisasterRecovery;
