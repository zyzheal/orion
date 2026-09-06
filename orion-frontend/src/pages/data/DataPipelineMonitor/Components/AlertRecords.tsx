/**
 * AlertRecords - 最近告警记录 Card
 * 抽取自 index.tsx (P2-9 Phase 107)
 */
import React, { useMemo } from 'react';
import { Card, Table, Empty, Space, Button, Tooltip, Divider } from 'antd';
import { spacing } from '@/tokens';
import { MOCK_ALERTS } from '../mockData';
import { buildAlertColumns } from '../columns';

const AlertRecords: React.FC = () => {
  const columns = useMemo(() => buildAlertColumns(), []);

  return (
    <Card title="最近告警记录">
      <Table
        dataSource={MOCK_ALERTS}
        rowKey="id"
        size="small"
        pagination={false}
        locale={{ emptyText: <Empty description="暂无告警记录" /> }}
        columns={columns}
      />
      <Divider style={{ margin: `${spacing.sm} 0` }} />
      <Space size="small">
        <Tooltip title="告警规则配置功能开发中">
          <Button size="small" type="primary" ghost disabled>
            告警规则配置
          </Button>
        </Tooltip>
        <Tooltip title="SLA 达标率报告功能开发中">
          <Button size="small" type="primary" ghost disabled>
            SLA 达标率报告
          </Button>
        </Tooltip>
      </Space>
    </Card>
  );
};

export default AlertRecords;
