/**
 * TenantNamespaceTable.tsx - Namespace 列表表格
 * 抽取自 TenantManagement/index.tsx (P2-9 Phase 57)
 */
import React from 'react';
import { Card, Button, Space, Empty } from 'antd';
import { PlusOutlined, CloudServerOutlined, InfoCircleOutlined } from '@ant-design/icons';
import Table from '@/components/Table';
import { colors } from '@/tokens/colors';
import type { NamespaceUsageDetail } from '@/api/tenant';
import { useNamespaceColumns } from './TenantColumns';

export interface TenantNamespaceTableProps {
  namespaceDetails: NamespaceUsageDetail[];
  loading: boolean;
  handleAllocateNamespace: () => void;
  handleReleaseNamespace: (namespaceName: string) => void;
}

export const TenantNamespaceTable: React.FC<TenantNamespaceTableProps> = ({
  namespaceDetails,
  loading,
  handleAllocateNamespace,
  handleReleaseNamespace,
}) => {
  const columns = useNamespaceColumns({ handleReleaseNamespace });

  return (
    <Card
      title={
        <Space>
          <CloudServerOutlined style={{ color: colors.primary[500] }} />
          我的 Namespace
          <InfoCircleOutlined style={{ color: colors.neutral[500], fontSize: 12 }} />
        </Space>
      }
      extra={
        <Button icon={<PlusOutlined />} size="small" onClick={handleAllocateNamespace}>
          分配 Namespace
        </Button>
      }
    >
      {namespaceDetails.length > 0 ? (
        <Table
          columns={columns}
          dataSource={namespaceDetails.map((ns) => ({ ...ns, key: ns.id })) as any}
          loading={loading}
          pagination={false}
          size="small"
        />
      ) : (
        <Empty description="暂无已分配的 Namespace" image={Empty.PRESENTED_IMAGE_SIMPLE}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAllocateNamespace}>
            分配 Namespace
          </Button>
        </Empty>
      )}
    </Card>
  );
};
