/**
 * 告警闭环与升级策略 (Alert Closure & Escalation)
 * /api/v1/alert-escalation — 策略管理 · 升级触发器 · 告警闭环 · MTTR
 *
 * 重构自 P2-9 Phase 88 (654 → ~215 行):
 *  - constants.ts - SEVERITY_MAP / CLOSURE_STATUS
 *  - columns.tsx - makePolicyColumns / makeTriggerColumns / makeClosureColumns
 *  - useAlertClosureState.ts - 全部状态与 handler
 *  - Modals/PolicyModal.tsx - 新建/编辑策略弹窗
 *  - Modals/PolicyDetailModal.tsx - 策略详情弹窗
 */
import React from 'react';
import { Card, Table, Button, Space, Row, Col, Tabs, Select, Typography, Empty } from 'antd';
import { BellOutlined, ReloadOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { useAlertClosureState } from './useAlertClosureState';
import { makePolicyColumns, makeTriggerColumns, makeClosureColumns } from './columns';
import { PolicyModal } from './Modals/PolicyModal';
import { PolicyDetailModal } from './Modals/PolicyDetailModal';

const { Title, Text } = Typography;
const { Option } = Select;

const AlertClosurePage: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    loading,
    modalOpen,
    setModalOpen,
    detailOpen,
    setDetailOpen,
    selectedItem,
    form,
    policies,
    triggers,
    closures,
    metrics,
    policyStatus,
    setPolicyStatus,
    loadTriggers,
    loadClosures,
    handleRefresh,
    handleCreate,
    handleEdit,
    handleSubmit,
    handleDelete,
    handleViewDetail,
    handleEvaluate,
    handleAcknowledge,
    handleResolve,
    handleTriggerResolve,
  } = useAlertClosureState();

  const policyColumns = makePolicyColumns(handleViewDetail, handleEvaluate, handleEdit, handleDelete);
  const triggerColumns = makeTriggerColumns(handleTriggerResolve);
  const closureColumns = makeClosureColumns(handleAcknowledge, handleResolve);

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: 8 }}>
        <BellOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        告警闭环与升级策略
      </Title>
      <Text type="secondary" style={{ marginBottom: spacing.md, display: 'block' }}>
        升级策略管理 · 告警确认与解决 · MTTR 指标追踪
      </Text>

      <Tabs activeKey={activeTab} onChange={(k) => setActiveTab(k as typeof activeTab)}>
        <Tabs.TabPane tab={`升级策略 (${policies.length})`} key="policies" />
        <Tabs.TabPane tab={`告警闭环 (${closures.length})`} key="closures" />
        <Tabs.TabPane tab="MTTR 指标" key="metrics" />
      </Tabs>

      {activeTab === 'policies' && (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Card
            title="升级策略"
            extra={
              <Space>
                <Button
                  icon={<ReloadOutlined />}
                  size="small"
                  onClick={handleRefresh}
                  loading={loading}
                >
                  刷新
                </Button>
                <Button type="primary" size="small" onClick={handleCreate}>
                  新建策略
                </Button>
              </Space>
            }
          >
            <Table
              columns={policyColumns}
              dataSource={policies}
              rowKey="id"
              loading={loading}
              size="small"
              locale={{ emptyText: <Empty description="暂无升级策略" /> }}
              pagination={{ pageSize: 10 }}
            />
          </Card>
          <Card
            title="升级触发器"
            extra={
              <Button icon={<ReloadOutlined />} size="small" onClick={loadTriggers}>
                刷新
              </Button>
            }
          >
            <Table
              columns={triggerColumns}
              dataSource={triggers}
              rowKey="id"
              size="small"
              locale={{ emptyText: <Empty description="暂无触发记录" /> }}
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </Space>
      )}

      {activeTab === 'closures' && (
        <Card
          title="告警闭环"
          extra={
            <Space>
              <Select
                style={{ width: 120 }}
                value={policyStatus}
                onChange={setPolicyStatus}
                allowClear
                placeholder="状态"
              >
                <Option value="pending">待确认</Option>
                <Option value="acknowledged">已确认</Option>
                <Option value="resolved">已解决</Option>
              </Select>
              <Button
                icon={<ReloadOutlined />}
                size="small"
                onClick={loadClosures}
                loading={loading}
              >
                刷新
              </Button>
            </Space>
          }
        >
          <Table
            columns={closureColumns}
            dataSource={closures}
            rowKey="id"
            loading={loading}
            size="small"
            locale={{ emptyText: <Empty description="暂无告警记录" /> }}
            pagination={{ pageSize: 10 }}
          />
        </Card>
      )}

      {activeTab === 'metrics' && metrics && (
        <Row gutter={[spacing.md, spacing.md]}>
          <Col span={6}>
            <Card>
              <Text type="secondary">总告警数</Text>
              <div style={{ fontSize: 24, fontWeight: 600, color: colors.primary[500] }}>
                {metrics.totalAlerts}
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Text type="secondary">待确认</Text>
              <div style={{ fontSize: 24, fontWeight: 600, color: colors.warning[500] }}>
                {metrics.openCount}
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Text type="secondary">已确认</Text>
              <div style={{ fontSize: 24, fontWeight: 600, color: colors.info[500] }}>
                {metrics.acknowledgedCount}
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Text type="secondary">已解决</Text>
              <div style={{ fontSize: 24, fontWeight: 600, color: colors.success[500] }}>
                {metrics.resolvedCount}
              </div>
            </Card>
          </Col>
          <Col span={24}>
            <Card>
              <Text type="secondary">平均 MTTR</Text>
              <div
                style={{ fontSize: 32, fontWeight: 700, color: colors.purple[500], marginTop: 4 }}
              >
                {metrics.avgMTTRFormatted || '0s'}
              </div>
              <Text type="secondary">({metrics.avgMTTRSeconds} 秒)</Text>
            </Card>
          </Col>
        </Row>
      )}

      <PolicyModal
        open={modalOpen}
        form={form}
        selectedItem={selectedItem}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
      />

      <PolicyDetailModal
        open={detailOpen}
        selectedItem={selectedItem}
        onClose={() => setDetailOpen(false)}
      />
    </div>
  );
};

export default AlertClosurePage;
