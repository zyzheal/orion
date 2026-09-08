import { Typography, Card, Space, Table, Button, Select, Row, Col, Tag } from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { colors, spacing, componentRadius, shadows } from '@/tokens';
import { KanbanBoard } from '../KanbanBoard';
import { BurndownChart } from '../BurndownChart';
import { sprintStatusColor, sprintStatusLabel } from '../constants';
import type { Sprint } from '@/api/sprints';
import type { BacklogItem } from '../SprintColumns';
import type { useSprintBoardState } from '../useSprintBoardState';

type State = ReturnType<typeof useSprintBoardState>;

interface Props {
  state: State;
  sprintColumns: any;
  backlogColumns: any;
  handleOpenCreate: () => void;
}

const { Text } = Typography;

export function buildTabItems({ state: s, sprintColumns, backlogColumns, handleOpenCreate }: Props) {
  return [
    {
      key: 'list',
      label: 'Sprint 列表',
      children: (
        <Card style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}>
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
  ];
}
