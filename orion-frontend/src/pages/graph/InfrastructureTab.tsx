/**
 * Infrastructure Topology Tab
 * Shows infrastructure node summary statistics, the topology table, and
 * the list of connections between nodes.
 */
import React from 'react';
import { Button, Card, Col, Row, Spin, Statistic } from 'antd';
import { ReloadOutlined, ShareAltOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import Table from '@/components/Table';
import type { InfrastructureTopology } from '@/api/graph';
import { buildInfraColumns } from './columns';
import InfrastructureEdgeList from './InfrastructureEdgeList';

export interface InfrastructureTabProps {
  topology: InfrastructureTopology;
  infraLoading: boolean;
  onRefresh: () => void;
}

const InfrastructureTab: React.FC<InfrastructureTabProps> = ({
  topology,
  infraLoading,
  onRefresh,
}) => {
  const infraColumns = React.useMemo(() => buildInfraColumns(), []);

  return (
    <div>
      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: spacing.md }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="节点总数"
              value={topology.nodes.length}
              prefix={<ShareAltOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="在线"
              value={topology.nodes.filter((n) => n.status === 'online').length}
              valueStyle={{ color: colors.success[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="离线"
              value={topology.nodes.filter((n) => n.status === 'offline').length}
              valueStyle={{ color: colors.error[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="连接数"
              value={topology.edges.length}
              prefix={<ShareAltOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Actions */}
      <div
        style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: spacing.md }}
      >
        <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={infraLoading}>
          刷新
        </Button>
      </div>

      {/* Topology Table */}
      <Spin spinning={infraLoading}>
        {topology.nodes.length === 0 ? (
          <Card style={{ textAlign: 'center', padding: 40 }}>
            <ShareAltOutlined style={emptyIconStyle} />
            <p style={{ marginTop: spacing.md, color: colors.neutral[500] }}>
              暂无基础设施数据
            </p>
          </Card>
        ) : (
          <>
            <Table
              columns={infraColumns}
              dataSource={topology.nodes}
              loading={infraLoading}
              rowKey="id"
              size="middle"
              striped
            />

            {/* Edge List */}
            <InfrastructureEdgeList nodes={topology.nodes} edges={topology.edges} />
          </>
        )}
      </Spin>
    </div>
  );
};

const emptyIconStyle: React.CSSProperties = {
  fontSize: 48,
  color: colors.neutral[300],
};

export default InfrastructureTab;
