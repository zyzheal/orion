/**
 * Circuit Breaker Page (Workflow 6: Rate Limiting & Circuit Breaker)
 *
 * Features:
 * - Circuit breaker list with status visualization
 * - Create/edit/delete circuit breaker configs
 * - Reset circuit breaker to closed state
 * - Stats overview with state distribution
 *
 * P2-9 Phase 81: 拆分为 state hook + columns + constants + 3 弹窗 + 精简主页面
 */
import React, { useMemo } from 'react';
import {
  Typography,
  Card,
  Table,
  Space,
  Button,
  Row,
  Col,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import MetricCard from '@/components/MetricCard';
import SearchFilterBar from '@/components/SearchFilterBar';
import { colors, spacing } from '@/tokens';
import { type CircuitBreakerConfig } from '@/api/circuit-breaker';
import { useCircuitBreakerState } from './useCircuitBreakerState';
import { makeCircuitBreakerColumns, circuitBreakerFilterDefs } from './CircuitBreakerColumns';
import { CreateBreakerModal } from './CreateBreakerModal';
import { EditBreakerModal } from './EditBreakerModal';
import { DetailBreakerModal } from './DetailBreakerModal';

const { Title, Text } = Typography;

const CircuitBreakerPage: React.FC = () => {
  const {
    loading,
    setBreakers,
    setSearchQuery,
    setStateFilter,
    createModalVisible,
    setCreateModalVisible,
    editModalVisible,
    setEditModalVisible,
    detailModalVisible,
    setDetailModalVisible,
    selectedBreaker,
    setSelectedBreaker,
    createForm,
    editForm,
    submitting,
    stats,
    apiError,
    filteredBreakers,
    loadBreakers,
    handleCreate,
    handleEdit,
    handleDelete,
    handleReset,
    openEdit,
  } = useCircuitBreakerState();

  const openDetail = (b: CircuitBreakerConfig) => {
    setSelectedBreaker(b);
    setDetailModalVisible(true);
  };

  const onToggleEnabled = (id: string, enabled: boolean) =>
    setBreakers((prev) => prev.map((b) => (b.id === id ? { ...b, enabled } : b)));

  const columns = useMemo(
    () => makeCircuitBreakerColumns({ openEdit, openDetail, handleReset, handleDelete, onToggleEnabled }),
    [openEdit, openDetail, handleReset, handleDelete, onToggleEnabled],
  );

  return (
    <div style={{ padding: 0 }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing[6],
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <ThunderboltOutlined style={{ marginRight: spacing[2], color: colors.error[500] }} />
            熔断器管理
          </Title>
          <Text type="secondary">配置和管理服务熔断策略，防止级联故障</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadBreakers} loading={loading}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              createForm.resetFields();
              setCreateModalVisible(true);
            }}
          >
            创建熔断器
          </Button>
        </Space>
      </div>

      {/* API Warning */}
      {apiError && (
        <Alert
          message="后端 API 尚未就绪"
          description={`熔断器管理功能的后端接口尚未实现 (${apiError})。页面已准备好，等待后端完成后启用。`}
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: spacing[4] }}
        />
      )}

      {/* Stats Cards */}
      {stats && (
        <div style={{ marginBottom: spacing[6] }}>
          <Row gutter={spacing[4]}>
            <Col span={4}>
              <MetricCard title="熔断器总数" value={stats.totalBreakers} />
            </Col>
            <Col span={4}>
              <MetricCard title="正常" value={stats.closedCount} color={colors.success[500]} />
            </Col>
            <Col span={4}>
              <MetricCard title="已熔断" value={stats.openCount} color={colors.error[500]} />
            </Col>
            <Col span={4}>
              <MetricCard title="半开" value={stats.halfOpenCount} color={colors.warning[500]} />
            </Col>
            <Col span={4}>
              <MetricCard title="总请求" value={stats.totalRequests} />
            </Col>
            <Col span={4}>
              <MetricCard title="总失败" value={stats.totalFailures} />
            </Col>
          </Row>
        </div>
      )}

      {/* Breaker Table */}
      <Card>
        <div style={{ marginBottom: spacing[4] }}>
          <SearchFilterBar
            onSearch={setSearchQuery}
            filters={circuitBreakerFilterDefs}
            searchPlaceholder="搜索熔断器名称或服务..."
            onFilter={(filters) => {
              if (filters.state) setStateFilter(String(filters.state));
            }}
            initialFilters={{ state: 'all' }}
          />
        </div>

        <Table<CircuitBreakerConfig>
          columns={columns}
          dataSource={filteredBreakers}
          rowKey="id"
          loading={loading}
          size="middle"
          pagination={{ pageSize: 15, showTotal: (total) => `共 ${total} 个熔断器` }}
          locale={{ emptyText: apiError ? 'API 不可用，暂无数据' : '暂无熔断器配置' }}
        />
      </Card>

      {/* Create Modal */}
      <CreateBreakerModal
        visible={createModalVisible}
        form={createForm}
        submitting={submitting}
        onCancel={() => setCreateModalVisible(false)}
        onOk={handleCreate}
      />

      {/* Edit Modal */}
      <EditBreakerModal
        visible={editModalVisible}
        form={editForm}
        submitting={submitting}
        onCancel={() => setEditModalVisible(false)}
        onOk={handleEdit}
      />

      {/* Detail Modal */}
      <DetailBreakerModal
        visible={detailModalVisible}
        selectedBreaker={selectedBreaker}
        onClose={() => setDetailModalVisible(false)}
      />
    </div>
  );
};

export default CircuitBreakerPage;
