/**
 * Incident Tabs — tab content components for the Incident Management page.
 * Extracted from index.tsx to reduce line count and improve readability.
 *
 * Exports five tab content components:
 * - StatsBar: KPI cards row (total, severity, open, MTTR)
 * - IncidentListTab: filter bar + table with pagination
 * - IncidentDetailTab: header actions + info descriptions + status transitions
 * - IncidentTimelineTab: timeline list with add-event controls
 * - IncidentPostmortemTab: postmortem viewer + AI draft preview
 */
import React from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Timeline,
  Empty,
  Form,
  Descriptions,
  Badge,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ArrowUpOutlined,
  UserOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  BugOutlined,
  FireOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import Table from '@/components/Table';
import SearchFilterBar from '@/components/SearchFilterBar';
import MetricCard from '@/components/MetricCard';
import { colors, spacing, radius, shadows } from '@/tokens';
import type {
  Incident,
  IncidentStats,
  TimelineEvent,
  Postmortem,
  PostmortemDraft,
} from '@/api/incident';
import type { TableColumn } from '@/components/Table';
import dayjs from 'dayjs';
import {
  severityConfig,
  statusConfig,
  priorityConfig,
  eventTypeConfig,
  statusTransitions,
  postmortemStatusConfig,
} from './config';
import { incidentFilterDefs } from './columns';

const { Title, Text } = Typography;

// ============================================================================
// StatsBar
// ============================================================================

export interface StatsBarProps {
  stats: IncidentStats | null;
  statsLoading: boolean;
}

export const StatsBar: React.FC<StatsBarProps> = ({ stats, statsLoading }) => {
  const criticalCount = stats?.bySeverity?.critical ?? 0;
  const highCount = stats?.bySeverity?.high ?? 0;
  const openCount = stats?.byStatus?.open ?? 0;
  const mttr = stats?.mttr ?? 0;

  return (
    <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.lg }}>
      <Col xs={24} sm={12} md={6}>
        <MetricCard
          title="总事件数"
          value={stats?.total ?? 0}
          icon={<BugOutlined style={{ fontSize: 24, color: colors.primary[500] }} />}
          loading={statsLoading}
          color={colors.primary[500]}
        />
      </Col>
      <Col xs={24} sm={12} md={6}>
        <MetricCard
          title="严重/高"
          value={`${criticalCount}/${highCount}`}
          icon={<FireOutlined style={{ fontSize: 24, color: colors.error[500] }} />}
          loading={statsLoading}
          color={colors.error[500]}
        />
      </Col>
      <Col xs={24} sm={12} md={6}>
        <MetricCard
          title="待处理"
          value={openCount}
          icon={
            <ExclamationCircleOutlined style={{ fontSize: 24, color: colors.warning[500] }} />
          }
          loading={statsLoading}
          color={colors.warning[500]}
        />
      </Col>
      <Col xs={24} sm={12} md={6}>
        <MetricCard
          title="平均恢复时间"
          value={mttr > 0 ? `${Math.round(mttr)}min` : '-'}
          icon={<ClockCircleOutlined style={{ fontSize: 24, color: colors.success[500] }} />}
          loading={statsLoading}
          color={colors.success[500]}
        />
      </Col>
    </Row>
  );
};

// ============================================================================
// IncidentListTab
// ============================================================================

export interface IncidentListTabProps {
  incidents: Incident[];
  loading: boolean;
  page: number;
  pageSize: number;
  total: number;
  columns: TableColumn<Incident>[];
  searchQuery: string;
  filters: Record<string, string | string[] | undefined>;
  stats: IncidentStats | null;
  statsLoading: boolean;
  setSearchQuery: (v: string) => void;
  setFilters: (v: Record<string, string | string[] | undefined>) => void;
  setPage: (v: number) => void;
  setPageSize: (v: number) => void;
  loadIncidents: () => void;
  loadStats: () => void;
  setCreateModalOpen: (v: boolean) => void;
}

export const IncidentListTab: React.FC<IncidentListTabProps> = (props) => (
  <div>
    <StatsBar stats={props.stats} statsLoading={props.statsLoading} />
    <Card
      style={{ borderRadius: radius.lg, boxShadow: shadows.card }}
      styles={{ body: { padding: spacing.lg } }}
    >
      <SearchFilterBar
        onSearch={props.setSearchQuery}
        onFilter={props.setFilters}
        filters={incidentFilterDefs}
        searchPlaceholder="搜索事件标题、描述、负责人..."
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                props.loadIncidents();
                props.loadStats();
              }}
            >
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => props.setCreateModalOpen(true)}
            >
              创建事件
            </Button>
          </Space>
        }
      />
      <div style={{ marginTop: spacing.md }}>
        <Table<Incident>
          columns={props.columns}
          dataSource={props.incidents}
          loading={props.loading}
          rowKey="id"
          pagination={{ current: props.page, pageSize: props.pageSize, total: props.total }}
          showTotal
          pageSizeOptions={[10, 20, 50, 100]}
          onPaginationChange={(p: number, ps: number) => {
            props.setPage(p);
            props.setPageSize(ps);
          }}
        />
      </div>
    </Card>
  </div>
);

