/**
 * NodeDetailDrawer.tsx - 节点详情 Drawer (影响分析 + 列级 Schema + 上下游 + 受影响 Pipelines)
 * 抽取自 DataLineagePage.tsx (P2-9 Phase 61)
 */
import React from 'react';
import {
  Drawer, Space, Row, Col, Card, Statistic, Descriptions, Collapse,
  Table, Tag, Typography, Empty,
} from 'antd';
import {
  ArrowUpOutlined, ArrowDownOutlined, FilterOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';
import { nodeTypeConfig, deriveColumns } from './constants.tsx';
import type { LineageNode, ImpactAnalysis } from '@/api/data-lineage';

const { Text } = Typography;
const { Panel } = Collapse;

export interface NodeDetailDrawerProps {
  selectedNode: LineageNode | null;
  impactData: ImpactAnalysis | null;
  upstreamNodes: LineageNode[];
  downstreamNodes: LineageNode[];
  onClose: () => void;
}

export const NodeDetailDrawer: React.FC<NodeDetailDrawerProps> = ({
  selectedNode,
  impactData,
  upstreamNodes,
  downstreamNodes,
  onClose,
}) => {
  const columnColumnsDef = selectedNode
    ? [
        {
          title: '列名',
          dataIndex: 'name',
          key: 'name',
          render: (v: string) => <Text code strong>{v}</Text>,
        },
        {
          title: '类型',
          dataIndex: 'type',
          key: 'type',
          render: (v: string) => <Tag color="blue">{v}</Tag>,
        },
        {
          title: '上游来源',
          dataIndex: 'upstreamSource',
          key: 'upstreamSource',
          render: (v: string | undefined) =>
            v ? <Text code>{v}</Text> : <Text type="secondary">—</Text>,
        },
        {
          title: '上游列',
          dataIndex: 'upstreamColumn',
          key: 'upstreamColumn',
          render: (v: string | undefined) =>
            v ? <Text code>{v}</Text> : <Text type="secondary">—</Text>,
        },
        {
          title: '转换',
          dataIndex: 'transformed',
          key: 'transformed',
          render: (v: boolean) => (v ? <Tag color="purple">是</Tag> : <Tag>—</Tag>),
        },
        {
          title: '描述',
          dataIndex: 'description',
          key: 'description',
        },
      ]
    : [];

  return (
    <Drawer
      title={`节点详情 — ${selectedNode?.name}`}
      placement="right"
      width={600}
      open={!!selectedNode}
      onClose={onClose}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {impactData && (
          <Row gutter={12}>
            <Col span={8}>
              <Card size="small">
                <Statistic
                  title="上游"
                  value={impactData.upstreamCount}
                  prefix={<ArrowUpOutlined />}
                  valueStyle={{ color: colors.info[500] }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small">
                <Statistic
                  title="下游"
                  value={impactData.downstreamCount}
                  prefix={<ArrowDownOutlined />}
                  valueStyle={{ color: colors.success[500] }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small">
                <Statistic
                  title="影响 Pipeline"
                  value={impactData.affectedPipelines.length}
                  prefix={<FilterOutlined />}
                  valueStyle={{ color: colors.warning[500] }}
                />
              </Card>
            </Col>
          </Row>
        )}

        {selectedNode && (
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="ID">{selectedNode.id}</Descriptions.Item>
            <Descriptions.Item label="类型">
              <Tag color={(nodeTypeConfig[selectedNode.type] || nodeTypeConfig.source).color}>
                {(nodeTypeConfig[selectedNode.type] || nodeTypeConfig.source).label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Pipeline">
              {selectedNode.pipelineId || '—'}
            </Descriptions.Item>
            <Descriptions.Item label="描述">{selectedNode.description || '—'}</Descriptions.Item>
          </Descriptions>
        )}

        {/* Column Schema */}
        <Collapse defaultActiveKey={undefined} size="small">
          <Panel header="列级 Schema" key="columns">
            {selectedNode ? (
              <Table
                columns={columnColumnsDef}
                dataSource={deriveColumns(selectedNode)}
                rowKey="name"
                pagination={false}
                size="small"
              />
            ) : null}
          </Panel>
          <Panel header={`上游 (${upstreamNodes.length})`} key="upstream">
            {upstreamNodes.length === 0 ? (
              <Empty description="无上游" />
            ) : (
              <Table
                columns={[
                  { title: '名称', dataIndex: 'name', key: 'name' },
                  {
                    title: '类型',
                    dataIndex: 'type',
                    key: 'type',
                    render: (v: string) => <Tag>{nodeTypeConfig[v]?.label}</Tag>,
                  },
                  { title: 'Pipeline', dataIndex: 'pipelineId', key: 'pipelineId' },
                ]}
                dataSource={upstreamNodes}
                rowKey="id"
                pagination={false}
                size="small"
              />
            )}
          </Panel>
          <Panel header={`下游 (${downstreamNodes.length})`} key="downstream">
            {downstreamNodes.length === 0 ? (
              <Empty description="无下游" />
            ) : (
              <Table
                columns={[
                  { title: '名称', dataIndex: 'name', key: 'name' },
                  {
                    title: '类型',
                    dataIndex: 'type',
                    key: 'type',
                    render: (v: string) => <Tag>{nodeTypeConfig[v]?.label}</Tag>,
                  },
                  { title: 'Pipeline', dataIndex: 'pipelineId', key: 'pipelineId' },
                ]}
                dataSource={downstreamNodes}
                rowKey="id"
                pagination={false}
                size="small"
              />
            )}
          </Panel>
          <Panel
            header={`受影响的 Pipelines (${impactData?.affectedPipelines.length ?? 0})`}
            key="pipelines"
          >
            <Space size="small" wrap>
              {(() => {
                const pipelines = impactData?.affectedPipelines ?? [];
                return pipelines.length > 0 ? (
                  pipelines.map((p) => (
                    <Tag key={p} color="warning">
                      {p}
                    </Tag>
                  ))
                ) : (
                  <Text type="secondary">无受影响 Pipeline</Text>
                );
              })()}
            </Space>
          </Panel>
        </Collapse>
      </Space>
    </Drawer>
  );
};
