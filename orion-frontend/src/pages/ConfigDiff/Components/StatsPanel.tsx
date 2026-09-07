/**
 * StatsPanel - Diff 结果统计面板 (4 Statistic + Rollback/Report 按钮)
 * 抽取自 index.tsx (P2-9 Phase 122)
 */
import React from 'react';
import { Card, Row, Col, Space, Button, Statistic } from 'antd';
import { RollbackOutlined, FileTextOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { ConfigDiffState } from '../useConfigDiffState';

interface StatsPanelProps {
  state: ConfigDiffState;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ state }) => {
  const { diffResult, reportLoading, toVersion, handleReport, setRollbackOpen } = state;

  if (!diffResult) return null;

  return (
    <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
      <Col span={6}>
        <Card>
          <Statistic title="Total Changes" value={diffResult.changes?.length ?? 0} />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="Added"
            value={diffResult.changes?.filter((c) => c.operation === 'add').length ?? 0}
            valueStyle={{ color: colors.success[500] }}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="Removed"
            value={diffResult.changes?.filter((c) => c.operation === 'remove').length ?? 0}
            valueStyle={{ color: colors.error[500] }}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="Updated"
            value={diffResult.changes?.filter((c) => c.operation === 'update').length ?? 0}
            valueStyle={{ color: colors.primary[500] }}
          />
        </Card>
      </Col>
      <Col span={24} style={{ marginTop: spacing.sm }}>
        <Space>
          <Button
            icon={<RollbackOutlined />}
            onClick={() => setRollbackOpen(true)}
            disabled={!toVersion}
          >
            Rollback to v{toVersion}
          </Button>
          <Button icon={<FileTextOutlined />} onClick={handleReport} loading={reportLoading}>
            Load Diff Report
          </Button>
        </Space>
      </Col>
    </Row>
  );
};