// ============================================================================
// IncidentDetailTab
// ============================================================================

export interface IncidentDetailTabProps {
  selectedIncident: Incident | null;
  detailLoading: boolean;
  handleBackToList: () => void;
  handleOpenEdit: (record: Incident) => void;
  handleOpenAssign: () => void;
  handleOpenEscalate: () => void;
  handleStatusChange: (status: string) => void;
}

export const IncidentDetailTab: React.FC<IncidentDetailTabProps> = (props) => {
  const { selectedIncident, detailLoading } = props;
  if (!selectedIncident) return <Empty description="请选择一个事件" />;
  if (detailLoading) {
    return (
      <Card style={{ borderRadius: radius.lg, boxShadow: shadows.card }}>
        <div style={{ textAlign: 'center', padding: spacing.xl }}>
          <Text type="secondary">加载中...</Text>
        </div>
      </Card>
    );
  }
  const incident = selectedIncident;
  const transitions = statusTransitions[incident.status] || [];

  return (
    <div>
      <Card
        style={{ borderRadius: radius.lg, boxShadow: shadows.card, marginBottom: spacing.md }}
        styles={{ body: { padding: spacing.lg } }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: spacing.sm,
          }}
        >
          <div>
            <Space style={{ marginBottom: spacing.sm }}>
              <Button
                icon={<ArrowUpOutlined />}
                onClick={props.handleBackToList}
                style={{ transform: 'rotate(-90deg)' }}
              />
              <Title level={3} style={{ margin: 0 }}>
                {incident.title}
              </Title>
            </Space>
            <Space>
              <Tag color={severityConfig[incident.severity]?.color}>
                {severityConfig[incident.severity]?.label}
              </Tag>
              <Tag color={statusConfig[incident.status]?.color}>
                {statusConfig[incident.status]?.label}
              </Tag>
              {incident.priority && (
                <Tag color={priorityConfig[incident.priority]?.color}>
                  {priorityConfig[incident.priority]?.label}
                </Tag>
              )}
              {incident.sla_breach && <Tag color="red">SLA 违规</Tag>}
            </Space>
          </div>
          <Space wrap>
            <Button icon={<FileTextOutlined />} onClick={() => props.handleOpenEdit(incident)}>
              编辑
            </Button>
            <Button icon={<UserOutlined />} onClick={props.handleOpenAssign}>
              分配指挥官
            </Button>
            <Button icon={<ArrowUpOutlined />} onClick={props.handleOpenEscalate}>
              升级
            </Button>
          </Space>
        </div>
      </Card>

      <Row gutter={[spacing.md, spacing.md]}>
        <Col xs={24} lg={16}>
          <Card
            title="事件信息"
            style={{ borderRadius: radius.lg, boxShadow: shadows.card, marginBottom: spacing.md }}
          >
            <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
              <Descriptions.Item label="类型">{incident.type || '-'}</Descriptions.Item>
              <Descriptions.Item label="严重程度">
                <Tag color={severityConfig[incident.severity]?.color}>
                  {severityConfig[incident.severity]?.label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="优先级">
                {incident.priority ? (
                  <Tag color={priorityConfig[incident.priority]?.color}>
                    {priorityConfig[incident.priority]?.label}
                  </Tag>
                ) : (
                  '-'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusConfig[incident.status]?.color}>
                  {statusConfig[incident.status]?.label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>
                {incident.description || <Text type="secondary">无描述</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="影响">{incident.impact || '-'}</Descriptions.Item>
              <Descriptions.Item label="紧急度">{incident.urgency || '-'}</Descriptions.Item>
              <Descriptions.Item label="负责人">
                {incident.assigned_to || '未分配'}
              </Descriptions.Item>
              <Descriptions.Item label="指挥官">
                {incident.commander_id || '未指定'}
              </Descriptions.Item>
              <Descriptions.Item label="检测来源">
                {incident.detected_by || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="升级层级">
                <Badge
                  count={incident.escalation_level ?? 0}
                  style={{ backgroundColor: colors.primary[500] }}
                />
              </Descriptions.Item>
              <Descriptions.Item label="受影响服务" span={2}>
                {incident.affected_services?.length ? (
                  <Space wrap>
                    {incident.affected_services.map((s) => (
                      <Tag key={s} color="blue">{s}</Tag>
                    ))}
                  </Space>
                ) : (
                  '-'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="标签" span={2}>
                {incident.tags?.length ? (
                  <Space wrap>
                    {incident.tags.map((t) => (
                      <Tag key={t}>{t}</Tag>
                    ))}
                  </Space>
                ) : (
                  '-'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {dayjs(incident.created_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {dayjs(incident.updated_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            title="状态流转"
            style={{ borderRadius: radius.lg, boxShadow: shadows.card, marginBottom: spacing.md }}
          >
            {transitions.length > 0 ? (
              <Space direction="vertical" style={{ width: '100%' }}>
                {transitions.map((t) => (
                  <Button
                    key={t.status}
                    block
                    icon={t.icon}
                    onClick={() => props.handleStatusChange(t.status)}
                  >
                    {t.label}
                  </Button>
                ))}
              </Space>
            ) : (
              <Empty description="无可用状态流转" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

// ============================================================================
// IncidentTimelineTab
// ============================================================================

export interface IncidentTimelineTabProps {
  selectedIncident: Incident | null;
  timeline: TimelineEvent[];
  timelineLoading: boolean;
  setAddEventModalOpen: (v: boolean) => void;
  loadTimeline: (id: string) => void;
}

export const IncidentTimelineTab: React.FC<IncidentTimelineTabProps> = (props) => {
  const { selectedIncident } = props;
  if (!selectedIncident) return <Empty description="请选择一个事件" />;

  return (
    <div>
      <Card
        style={{ borderRadius: radius.lg, boxShadow: shadows.card, marginBottom: spacing.md }}
        styles={{ body: { padding: spacing.lg } }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: spacing.md,
          }}
        >
          <Title level={4} style={{ margin: 0 }}>事件时间线</Title>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => props.loadTimeline(selectedIncident.id)}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => props.setAddEventModalOpen(true)}
            >
              添加记录
            </Button>
          </Space>
        </div>
        {props.timelineLoading ? (
          <div style={{ textAlign: 'center', padding: spacing.xl }}>
            <Text type="secondary">加载中...</Text>
          </div>
        ) : props.timeline.length > 0 ? (
          <Timeline
            items={props.timeline.map((event) => {
              const cfg = eventTypeConfig[event.event_type] || { color: 'gray', label: event.event_type };
              return {
                color: cfg.color,
                children: (
                  <div>
                    <Space style={{ marginBottom: spacing.xs }}>
                      <Tag color={cfg.color}>{cfg.label}</Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {dayjs(event.created_at).format('YYYY-MM-DD HH:mm')}
                      </Text>
                      {event.created_by && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          by {event.created_by}
                        </Text>
                      )}
                    </Space>
                    <Text>{event.description}</Text>
                  </div>
                ),
              };
            })}
          />
        ) : (
          <Empty description="暂无时间线记录" image={Empty.PRESENTED_IMAGE_SIMPLE}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => props.setAddEventModalOpen(true)}
            >
              添加第一条记录
            </Button>
          </Empty>
        )}
      </Card>
    </div>
  );
};

// ============================================================================
// IncidentPostmortemTab
// ============================================================================

export interface IncidentPostmortemTabProps {
  selectedIncident: Incident | null;
  postmortem: Postmortem | null;
  postmortemLoading: boolean;
  aiDraft: PostmortemDraft | null;
  aiDraftLoading: boolean;
  setPostmortemModalOpen: (v: boolean) => void;
  handleGenerateDraft: () => void;
  handlePublishPostmortem: () => void;
  handleFillDraftToForm: () => void;
}

export const IncidentPostmortemTab: React.FC<IncidentPostmortemTabProps> = (props) => {
  const { selectedIncident } = props;
  if (!selectedIncident) return <Empty description="请选择一个事件" />;

  return (
    <div>
      <Card
        style={{ borderRadius: radius.lg, boxShadow: shadows.card, marginBottom: spacing.md }}
        styles={{ body: { padding: spacing.lg } }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: spacing.md,
          }}
        >
          <Title level={4} style={{ margin: 0 }}>复盘文档</Title>
          <Space>
            {!props.postmortem && (
              <Button
                type="default"
                icon={<RobotOutlined />}
                loading={props.aiDraftLoading}
                onClick={props.handleGenerateDraft}
                style={{ borderColor: colors.purple[500], color: colors.purple[500] }}
              >
                AI 生成复盘草稿
              </Button>
            )}
            {props.postmortem && props.postmortem.status === 'draft' && (
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={props.handlePublishPostmortem}
              >
                发布复盘
              </Button>
            )}
          </Space>
        </div>
        {props.postmortemLoading ? (
          <div style={{ textAlign: 'center', padding: spacing.xl }}>
            <Text type="secondary">加载中...</Text>
          </div>
        ) : props.postmortem ? (
          <div>
            <Descriptions column={1} bordered size="small" style={{ marginBottom: spacing.md }}>
              <Descriptions.Item label="标题">{props.postmortem.title}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={postmortemStatusConfig[props.postmortem.status]?.color || 'default'}>
                  {postmortemStatusConfig[props.postmortem.status]?.label || props.postmortem.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="摘要">{props.postmortem.summary}</Descriptions.Item>
              <Descriptions.Item label="根因分析">{props.postmortem.root_cause}</Descriptions.Item>
              {props.postmortem.impact_description && (
                <Descriptions.Item label="影响描述">{props.postmortem.impact_description}</Descriptions.Item>
              )}
              {props.postmortem.timeline_summary && (
                <Descriptions.Item label="时间线摘要">{props.postmortem.timeline_summary}</Descriptions.Item>
              )}
              {props.postmortem.lessons_learned && (
                <Descriptions.Item label="经验教训">{props.postmortem.lessons_learned}</Descriptions.Item>
              )}
              <Descriptions.Item label="行动项">
                {props.postmortem.action_items?.length ? (
                  <ul style={{ margin: 0, paddingLeft: spacing.md }}>
                    {props.postmortem.action_items.map((item: any, idx: number) => (
                      <li key={String(idx)}>{item.description || item}</li>
                    ))}
                  </ul>
                ) : (
                  <Text type="secondary">无</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="创建者">{props.postmortem.created_by}</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {dayjs(props.postmortem.created_at).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
              {props.postmortem.published_at && (
                <Descriptions.Item label="发布时间">
                  {dayjs(props.postmortem.published_at).format('YYYY-MM-DD HH:mm')}
                </Descriptions.Item>
              )}
            </Descriptions>
          </div>
        ) : (
          <div>
            {props.aiDraftLoading && (
              <div style={{ textAlign: 'center', padding: spacing.xl }}>
                <Text type="secondary">AI 正在生成复盘草稿...</Text>
              </div>
            )}
            {props.aiDraft && (
              <Card
                size="small"
                style={{
                  borderRadius: 8,
                  marginBottom: spacing.md,
                  background: 'rgba(114, 46, 209, 0.04)',
                  borderColor: colors.purple[500],
                }}
              >
                <Space direction="vertical" style={{ width: '100%' }} size={8}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Text strong>
                      <RobotOutlined style={{ color: colors.purple[500], marginRight: 6 }} />
                      AI 复盘草稿
                    </Text>
                    <Tag color="purple">AI 生成</Tag>
                  </div>
                  <Descriptions column={1} bordered size="small">
                    <Descriptions.Item label="标题">{props.aiDraft.title}</Descriptions.Item>
                    <Descriptions.Item label="摘要">{props.aiDraft.summary}</Descriptions.Item>
                    <Descriptions.Item label="根因分析">{props.aiDraft.root_cause}</Descriptions.Item>
                    {props.aiDraft.contributing_factors && props.aiDraft.contributing_factors.length > 0 && (
                      <Descriptions.Item label="促成因素">
                        <ul style={{ margin: 0, paddingLeft: spacing.md }}>
                          {props.aiDraft.contributing_factors.map((f, i) => (
                            <li key={String(i)}>{f}</li>
                          ))}
                        </ul>
                      </Descriptions.Item>
                    )}
                    {props.aiDraft.timeline_summary && (
                      <Descriptions.Item label="时间线摘要">{props.aiDraft.timeline_summary}</Descriptions.Item>
                    )}
                    {props.aiDraft.action_items && props.aiDraft.action_items.length > 0 && (
                      <Descriptions.Item label="行动项">
                        <ul style={{ margin: 0, paddingLeft: spacing.md }}>
                          {props.aiDraft.action_items.map((item, i) => (
                            <li key={String(i)}>{item}</li>
                          ))}
                        </ul>
                      </Descriptions.Item>
                    )}
                    {props.aiDraft.lessons_learned && (
                      <Descriptions.Item label="经验教训">{props.aiDraft.lessons_learned}</Descriptions.Item>
                    )}
                  </Descriptions>
                  <Button
                    type="primary"
                    icon={<FileTextOutlined />}
                    onClick={props.handleFillDraftToForm}
                    style={{
                      backgroundColor: colors.purple[500],
                      borderColor: colors.purple[500],
                    }}
                  >
                    使用草稿创建复盘
                  </Button>
                </Space>
              </Card>
            )}
            {!props.aiDraft && !props.aiDraftLoading && (
              <Empty description="暂无复盘文档" image={Empty.PRESENTED_IMAGE_SIMPLE}>
                <Button
                  type="primary"
                  icon={<FileTextOutlined />}
                  onClick={() => props.setPostmortemModalOpen(true)}
                >
                  创建复盘文档
                </Button>
              </Empty>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};
