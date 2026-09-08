/**
 * Sprint Board Page
 *
 * 拆分结构（P2-9 Phase 35）:
 * - useSprintBoardState.tsx: 全部 state + 4 loader + 10 handler + burndowndPercent memo
 * - constants.ts: 状态/优先级/看板列 映射常量
 * - SprintColumns.tsx: buildSprintColumns + buildBacklogColumns + BacklogItem 类型
 * - KanbanBoard.tsx: renderKanbanBoard 抽取的看板渲染组件
 * - BurndownChart.tsx: renderBurndown 抽取的燃尽图组件
 * - SprintModal.tsx: Sprint 创建/编辑 Modal (form instance owned here)
 *
 * P2-9 Phase 260 重构: 263 -> 30 行 (-89%), 新增:
 *   useSprintBoardForms.ts  — Form + 3 wrapper handlers + 2 useMemo columns
 *   Components/TabItems.tsx — 3 tabs items (list/board/backlog)
 */
import { Typography, Tabs } from 'antd';
import { ProjectOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { useSprintBoardState } from './useSprintBoardState';
import { useSprintBoardForms } from './useSprintBoardForms';
import { SprintModal } from './SprintModal';
import { buildTabItems } from './Components/TabItems';

const { Title } = Typography;

export default function SprintBoardPage() {
  const s = useSprintBoardState();
  const {
    form, handleOpenCreate, handleSave,
    sprintColumns, backlogColumns,
  } = useSprintBoardForms({ state: s });

  const tabItems = buildTabItems({
    state: s, sprintColumns, backlogColumns, handleOpenCreate,
  });

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.md }}>
        <ProjectOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        Sprint 管理
      </Title>

      <Tabs activeKey={s.activeTab} onChange={s.setActiveTab} items={tabItems} />

      <SprintModal
        modalVisible={s.modalVisible}
        editingSprint={s.editingSprint}
        confirmLoading={s.confirmLoading}
        form={form}
        onOk={handleSave}
        onCancel={() => s.setModalVisible(false)}
      />
    </div>
  );
}
