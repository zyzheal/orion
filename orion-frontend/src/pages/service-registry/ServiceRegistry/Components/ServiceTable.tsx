/**
 * ServiceRegistry Table (含空状态)
 * 抽取自 index.tsx (P2-9 Phase 142)
 */
import React from 'react';
import { Card, Empty, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import type { ServiceInfo } from '@/api/service-registry';
import { spacing, componentRadius, shadows } from '@/tokens';

interface ServiceTableProps {
  services: ServiceInfo[];
  loading: boolean;
  columns: TableColumn<ServiceInfo>[];
  onOpenRegister: () => void;
}

export const ServiceTable: React.FC<ServiceTableProps> = ({
  services,
  loading,
  columns,
  onOpenRegister,
}) => {
  if (services.length === 0 && !loading) {
    return (
      <Card
        style={{
          borderRadius: componentRadius.card,
          boxShadow: shadows.card,
          textAlign: 'center',
          padding: spacing.xxl,
        }}
      >
        <Empty description="暂无已注册的服务" image={Empty.PRESENTED_IMAGE_SIMPLE}>
          <Button type="primary" icon={<PlusOutlined />} onClick={onOpenRegister}>
            注册第一个服务
          </Button>
        </Empty>
      </Card>
    );
  }
  return (
    <Table
      columns={columns}
      dataSource={services}
      loading={loading}
      rowKey="id"
      size="middle"
      striped
      clientPagination
      pageSizeOptions={[10, 20, 50]}
    />
  );
};
