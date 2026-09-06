/**
 * Column-Level Data Lineage & Impact Analysis
 * - 布局编排: Header + StatsRow + EdgeMappingCard + Node Table + Drawer + Modal
 * 抽取自 740 行原始文件 (P2-9 Phase 61)
 */
import React from 'react';
import {
  Typography,
  Space,
  Button,
  Select,
  Table,
  Input,
  Empty,
  Spin,
  Card,
} from 'antd';
import {
  BranchesOutlined,
  SearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { useDataLineageState } from './useDataLineageState';
import { useNodeColumns } from './NodeColumns';
import { StatsRow } from './StatsRow';
import { EdgeMappingCard } from './EdgeMappingCard';
import { NodeDetailDrawer } from './NodeDetailDrawer';
import { EdgeMappingModal } from './EdgeMappingModal';
import { nodeTypeConfig } from './constants.tsx';

const { Title, Text } = Typography;
const { Option } = Select;

const DataLineageEnhancedPage: React.FC = () => {
  const {
    loading,
    nodes, edges, stats,
    search, setSearch,
    nodeTypeFilter, setNodeTypeFilter,
    pipelineFilter, setPipelineFilter,
    selectedNode, setSelectedNode,
    impactData,
    upstreamNodes, downstreamNodes,
    pipelineList,
    edgeMapping, setEdgeMapping,
    filteredNodes,
    fetchLineage,
    openNodeDetail,
    openEdgeMapping,
  } = useDataLineageState();

  const nodeColumns = useNodeColumns({ nodes, openNodeDetail });

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.md }}>
        <BranchesOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        列级数据血缘
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
        Column-level lineage graph with impact analysis
      </Text>

      <StatsRow stats={stats} nodes={nodes} edges={edges} />

      {/* Edge Mapping: show edges connecting to selected node */}
      {selectedNode && (
        <EdgeMappingCard
          selectedNode={selectedNode}
          edges={edges}
          onClose={() => setSelectedNode(null)}
          onEdgeMapping={openEdgeMapping}
        />
      )}

      {/* Node Table */}
      <Card
        title="数据血缘图谱"
        extra={
          <Space>
            <Select
              placeholder="Pipeline"
              value={pipelineFilter}
              onChange={setPipelineFilter}
              allowClear
              style={{ width: 160 }}
            >
              {pipelineList.map((p) => (
                <Option key={p.key} value={p.key}>
                  {p.label}
                </Option>
              ))}
            </Select>
            <Input
              placeholder="搜索节点..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
              style={{ width: 180 }}
            />
            <Select
              placeholder="类型"
              value={nodeTypeFilter}
              onChange={setNodeTypeFilter}
              allowClear
              style={{ width: 110 }}
            >
              {Object.entries(nodeTypeConfig).map(([k, v]) => (
                <Option key={String(k)} value={k}>
                  {v.label}
                </Option>
              ))}
            </Select>
            <Button icon={<ReloadOutlined />} onClick={fetchLineage} loading={loading}>
              Refresh
            </Button>
          </Space>
        }
      >
        {loading ? (
          <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />
        ) : filteredNodes.length === 0 ? (
          <Empty description="暂无数据血缘信息" />
        ) : (
          <Table
            dataSource={filteredNodes}
            columns={nodeColumns}
            rowKey="id"
            pagination={{ pageSize: 20 }}
            size="small"
          />
        )}
      </Card>

      {/* Node Detail Drawer */}
      <NodeDetailDrawer
        selectedNode={selectedNode}
        impactData={impactData}
        upstreamNodes={upstreamNodes}
        downstreamNodes={downstreamNodes}
        onClose={() => setSelectedNode(null)}
      />

      {/* Edge Mapping Detail Modal */}
      <EdgeMappingModal
        edgeMapping={edgeMapping}
        onClose={() => setEdgeMapping(null)}
      />
    </div>
  );
};

export default DataLineageEnhancedPage;
