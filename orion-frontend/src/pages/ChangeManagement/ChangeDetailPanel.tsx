/**
 * Change Detail Panel — full detail view for a selected ChangeRequest
 *
 * Renders: header card, status transitions, AI risk analysis, detail descriptions, timeline.
 * Extracted from index.tsx to reduce main file size.
 */
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Timeline,
  Empty,
  Descriptions,
} from 'antd';
import {
  EditOutlined,
  CloseCircleOutlined,
  PlusOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { colors, spacing, radius, shadows } from '@/tokens';
import type { ChangeRequest, ChangeTimelineEvent, ChangeRiskAnalysis } from '@/api/change';
import {
  typeConfig,
  priorityConfig,
  riskConfig,
  statusConfig,
  statusTransitions,
  eventTypeConfig,
} from './config';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

interface ChangeDetailPanelProps {
  change: ChangeRequest | null;
  detailLoading: boolean;
  riskLoading: boolean;
  riskAnalysis: ChangeRiskAnalysis | null;
  timeline: ChangeTimelineEvent[];
  timelineLoading: boolean;
  onRiskAnalysis: () => void;
  onEdit: () => void;
  onStatusChange: (status: string) => void;
  onAddEvent: () => void;
}

export function ChangeDetailPanel({
  change,
  detailLoading,
  riskLoading,
  riskAnalysis,
  timeline,
  timelineLoading,
  onRiskAnalysis,
  onEdit,
  onStatusChange,
  onAddEvent,
}: ChangeDetailPanelProps) {
  if (!change) {
    return (
      <Card style={{ borderRadius: radius.lg, boxShadow: shadows.card }}>
        <Empty description="请从变更请求列表中选择一条记录查看详情" />
      </Card>
    );
  }

  return (
    <>
      <Card
        style={{
          marginBottom: spacing.md,
          borderRadius: radius.lg,
          boxShadow: shadows.card,
        }}
        loading={detailLoading}
      >
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <div>
            <Title level={3} style={{ marginBottom: spacing.sm }}>
              {change.title}
            </Title>
            <Space size="small" wrap>
              <Tag color={typeConfig[change.type]?.color}>
                {typeConfig[change.type]?.label || change.type}
              </Tag>
              <Tag color={priorityConfig[change.priority]?.color}>
                {priorityConfig[change.priority]?.label || change.priority}
              </Tag>
              <Tag color={riskConfig[change.risk_level]?.color}>
                {riskConfig[change.risk_level]?.label || change.risk_level}
              </Tag>
              <Tag color={statusConfig[change.status]?.color}>
                {statusConfig[change.status]?.label || change.status}
              </Tag>
            </Space>
          </div>
          <Space>
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              loading={riskLoading}
              onClick={onRiskAnalysis}
            >
              AI 风险分析
            </Button>
            <Button icon={<EditOutlined />} onClick={onEdit}>
              编辑
            </Button>
          </Space>
        </div>
      </Card>

      {statusTransitions[change.status]?.length > 0 && (
        <Card
          title="状态流转"
          size="small"
          style={{
            marginBottom: spacing.md,
            borderRadius: radius.lg,
            boxShadow: shadows.card,
          }}
        >
          <Space wrap>
            {statusTransitions[change.status].map((t) => (
              <Button
                key={t.status}
                type={t.danger ? 'default' : 'primary'}
                danger={t.danger}
                icon={t.icon}
                onClick={() => onStatusChange(t.status)}
              >
                {t.label}
              </Button>
            ))}
            {change.status !== 'closed' &&
              change.status !== 'cancelled' &&
              !['rejected'].includes(change.status) && (
                <Button
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => onStatusChange('cancelled')}
                >
                  取消
                </Button>
              )}
          </Space>
        </Card>
      )}

      {riskAnalysis && (
        <Card
          title={
            <span>
              <ThunderboltOutlined
                style={{ marginRight: spacing.xs, color: colors.purple[500] }}
              />
              AI 风险分析报告
            </span>
          }
          extra={
            <Text type="secondary">
              生成于 {dayjs(riskAnalysis.generated_at).format('YYYY-MM-DD HH:mm')}
            </Text>
          }
          style={{
            marginBottom: spacing.md,
            borderRadius: radius.lg,
            boxShadow: shadows.card,
            borderColor: colors.purple[200],
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: spacing.lg,
              alignItems: 'center',
              marginBottom: spacing.md,
              padding: spacing.md,
              background: colors.purple[50],
              borderRadius: radius.md,
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <Text style={{ fontSize: 36, fontWeight: 600, color: colors.purple[600] }}>
                {riskAnalysis.risk_score}
              </Text>
              <Text type="secondary">/ 100</Text>
            </div>
            <div style={{ flex: 1 }}>
              <Text strong>
                风险等级：
                <Tag
                  color={
                    riskAnalysis.risk_level === 'high'
                      ? 'red'
                      : riskAnalysis.risk_level === 'medium'
                        ? 'orange'
                        : 'green'
                  }
                >
                  {riskAnalysis.risk_level.toUpperCase()}
                </Tag>
              </Text>
            </div>
          </div>

          <Text strong style={{ display: 'block', marginBottom: spacing.sm }}>
            风险因素
          </Text>
          <ul style={{ paddingLeft: 20, marginBottom: spacing.md }}>
            {riskAnalysis.factors?.map((factor) => (
              <li key={factor.name}>
                <strong>{factor.name}</strong>（权重 {factor.weight}）：{factor.reason}
              </li>
            ))}
          </ul>

          {riskAnalysis.suggestions?.length > 0 && (
            <>
              <Text strong style={{ display: 'block', marginBottom: spacing.sm }}>
                AI 建议
              </Text>
              <ul style={{ paddingLeft: 20 }}>
                {riskAnalysis.suggestions.map((s, idx) => (
                  <li key={idx} style={{ color: colors.info[600] }}>{s}</li>
                ))}
              </ul>
            </>
          )}
        </Card>
      )}

      <Card
        title="基本信息"
        style={{
          marginBottom: spacing.md,
          borderRadius: radius.lg,
          boxShadow: shadows.card,
        }}
      >
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="变更 ID">{change.id}</Descriptions.Item>
          <Descriptions.Item label="类型">
            <Tag color={typeConfig[change.type]?.color}>
              {typeConfig[change.type]?.label || change.type}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="优先级">
            <Tag color={priorityConfig[change.priority]?.color}>
              {priorityConfig[change.priority]?.label || change.priority}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="风险等级">
            <Tag color={riskConfig[change.risk_level]?.color}>
              {riskConfig[change.risk_level]?.label || change.risk_level}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={statusConfig[change.status]?.color}>
              {statusConfig[change.status]?.label || change.status}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="分类">{change.category || '-'}</Descriptions.Item>
          <Descriptions.Item label="申请人">
            {change.requester_id || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="负责人">
            {change.assigned_to || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="审批人">
            {change.approved_by || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="审批时间">
            {change.approved_at
              ? dayjs(change.approved_at).format('YYYY-MM-DD HH:mm')
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="计划开始">
            {change.scheduled_start
              ? dayjs(change.scheduled_start).format('YYYY-MM-DD HH:mm')
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="计划结束">
            {change.scheduled_end
              ? dayjs(change.scheduled_end).format('YYYY-MM-DD HH:mm')
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="实际开始">
            {change.actual_start
              ? dayjs(change.actual_start).format('YYYY-MM-DD HH:mm')
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="实际结束">
            {change.actual_end
              ? dayjs(change.actual_end).format('YYYY-MM-DD HH:mm')
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="描述" span={2}>
            {change.description || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="影响描述" span={2}>
            {change.impact_description || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="实施计划" span={2}>
            {change.implementation_plan || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="回滚计划" span={2}>
            {change.rollback_plan || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="受影响服务" span={2}>
            {change.affected_services?.length ? (
              <Space size={4} wrap>
                {change.affected_services.map((s) => (
                  <Tag key={s} color="blue">{s}</Tag>
                ))}
              </Space>
            ) : (
              '-'
            )}
          </Descriptions.Item>
          {change.rejection_reason && (
            <Descriptions.Item label="拒绝原因" span={2}>
              <Text type="danger">{change.rejection_reason}</Text>
            </Descriptions.Item>
          )}
          <Descriptions.Item label="创建时间">
            {dayjs(change.created_at).format('YYYY-MM-DD HH:mm')}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {dayjs(change.updated_at).format('YYYY-MM-DD HH:mm')}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        title="变更时间线"
        extra={
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={onAddEvent}
          >
            添加事件
          </Button>
        }
        style={{
          borderRadius: radius.lg,
          boxShadow: shadows.card,
        }}
      >
        {timelineLoading ? (
          <div style={{ textAlign: 'center', padding: spacing.lg }}>
            <Text type="secondary">加载中...</Text>
          </div>
        ) : timeline.length > 0 ? (
          <Timeline
            items={timeline.map((event) => {
              const cfg = eventTypeConfig[event.event_type] || {
                color: 'blue',
                label: event.event_type,
              };
              return {
                color: cfg.color,
                children: (
                  <div>
                    <div style={{ marginBottom: spacing.xs }}>
                      <Tag color={cfg.color}>{cfg.label}</Tag>
                      <Text type="secondary" style={{ marginLeft: spacing.sm, fontSize: 12 }}>
                        {dayjs(event.created_at).format('YYYY-MM-DD HH:mm')}
                      </Text>
                      {event.created_by && (
                        <Text type="secondary" style={{ marginLeft: spacing.sm, fontSize: 12 }}>
                          by {event.created_by}
                        </Text>
                      )}
                    </div>
                    <div>{event.description}</div>
                  </div>
                ),
              };
            })}
          />
        ) : (
          <Empty description="暂无时间线事件" />
        )}
      </Card>
    </>
  );
}
