/**
 * IaC Plan Viewer - Plan list with resource changes, cost estimate, AI review score
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Row,
  Col,
  Statistic,
  Descriptions,
  Progress,
  message,
} from 'antd';
import { colors, spacing } from '@/tokens';
import {
  ReloadOutlined,
  FileSearchOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import StatusBadge, { type StatusType } from '@/components/StatusBadge';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import { getWorkspaces, getWorkspacePlans, type IaCPlan, type IaCResourceChange } from '@/api/iac';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

const actionColorMap: Record<string, string> = {
  create: 'green',
  update: 'blue',
  delete: 'red',
  replace: 'orange',
  read: 'default',
};

const PlanViewer: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<IaCPlan[]>([]);
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [selectedPlan, setSelectedPlan] = useState<IaCPlan | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const wsRes = await getWorkspaces();
      const wsList = Array.isArray(wsRes.data) ? wsRes.data : [];
      setWorkspaces(wsList.map((w: { id: string; name: string }) => ({ id: w.id, name: w.name })));

      // Collect plans from all workspaces
      const allPlans: IaCPlan[] = [];
      for (const ws of wsList.slice(0, 5)) {
        try {
          const planRes = await getWorkspacePlans(ws.id);
          if (Array.isArray(planRes.data)) {
            allPlans.push(...planRes.data);
          }
        } catch (error: unknown) {
          // Workspace may not have plans - silently ignore
        }
      }
      setPlans(allPlans);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`Failed to load plans：${error.message}`);
      } else {
        message.error('Failed to load plans');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredPlans = useMemo(() => {
    return plans.filter((plan) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!plan.id.toLowerCase().includes(q) && !plan.workspaceId.toLowerCase().includes(q))
          return false;
      }
      if (filters.status && filters.status !== 'all' && plan.status !== filters.status)
        return false;
      return true;
    });
  }, [searchQuery, filters, plans]);

  const getWorkspaceName = (workspaceId: string) => {
    return workspaces.find((w) => w.id === workspaceId)?.name || workspaceId;
  };

  const createCount = (changes: IaCResourceChange[]) =>
    changes.filter((c) => c.action === 'create').length;
  const updateCount = (changes: IaCResourceChange[]) =>
    changes.filter((c) => c.action === 'update').length;
  const deleteCount = (changes: IaCResourceChange[]) =>
    changes.filter((c) => c.action === 'delete').length;

  const columns: TableColumn<IaCPlan>[] = [
    {
      key: 'id',
      title: '计划 ID',
      dataIndex: 'id',
      width: 180,
      sortable: true,
      render: (v: unknown) => (
        <Text code style={{ fontSize: spacing[3] }}>
          {String(v).slice(0, 12)}...
        </Text>
      ),
    },
    {
      key: 'workspace',
      title: '工作空间',
      dataIndex: 'workspaceId',
      width: 160,
      render: (v: unknown) => <Tag color="blue">{getWorkspaceName(String(v))}</Tag>,
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: unknown) => <StatusBadge status={String(v) as StatusType} size="small" />,
    },
    {
      key: 'changes',
      title: '变更',
      dataIndex: 'resourceChanges',
      width: 200,
      render: (v: unknown) => {
        const changes = Array.isArray(v) ? v : [];
        return (
          <Space size={4} wrap>
            {createCount(changes) > 0 && <Tag color="green">+{createCount(changes)}</Tag>}
            {updateCount(changes) > 0 && <Tag color="blue">~{updateCount(changes)}</Tag>}
            {deleteCount(changes) > 0 && <Tag color="red">-{deleteCount(changes)}</Tag>}
            {changes.length === 0 && <Text type="secondary">0</Text>}
          </Space>
        );
      },
    },
    {
      key: 'costEstimate',
      title: '费用预估',
      dataIndex: 'costEstimate',
      width: 120,
      sortable: true,
      render: (v: unknown) =>
        v !== null && v !== undefined ? (
          <Text strong style={{ color: Number(v) > 100 ? colors.error[600] : colors.success[600] }}>
            ${Number(v).toFixed(2)}
          </Text>
        ) : (
          <Text type="secondary">N/A</Text>
        ),
    },
    {
      key: 'aiReview',
      title: 'AI 审查',
      dataIndex: 'aiReview',
      width: 120,
      render: (v: unknown) => {
        if (!v || typeof v !== 'object') return <Text type="secondary">未审查</Text>;
        const review = v as { score: number };
        const score = review.score;
        return (
          <Progress
            type="circle"
            size={32}
            percent={score}
            strokeColor={
              score >= 80
                ? colors.success[500]
                : score >= 60
                  ? colors.warning[500]
                  : colors.error[400]
            }
            format={() => `${score}`}
          />
        );
      },
    },
    {
      key: 'createdAt',
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
      sortable: true,
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {dayjs(String(v)).fromNow()}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 160,
      render: (_: unknown, record: any) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<InfoCircleOutlined />}
            onClick={() => setSelectedPlan(record)}
          >
            详情
          </Button>
          {record.status === 'pending' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                style={{ color: colors.success[500] }}
              >
                应用
              </Button>
              <Button type="link" size="small" icon={<CloseCircleOutlined />} danger>
                丢弃
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  const filterDefs: FilterDefinition[] = [
    {
      key: 'status',
      label: '状态',
      options: [
        { label: '全部', value: 'all' },
        { label: 'Pending', value: 'pending' },
        { label: 'Applied', value: 'applied' },
        { label: 'Discarded', value: 'discarded' },
      ],
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <FileSearchOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            计划查看
          </Title>
          <Text type="secondary">IaC 变更计划与审查</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
          刷新
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="总计划数" value={plans.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="待处理" value={plans.filter((p) => p.status === 'pending').length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已应用" value={plans.filter((p) => p.status === 'applied').length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均 AI 评分"
              value={
                plans.filter((p) => p.aiReview).length > 0
                  ? (
                      plans
                        .filter((p) => p.aiReview)
                        .reduce((sum, p) => sum + (p.aiReview?.score || 0), 0) /
                      plans.filter((p) => p.aiReview).length
                    ).toFixed(0)
                  : 'N/A'
              }
              suffix="分"
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <div style={{ marginBottom: 16 }}>
          <SearchFilterBar
            onSearch={setSearchQuery}
            onFilter={setFilters}
            filters={filterDefs}
            searchPlaceholder="搜索计划..."
          />
        </div>
        <Table
          columns={columns}
          dataSource={filteredPlans}
          loading={loading}
          rowKey="id"
          size="middle"
          striped
        />
      </Card>

      {/* Plan Detail Modal */}
      {selectedPlan && (
        <Card
          title="计划详情"
          style={{ marginTop: 16 }}
          extra={<Button onClick={() => setSelectedPlan(null)}>关闭</Button>}
        >
          <Descriptions column={2} bordered>
            <Descriptions.Item label="计划 ID">{selectedPlan.id}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <StatusBadge status={selectedPlan.status as StatusType} />
            </Descriptions.Item>
            <Descriptions.Item label="工作空间">
              {getWorkspaceName(selectedPlan.workspaceId)}
            </Descriptions.Item>
            <Descriptions.Item label="费用预估">
              {selectedPlan.costEstimate ? `$${selectedPlan.costEstimate.toFixed(2)}` : 'N/A'}
            </Descriptions.Item>
          </Descriptions>

          {selectedPlan.aiReview && (
            <Card title="AI 审查报告" style={{ marginTop: 16 }} size="small">
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic title="安全评分" value={selectedPlan.aiReview.score} suffix="/ 100" />
                </Col>
                <Col span={18}>
                  {selectedPlan.aiReview.risks.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <Text strong>风险:</Text>
                      <ul>
                        {selectedPlan.aiReview.risks.map((r, i) => (
                          <li key={i}>
                            <Text type="danger">{r}</Text>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {selectedPlan.aiReview.suggestions.length > 0 && (
                    <div>
                      <Text strong>建议:</Text>
                      <ul>
                        {selectedPlan.aiReview.suggestions.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Col>
              </Row>
            </Card>
          )}

          {selectedPlan.resourceChanges.length > 0 && (
            <Card title="资源变更" style={{ marginTop: 16 }} size="small">
              <Table
                columns={[
                  {
                    key: 'address',
                    title: '资源',
                    dataIndex: 'address',
                    render: (v: unknown) => <Text code>{String(v)}</Text>,
                  },
                  {
                    key: 'action',
                    title: '操作',
                    dataIndex: 'action',
                    render: (v: unknown) => (
                      <Tag color={actionColorMap[String(v)] || 'default'}>{String(v)}</Tag>
                    ),
                  },
                  {
                    key: 'type',
                    title: '类型',
                    dataIndex: 'type',
                    render: (v: unknown) => <Tag>{String(v)}</Tag>,
                  },
                ]}
                dataSource={selectedPlan.resourceChanges as unknown as Record<string, unknown>[]}
                rowKey="address"
                size="small"
                pagination={false}
              />
            </Card>
          )}
        </Card>
      )}
    </div>
  );
};

export default PlanViewer;
