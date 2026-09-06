/**
 * OrderStatsCards.tsx - 工单统计卡片行
 * 抽取自 DbaPage.tsx (P2-9 Phase 42)
 */
import React from 'react';
import { Row, Col, Card, Statistic } from 'antd';
import {
  DatabaseOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import type { SqlOrder } from '@/api/dba';

export const OrderStatsCards: React.FC<{ orders: SqlOrder[] }> = ({ orders }) => {
  const pending = orders.filter((o) => o.status === 'pending' || o.status === 'approved').length;
  const completed = orders.filter((o) => o.status === 'completed').length;
  const failed = orders.filter((o) => o.status === 'failed').length;
  return (
    <Row gutter={16} style={{ marginBottom: 16 }}>
      <Col span={6}>
        <Card>
          <Statistic title="总工单" value={orders.length} prefix={<DatabaseOutlined />} />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="待处理"
            value={pending}
            prefix={<ClockCircleOutlined />}
            valueStyle={{ color: colors.warning[500] }}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="已完成"
            value={completed}
            prefix={<CheckCircleOutlined />}
            valueStyle={{ color: colors.success[500] }}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="失败"
            value={failed}
            prefix={<CloseCircleOutlined />}
            valueStyle={{ color: colors.error[500] }}
          />
        </Card>
      </Col>
    </Row>
  );
};
