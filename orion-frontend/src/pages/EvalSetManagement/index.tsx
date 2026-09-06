/**
 * EvalSet Management Page (TR-05)
 * - 布局编排: Header + StatsRow + EvalSets Card + EvalRuns Card + CreateModal + DetailModal
 * 抽取自 740 行原始文件 (P2-9 Phase 60)
 */
import React from 'react';
import {
  Typography,
  Button,
  Space,
  Card,
  Table,
  Empty,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  RocketOutlined,
  ExportOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { useEvalSetState } from './useEvalSetState';
import { useEvalSetColumns, useRunColumns } from './EvalSetColumns';
import { CreateEvalSetModal } from './CreateEvalSetModal';
import { EvalSetDetailModal } from './EvalSetDetailModal';
import { EvalSetStatsRow } from './EvalSetStatsRow';

const { Title, Text } = Typography;

const EvalSetManagement: React.FC = () => {
  const {
    selectedSet, setSelectedSet,
    createModalOpen, setCreateModalOpen,
    createForm,
    selectedRuns, setSelectedRuns,
    runLoading,
    seeding,
    exporting,
    sets, runs,
    loading,
    refetch,
    handleSeed,
    handleExportReport,
    handleCreateSet,
    handleDeleteSet,
    handleViewSet,
    handleRunEval,
    handleCompare,
  } = useEvalSetState();

  const setColumns = useEvalSetColumns({
    runLoading,
    handleViewSet,
    handleRunEval,
    handleDeleteSet,
  });
  const runColumns = useRunColumns();

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <ThunderboltOutlined style={{ marginRight: spacing.sm, color: colors.purple[500] }} />
        评测集管理
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
        管理 RAG 评测集及评测用例，支持创建/查看/删除/运行/对比。用例格式: query ||| gold_answer
      </Text>

      <EvalSetStatsRow sets={sets} runs={runs} />

      <Card
        title="评测集列表"
        extra={
          <Space>
            {sets.length === 0 && (
              <Button icon={<RocketOutlined />} loading={seeding} onClick={handleSeed}>
                初始化演示数据
              </Button>
            )}
            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
              新建评测集
            </Button>
          </Space>
        }
        style={{ marginBottom: spacing.md }}
      >
        <Table
          dataSource={sets}
          columns={setColumns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={false}
          locale={{ emptyText: <Empty description="暂无评测集，点击「新建评测集」创建" /> }}
        />
      </Card>

      <Card
        title="评测运行记录"
        extra={
          <Space>
            <Button
              icon={<ExportOutlined />}
              loading={exporting}
              onClick={handleExportReport}
              disabled={runs.length === 0}
            >
              导出报告
            </Button>
            <Button
              icon={<SwapOutlined />}
              onClick={handleCompare}
              disabled={selectedRuns.length !== 2}
            >
              对比分析
            </Button>
          </Space>
        }
      >
        <Table
          dataSource={runs}
          columns={runColumns}
          rowKey="id"
          rowSelection={{
            type: 'checkbox',
            selectedRowKeys: selectedRuns.map((r) => r.id),
            onChange: (keys: React.Key[]) => {
              setSelectedRuns(runs.filter((r) => keys.includes(r.id)).slice(0, 2));
            },
          }}
          loading={loading}
          size="small"
          pagination={false}
          locale={{ emptyText: <Empty description="暂无评测运行记录" /> }}
        />
      </Card>

      {/* Create EvalSet Modal */}
      <CreateEvalSetModal
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          createForm.resetFields();
        }}
        onOk={handleCreateSet}
        form={createForm}
      />

      {/* View Detail Modal */}
      <EvalSetDetailModal
        selectedSet={selectedSet}
        runLoading={runLoading}
        onClose={() => setSelectedSet(null)}
        onRunEval={handleRunEval}
      />
    </div>
  );
};

export default EvalSetManagement;
