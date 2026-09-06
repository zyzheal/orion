/**
 * Sprint Board Page
 *
 * 拆分结构（P2-9 Phase 35）:
 * - useSprintBoardState.tsx: 全部 state + 4 loader + 10 handler + burndownPercent memo
 * - constants.ts: 状态/优先级/看板列 映射常量
 * - SprintColumns.tsx: buildSprintColumns + buildBacklogColumns + BacklogItem 类型
 * - KanbanBoard.tsx: renderKanbanBoard 抽取的看板渲染组件
 * - BurndownChart.tsx: renderBurndown 抽取的燃尽图组件
 * - SprintModal.tsx: Sprint 创建/编辑 Modal (form instance owned here)
 */
import { useMemo } from 'react';
import { Typography, Card, Space, Table, Button, Select, Tabs, Row, Col, Tag, Form } from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  ProjectOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';

import dayjs from 'dayjs';
import { colors, spacing, componentRadius, shadows } from '@/tokens';
import { useSprintBoardState } from './useSprintBoardState';
import { buildSprintColumns, buildBacklogColumns } from './SprintColumns';
import { KanbanBoard } from './KanbanBoard';
import { BurndownChart } from './BurndownChart';
import { SprintModal } from './SprintModal';
import { sprintStatusColor, sprintStatusLabel } from './constants';
import type { Sprint } from '@/api/sprints';
import type { BacklogItem } from './SprintColumns';

const { Title, Text } = Typography;

export default function SprintBoardPage() {
  const s = useSprintBoardState();

  // Form instance owned here so SprintModal can use it and this wrapper can validateFields
  const [form] = Form.useForm();

  // ── Wrapper handlers that call form.validateFields() / setFieldsValue() ──

  const handleOpenCreate = () => {
    s.setEditingSprint(null);
    form.resetFields();
    s.setModalVisible(true);
  };

  const handleOpenEdit = (record: import('@/api/sprints').Sprint) => {
    s.setEditingSprint(record);
    form.setFieldsValue({
      name: record.name,
      goal: record.goal,
      dateRange: [dayjs(record.startDate), dayjs(record.endDate)],
      capacity: record.capacity,
      status: record.status,
    });
    s.setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      await s.handleSave(values);
      form.resetFields();
    } catch {}
  };

  const sprintColumns = useMemo(
    () =>
      buildSprintColumns({
        handleActivate: s.handleActivate,
        handleComplete: s.handleComplete,
        handleEdit: handleOpenEdit,
        handleDelete: s.handleDelete,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.handleActivate, s.handleComplete, s.handleDelete]
  );

  const backlogColumns = useMemo(
    () => buildBacklogColumns({ selectedSprintId: s.selectedSprintId, handleAddToSprint: s.handleAddToSprint }),
    [s.selectedSprintId, s.handleAddToSprint]
  );

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.md }}>
        <ProjectOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        Sprint 管理
      </Title>

      <Tabs
        activeKey={s.activeTab}
        onChange={s.setActiveTab}
        items={[
          {
            key: 'list',
            label: 'Sprint 列表',
            children: (
              <Card
                style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
              >
                <Row justify="space-between" align="middle" style={{ marginBottom: spacing.md }}>
                  <Col>
                    <Space>
                      <Select
                        placeholder="按状态筛选"
                        allowClear
                        style={{ width: 150 }}
                        value={s.statusFilter}
                        onChange={(val) => s.setStatusFilter(val)}
                        options={[
                          { value: 'planning', label: '规划中' },
                          { value: 'active', label: '进行中' },
                          { value: 'completed', label: '已完成' },
                          { value: 'cancelled', label: '已取消' },
                        ]}
                      />
                      <Button icon={<ReloadOutlined />} onClick={s.fetchSprints}>
                        刷新
                      </Button>
                    </Space>
                  </Col>
                  <Col>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
                      创建 Sprint
                    </Button>
                  </Col>
                </Row>
                <Table<Sprint>
                  columns={sprintColumns}
                  dataSource={s.sprints}
                  rowKey="id"
                  loading={s.loading}
                  pagination={{ current: 1, pageSize: 20, total: s.sprints.length }}
                />
              </Card>
            ),
          },
          {
            key: 'board',
            label: 'Sprint 看板',
            children: (
              <div>
                <Card
                  style={{
                    borderRadius: componentRadius.card,
                    boxShadow: shadows.card,
                    marginBottom: spacing.md,
                  }}
                  styles={{ body: { padding: `${spacing.sm}px ${spacing.md}px` } }}
                >
                  <Row justify="space-between" align="middle">
                    <Col>
                      <Space>
                        <Text strong>选择 Sprint:</Text>
                        <Select
                          placeholder="选择 Sprint 查看看板"
                          style={{ width: 260 }}
                          value={s.selectedSprintId}
                          onChange={(val) => s.setSelectedSprintId(val)}
                          loading={s.loading}
                        >
                          {s.sprints.map((sp) => (
                            <Select.Option key={sp.id} value={sp.id}>
                              <Space>
                                <Tag color={sprintStatusColor[sp.status]} style={{ marginRight: 0 }}>
                                  {sprintStatusLabel[sp.status]}
                                </Tag>
                                {sp.name}
                              </Space>
                            </Select.Option>
                          ))}
                        </Select>
                      </Space>
                    </Col>
                    <Col>
                      {s.selectedSprintId && (
                        <Button
                          icon={<ReloadOutlined />}
                          onClick={() => s.fetchBoard(s.selectedSprintId!)}
                        >
                          刷新
                        </Button>
                      )}
                    </Col>
                  </Row>
                </Card>

                <Row gutter={spacing.md}>
                  <Col span={18}>
                    <Card
                      style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
                      styles={{ body: { padding: spacing.md } }}
                    >
                      <KanbanBoard
                        selectedSprintId={s.selectedSprintId}
                        boardData={s.boardData}
                        boardLoading={s.boardLoading}
                        handleRemoveTicket={s.handleRemoveTicket}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <BurndownChart
                      selectedSprintId={s.selectedSprintId}
                      burndownData={s.burndownData}
                      burndownLoading={s.burndownLoading}
                      burndownPercent={s.burndownPercent}
                    />
                  </Col>
                </Row>
              </div>
            ),
          },
          {
            key: 'backlog',
            label: '待办列表',
            children: (
              <Card style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}>
                <Row justify="space-between" align="middle" style={{ marginBottom: spacing.md }}>
                  <Col>
                    <Space>
                      <UnorderedListOutlined style={{ color: colors.primary[500] }} />
                      <Text strong>待办工单（未分配到 Sprint）</Text>
                      {s.selectedSprintId && (
                        <Tag color="blue">
                          目标 Sprint:{' '}
                          {s.sprints.find((sp) => sp.id === s.selectedSprintId)?.name ?? s.selectedSprintId}
                        </Tag>
                      )}
                    </Space>
                  </Col>
                  <Col>
                    <Button icon={<ReloadOutlined />} onClick={s.fetchBacklog}>
                      刷新
                    </Button>
                  </Col>
                </Row>
                <Table<BacklogItem>
                  columns={backlogColumns}
                  dataSource={s.backlog}
                  rowKey="ticketId"
                  loading={s.backlogLoading}
                  pagination={{ current: 1, pageSize: 20, total: s.backlog.length }}
                />
              </Card>
            ),
          },
        ]}
      />

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
