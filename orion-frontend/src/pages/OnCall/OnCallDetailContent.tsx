/**
 * OnCallDetailContent.tsx - OnCall 详情 Drawer 内容
 * 抽取自 OnCall/index.tsx (P2-9 Phase 78)
 */
import React from 'react';
import { Typography, Descriptions, Space, Tag, Badge, Avatar, Timeline, Empty } from 'antd';
import {
  GlobalOutlined,
  CalendarOutlined,
  TeamOutlined,
  SwapOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import { rotationTypeLabel, rotationTypeColor } from './constants';
import type { OnCallSchedule, OnCallAssignment, OnCallOverride, CurrentOnCallResult } from '@/api/oncall';

const { Title, Text } = Typography;

interface OnCallDetailContentProps {
  selectedSchedule: OnCallSchedule | null;
  currentOnCall: Record<string, CurrentOnCallResult>;
  resolveUserName: (userId: string) => string;
  getAssignmentsForSchedule: (scheduleId: string) => OnCallAssignment[];
  getOverridesForSchedule: (scheduleId: string) => OnCallOverride[];
}

export const OnCallDetailContent: React.FC<OnCallDetailContentProps> = ({
  selectedSchedule,
  currentOnCall,
  resolveUserName,
  getAssignmentsForSchedule,
  getOverridesForSchedule,
}) => {
  if (!selectedSchedule) return null;
  const schedule = selectedSchedule;
  const oncall = currentOnCall[schedule.id];
  const assignments = getAssignmentsForSchedule(schedule.id);
  const scheduleOverrides = getOverridesForSchedule(schedule.id);

  return (
    <div>
      {/* Basic Info */}
      <Descriptions
        column={2}
        bordered
        size="small"
        title="基本信息"
        style={{ marginBottom: spacing.lg }}
      >
        <Descriptions.Item label="排班名称">{schedule.name}</Descriptions.Item>
        <Descriptions.Item label="轮换方式">
          <Tag color={rotationTypeColor[schedule.rotationType]}>
            {rotationTypeLabel[schedule.rotationType]}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="时区">
          <GlobalOutlined /> {schedule.timezone}
        </Descriptions.Item>
        <Descriptions.Item label="轮换开始时间">
          {schedule.rotationStartHour}:00
        </Descriptions.Item>
        <Descriptions.Item label="当前值班">
          {oncall?.primaryUserId ? (
            <Space>
              <Badge status={oncall.isOnCall ? 'success' : 'default'} />
              {resolveUserName(oncall.primaryUserId)}
            </Space>
          ) : (
            '-'
          )}
        </Descriptions.Item>
        <Descriptions.Item label="团队成员">
          <Space wrap>
            {schedule.teamMembers.map((uid) => (
              <Tag key={uid} icon={<UserOutlined />}>
                {resolveUserName(uid)}
              </Tag>
            ))}
          </Space>
        </Descriptions.Item>
      </Descriptions>

      {/* Upcoming Shifts */}
      <Title level={5}>
        <CalendarOutlined /> 即将到来的排班
      </Title>
      {assignments.length > 0 ? (
        <Timeline
          style={{ marginBottom: spacing.lg }}
          items={assignments.map((a, idx) => {
            const isCurrent = oncall?.primaryUserId === a.userId;
            return {
              color: isCurrent ? 'green' : idx === 0 ? 'blue' : 'gray',
              children: (
                <Space direction="vertical" size={0}>
                  <Space>
                    <Avatar
                      size="small"
                      icon={<UserOutlined />}
                      style={{
                        backgroundColor: isCurrent ? colors.success[500] : colors.primary[500],
                      }}
                    />
                    <Text strong={isCurrent}>{resolveUserName(a.userId)}</Text>
                    {isCurrent && (
                      <Badge
                        status="success"
                        text={
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            当前值班
                          </Text>
                        }
                      />
                    )}
                  </Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {dayjs(a.startTime).format('YYYY-MM-DD HH:mm')} 至{' '}
                    {dayjs(a.endTime).format('YYYY-MM-DD HH:mm')}
                  </Text>
                </Space>
              ),
            };
          })}
        />
      ) : (
        <Empty description="暂无排班记录" style={{ marginBottom: spacing.lg }} />
      )}

      {/* Escalation Rules */}
      {schedule.escalations && schedule.escalations.length > 0 && (
        <>
          <Title level={5}>
            <TeamOutlined /> 升级规则
          </Title>
          <Descriptions column={1} bordered size="small" style={{ marginBottom: spacing.lg }}>
            {schedule.escalations.map((rule) => (
              <Descriptions.Item key={rule.level} label={`第 ${rule.level} 级`}>
                {rule.timeoutMinutes} 分钟未响应时升级至:
                <Space style={{ marginLeft: spacing.sm }}>
                  {rule.targets.map((t) => (
                    <Tag key={t}>{resolveUserName(t)}</Tag>
                  ))}
                </Space>
              </Descriptions.Item>
            ))}
          </Descriptions>
        </>
      )}

      {/* Active Overrides */}
      {scheduleOverrides.length > 0 && (
        <>
          <Title level={5}>
            <SwapOutlined /> 代班记录
          </Title>
          <Timeline
            items={scheduleOverrides.map((o) => ({
              color: 'orange',
              children: (
                <Space direction="vertical" size={0}>
                  <Text>
                    <Tag color="orange">代班</Tag>
                    {resolveUserName(o.originalUserId)} {'->'} {resolveUserName(o.overrideUserId)}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {dayjs(o.startTime).format('YYYY-MM-DD HH:mm')} 至{' '}
                    {dayjs(o.endTime).format('YYYY-MM-DD HH:mm')}
                  </Text>
                  {o.reason && <Text type="secondary">原因: {o.reason}</Text>}
                </Space>
              ),
            }))}
          />
        </>
      )}
    </div>
  );
};
