/**
 * 运维工具 - Tagent 客户端管理 Tab
 */
import React from 'react';
import { Card, Table, Button, Row, Col, Statistic } from 'antd';
import {
  ReloadOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { TableColumnsType } from 'antd';
import type { TagentClient, TagentStats } from '@/api/ops-tools';

interface TagentTabProps {
  tagentColumns: TableColumnsType<TagentClient>;
  tagentClients: TagentClient[];
  tagentStats: TagentStats;
  tagentLoading: boolean;
  onRefresh: () => void;
}

export const TagentTab: React.FC<TagentTabProps> = ({
  tagentColumns,
  tagentClients,
  tagentStats,
  tagentLoading,
  onRefresh,
}) => (
  <div>
    <Row gutter={[16, 16]} style={{ marginBottom: spacing.lg }}>
      <Col span={6}>
        <Card>
          <Statistic
            title="总客户端"
            value={tagentStats.total}
            prefix={<TeamOutlined />}
            valueStyle={{ color: colors.primary[500] }}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="在线"
            value={tagentStats.online}
            prefix={<CheckCircleOutlined />}
            valueStyle={{ color: colors.success[500] }}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="离线"
            value={tagentStats.offline}
            prefix={<CloseCircleOutlined />}
            valueStyle={{ color: colors.error[500] }}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="升级中"
            value={tagentStats.upgrading}
            prefix={<ThunderboltOutlined />}
            valueStyle={{ color: colors.warning[500] }}
          />
        </Card>
      </Col>
    </Row>

    <Card
      title="Tagent 客户端列表"
      extra={
        <Button icon={<ReloadOutlined />} onClick={onRefresh}>
          刷新
        </Button>
      }
    >
      <Table
        columns={tagentColumns}
        dataSource={tagentClients}
        loading={tagentLoading}
        rowKey="id"
        size="middle"
        pagination={{ pageSize: 10 }}
      />
    </Card>
  </div>
);
