/**
 * Tenant Management Page (P2-9 Phase 57)
 * Multi-tenancy, quota management, namespace pool, and usage statistics
 * Layout: Header + SummaryCards + UsageProgress + PoolStatus + NamespaceTable + QuotaModal
 */
import React from 'react';
import {
  Typography,
  Button,
  Space,
  Form,
} from 'antd';
import {
  ReloadOutlined,
  PlusOutlined,
  SettingOutlined,
} from '@ant-design/icons';

import { spacing } from '@/tokens';
import { useTenantState } from './useTenantState';
import { TenantSummaryCards } from './TenantSummaryCards';
import { TenantUsageProgress } from './TenantUsageProgress';
import { TenantPoolStatus } from './TenantPoolStatus';
import { TenantNamespaceTable } from './TenantNamespaceTable';
import { TenantQuotaModal } from './TenantQuotaModal';

const { Title, Text } = Typography;

const TenantManagementPage: React.FC = () => {
  const state = useTenantState();
  const {
    loading,
    quota,
    poolStatus,
    namespaces,
    usage,
    namespaceDetails,
    quotaModalOpen, setQuotaModalOpen,
    quotaUpdating,
    tenantId,
    loadData,
    handleUpdateQuota,
    handleAllocateNamespace,
    handleReleaseNamespace,
    getUsagePercent,
    getUsageColor,
    generateTrendData,
  } = state;

  const [form] = Form.useForm();

  return (
    <div style={{ padding: 0 }}>
      <div style={{ padding: spacing.lg }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: spacing.lg,
          }}
        >
          <div>
            <Title level={2} style={{ marginBottom: 4 }}>
              租户管理
            </Title>
            <Text type="secondary">
              多租户隔离、配额管理、Namespace 池 · 租户 ID:{' '}
              <Text code>{tenantId?.slice(0, 8) || '无效'}</Text>
            </Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
              刷新
            </Button>
            <Button icon={<SettingOutlined />} onClick={() => setQuotaModalOpen(true)}>
              配置配额
            </Button>
            <Button icon={<PlusOutlined />} type="primary" onClick={handleAllocateNamespace}>
              分配 Namespace
            </Button>
          </Space>
        </div>

        {/* Summary Cards */}
        <TenantSummaryCards
          quota={quota}
          tenantId={tenantId}
          poolStatus={poolStatus}
          namespacesCount={namespaces.length}
          usage={usage}
        />

        {/* Quota Usage Progress */}
        <TenantUsageProgress
          usage={usage}
          getUsagePercent={getUsagePercent}
          getUsageColor={getUsageColor}
          generateTrendData={generateTrendData}
        />

        {/* Pool Utilization */}
        <TenantPoolStatus poolStatus={poolStatus} />

        {/* Namespace Usage Details */}
        <TenantNamespaceTable
          namespaceDetails={namespaceDetails}
          loading={loading}
          handleAllocateNamespace={handleAllocateNamespace}
          handleReleaseNamespace={handleReleaseNamespace}
        />

        {/* Quota Edit Modal */}
        <TenantQuotaModal
          open={quotaModalOpen}
          onClose={() => setQuotaModalOpen(false)}
          quota={quota}
          updating={quotaUpdating}
          form={form}
          handleUpdateQuota={handleUpdateQuota}
        />
      </div>
    </div>
  );
};

export default TenantManagementPage;
