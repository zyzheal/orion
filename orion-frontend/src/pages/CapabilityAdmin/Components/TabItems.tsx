import { Table } from 'antd';
import type { TabsProps } from 'antd';
import { SafetyCertificateOutlined, ClockCircleOutlined, AuditOutlined } from '@ant-design/icons';
import { auditColumns } from '../columns';
import type { useCapabilityAdminState } from '../useCapabilityAdminState';

type State = ReturnType<typeof useCapabilityAdminState>;

interface Props {
  s: State;
  capabilityColumns: any;
  tempPermColumns: any;
}

export function buildCapabilityTabItems({ s, capabilityColumns, tempPermColumns }: Props): TabsProps['items'] {
  return [
    {
      key: 'capabilities',
      label: (<span><SafetyCertificateOutlined /> 能力管理</span>),
      children: (
        <Table
          columns={capabilityColumns}
          dataSource={s.capabilities}
          rowKey="id"
          loading={s.loading}
          pagination={{ pageSize: 20 }}
        />
      ),
    },
    {
      key: 'temporary',
      label: (<span><ClockCircleOutlined /> 临时权限</span>),
      children: (
        <Table
          columns={tempPermColumns}
          dataSource={s.tempPerms}
          rowKey="id"
          loading={s.tempPermLoading}
          pagination={{ pageSize: 20 }}
        />
      ),
    },
    {
      key: 'audit',
      label: (<span><AuditOutlined /> 审计日志</span>),
      children: (
        <Table
          columns={auditColumns}
          dataSource={s.auditLogs}
          rowKey="id"
          loading={s.auditLoading}
          pagination={{
            pageSize: 20,
            total: s.auditTotal,
            current: s.auditPage,
            onChange: (page) => s.loadAuditLogs(page),
          }}
        />
      ),
    },
  ];
}
