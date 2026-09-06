/**
 * Quality Gate Page
 * Gate results, exemption requests, trend analysis panel
 * P2-9 Phase 77: 拆分为 state hook + columns + 3 组件 + 精简主页面
 */
import React, { useMemo } from 'react';
import {
  Typography,
  Button,
  Space,
  Card,
  Input,
  Select,
  Table as AntTable,
  Row,
  Col,
  Statistic,
  Progress,
  Tabs,
} from 'antd';
import {
  ReloadOutlined,
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  CheckSquareOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { useQualityGateState } from './useQualityGateState';
import { makePolicyColumns, makeViolationColumns } from './QualityGateColumns';
import { StatCard } from './StatCard';
import { GateEvaluationModal } from './GateEvaluationModal';
import { WaiveModal } from './WaiveModal';
import { PolicyDetailDrawer } from './PolicyDetailDrawer';

const { Title, Text } = Typography;

const QualityGatePage: React.FC = () => {
  const {
    loading,
    policies,
    violations,
    setSearchQuery,
    setFilters,
    gateModalVisible,
    setGateModalVisible,
    gateForm,
    gateResult,
    gateLoading,
    waiveModalVisible,
    setWaiveModalVisible,
    selectedViolation,
    waiveForm,
    waiveLoading,
    detailDrawerVisible,
    setDetailDrawerVisible,
    selectedPolicy,
    filteredViolations,
    stats,
    loadPolicies,
    loadViolations,
    handleWaive,
    openWaiveModal,
    openPolicyDetail,
    handleEvaluateGate,
  } = useQualityGateState();

  const policyColumns = useMemo(() => makePolicyColumns({ openPolicyDetail }), [openPolicyDetail]);
  const violationColumns = useMemo(
    () => makeViolationColumns({ openWaiveModal }),
    [openWaiveModal],
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
            <CheckSquareOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            质量门禁
          </Title>
          <Text type="secondary">管理质量门禁策略、违规处理和豁免申请</Text>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              loadPolicies();
              loadViolations();
            }}
            loading={loading}
          >
            刷新
          </Button>
          <Button
            type="primary"
            icon={<SafetyCertificateOutlined />}
            onClick={() => {
              setGateModalVisible(true);
            }}
          >
            门禁评估
          </Button>
        </Space>
      </div>

      {/* Stats Panel */}
      <Row gutter={16} style={{ marginBottom: spacing.lg }}>
        <Col span={6}>
          <StatCard title="总策略数" value={stats.total} icon={<SafetyCertificateOutlined />} />
        </Col>
        <Col span={6}>
          <StatCard
            title="已启用"
            value={stats.enabled}
            icon={<CheckCircleOutlined />}
            color={colors.success[500]}
          />
        </Col>
        <Col span={6}>
          <StatCard
            title="未处理违规"
            value={stats.openViolations}
            icon={<ExclamationCircleOutlined />}
            color={stats.openViolations > 0 ? colors.warning[500] : colors.success[500]}
          />
        </Col>
        <Col span={6}>
          <StatCard
            title="阻塞中"
            value={stats.blocked}
            icon={<CloseCircleOutlined />}
            color={stats.blocked > 0 ? colors.error[400] : colors.success[500]}
          />
        </Col>
      </Row>

      {/* Gate Pass Rate */}
      <Card title="门禁通过率趋势" style={{ marginBottom: spacing.lg }}>
        <Row gutter={24}>
          <Col span={8}>
            <Statistic
              title="通过率"
              value={
                stats.total > 0
                  ? (((stats.total - stats.openViolations) / stats.total) * 100).toFixed(1)
                  : 100
              }
              suffix="%"
            />
            <Progress
              percent={
                stats.total > 0
                  ? Math.round(((stats.total - stats.openViolations) / stats.total) * 100)
                  : 100
              }
              status={stats.blocked > 0 ? 'exception' : 'success'}
              style={{ marginTop: spacing.sm }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="已解决违规"
              value={violations.filter((v) => v.status === 'resolved').length}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="已豁免违规"
              value={violations.filter((v) => v.status === 'waived').length}
            />
          </Col>
        </Row>
      </Card>

      {/* Tabs: Policies and Violations */}
      <Card>
        <Tabs
          defaultActiveKey="policies"
          items={[
            {
              key: 'policies',
              label: '门禁策略',
              children: (
                <AntTable
                  columns={policyColumns}
                  dataSource={policies}
                  loading={loading}
                  rowKey="id"
                  size="middle"
                  pagination={{ pageSize: 20, showSizeChanger: true, showQuickJumper: true }}
                />
              ),
            },
            {
              key: 'violations',
              label: `违规记录 (${stats.openViolations})`,
              children: (
                <>
                  <div style={{ marginBottom: spacing.md, display: 'flex', gap: spacing[3] }}>
                    <Input.Search
                      placeholder="搜索违规记录..."
                      onSearch={setSearchQuery}
                      style={{ width: 300 }}
                      allowClear
                    />
                    <Select
                      placeholder="严重级别"
                      style={{ width: 120 }}
                      allowClear
                      onChange={(v) => setFilters((prev) => ({ ...prev, severity: v || 'all' }))}
                      options={[
                        { label: '全部', value: 'all' },
                        { label: '阻止', value: 'block' },
                        { label: '警告', value: 'warning' },
                        { label: '信息', value: 'info' },
                      ]}
                    />
                    <Select
                      placeholder="状态"
                      style={{ width: 120 }}
                      allowClear
                      onChange={(v) => setFilters((prev) => ({ ...prev, status: v || 'all' }))}
                      options={[
                        { label: '全部', value: 'all' },
                        { label: '未处理', value: 'open' },
                        { label: '已豁免', value: 'waived' },
                        { label: '已解决', value: 'resolved' },
                      ]}
                    />
                  </div>
                  <AntTable
                    columns={violationColumns}
                    dataSource={filteredViolations}
                    rowKey="id"
                    size="middle"
                    pagination={{ pageSize: 20, showSizeChanger: true, showQuickJumper: true }}
                  />
                </>
              ),
            },
          ]}
        />
      </Card>

      {/* Gate Evaluation Modal */}
      <GateEvaluationModal
        visible={gateModalVisible}
        form={gateForm}
        policies={policies}
        gateResult={gateResult}
        submitting={gateLoading}
        onOk={handleEvaluateGate}
        onCancel={() => setGateModalVisible(false)}
      />

      {/* Waive Modal */}
      <WaiveModal
        visible={waiveModalVisible}
        form={waiveForm}
        selectedViolation={selectedViolation}
        submitting={waiveLoading}
        onOk={handleWaive}
        onCancel={() => setWaiveModalVisible(false)}
      />

      {/* Policy Detail Drawer */}
      <PolicyDetailDrawer
        visible={detailDrawerVisible}
        selectedPolicy={selectedPolicy}
        onClose={() => setDetailDrawerVisible(false)}
      />
    </div>
  );
};

export default QualityGatePage;
