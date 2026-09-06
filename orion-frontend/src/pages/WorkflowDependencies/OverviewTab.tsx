/**
 * OverviewTab.tsx - 检测概览 Tab
 * 抽取自 WorkflowDependencies/index.tsx (P2-9 Phase 85)
 */
import React from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Row,
  Col,
  Alert,
  Empty,
  Spin,
  Statistic,
} from 'antd';
import {
  ReloadOutlined,
  SafetyOutlined,
  WarningOutlined,
  ApiOutlined,
  NodeIndexOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { spacing } from '@/tokens';
import { colors } from '@/tokens/colors';
import type { DependencyGraphResult, CircularDependencyPath } from '@/api/workflow-dependency';

const { Text } = Typography;

interface OverviewTabProps {
  graphData: DependencyGraphResult | null;
  graphLoading: boolean;
  loadGraphData: () => Promise<void>;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ graphData, graphLoading, loadGraphData }) => {
  const renderCyclePath = (cycle: CircularDependencyPath, index: number) => (
    <Card
      key={String(index)}
      size="small"
      style={{
        marginBottom: spacing[3],
        borderLeft: `3px solid ${colors.error[500]}`,
      }}
    >
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <div>
          <Tag color="red">循环 #{index + 1}</Tag>
          <Text type="secondary">长度: {cycle.length}</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
          {cycle.names.map((name, i) => (
            <React.Fragment key={String(i)}>
              <Tag color="orange" style={{ margin: 0 }}>
                {name}
              </Tag>
              {i < cycle.names.length - 1 && (
                <ArrowRightOutlined style={{ color: colors.neutral[400], fontSize: 10 }} />
              )}
            </React.Fragment>
          ))}
        </div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          IDs: {cycle.cycle.join(' → ')}
        </Text>
      </Space>
    </Card>
  );

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: spacing.lg }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="工作流定义数"
              value={graphData?.totalDefinitions ?? 0}
              prefix={<ApiOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="依赖边数"
              value={graphData?.totalEdges ?? 0}
              prefix={<NodeIndexOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="循环依赖数"
              value={graphData?.cycles.length ?? 0}
              valueStyle={{
                color: (graphData?.cycles.length ?? 0) > 0 ? colors.error[500] : colors.success[500],
              }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="状态"
              value={graphData?.isSafe ? '安全' : '存在循环'}
              valueStyle={{ color: graphData?.isSafe ? colors.success[500] : colors.error[500] }}
              prefix={<SafetyOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {graphData?.isSafe ? (
        <Alert
          message="依赖关系安全"
          description="当前所有工作流定义之间不存在循环依赖，可以正常执行。"
          type="success"
          showIcon
          icon={<SafetyOutlined />}
          style={{ marginBottom: spacing.lg }}
        />
      ) : (
        <Alert
          message="检测到循环依赖"
          description={`发现 ${graphData?.cycles.length ?? 0} 个循环依赖，这些工作流在执行时可能会导致无限循环。请及时修复。`}
          type="error"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: spacing.lg }}
        />
      )}

      <Card
        title={
          <Space>
            <WarningOutlined style={{ color: colors.error[500] }} />
            <Text>循环依赖详情</Text>
            <Tag color="red">{graphData?.cycles.length ?? 0}</Tag>
          </Space>
        }
        extra={
          <Button icon={<ReloadOutlined />} onClick={loadGraphData} loading={graphLoading} size="small">
            刷新
          </Button>
        }
      >
        <Spin spinning={graphLoading}>
          {graphData?.cycles && graphData.cycles.length > 0 ? (
            graphData.cycles.map((cycle, index) => renderCyclePath(cycle, index))
          ) : (
            <Empty
              description={graphData?.isSafe ? '未检测到循环依赖' : '暂无数据'}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
        </Spin>
      </Card>
    </div>
  );
};
