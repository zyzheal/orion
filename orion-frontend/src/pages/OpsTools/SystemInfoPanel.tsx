/**
 * 运维工具 - 系统信息概览卡片
 */
import React from 'react';
import { Card, Row, Col, Statistic } from 'antd';
import { colors, spacing, componentRadius } from '@/tokens';
import type { SystemInfo } from '@/api/ops-tools';

interface SystemInfoPanelProps {
  systemInfo: SystemInfo;
}

export const SystemInfoPanel: React.FC<SystemInfoPanelProps> = ({ systemInfo }) => (
  <Card style={{ marginBottom: spacing.md, borderRadius: componentRadius.card }}>
    <Row gutter={[16, 16]}>
      <Col span={4}>
        <Statistic
          title="平台版本"
          value={systemInfo.platformVersion}
          valueStyle={{ fontSize: 16 }}
        />
      </Col>
      <Col span={4}>
        <Statistic title="运行时长" value={systemInfo.uptime} valueStyle={{ fontSize: 16 }} />
      </Col>
      <Col span={4}>
        <Statistic
          title="定时任务"
          value={`${systemInfo.enabledCronJobs}/${systemInfo.totalCronJobs}`}
          valueStyle={{ color: colors.success[500], fontSize: 16 }}
        />
      </Col>
      <Col span={4}>
        <Statistic
          title="Tagent 在线"
          value={`${systemInfo.onlineTagentClients}/${systemInfo.totalTagentClients}`}
          valueStyle={{ color: colors.success[500], fontSize: 16 }}
        />
      </Col>
      <Col span={4}>
        <Statistic
          title="MQ 队列"
          value={systemInfo.mqQueueCount}
          valueStyle={{ fontSize: 16 }}
        />
      </Col>
      <Col span={4}>
        <Statistic
          title="系统模块"
          value={systemInfo.totalModules}
          valueStyle={{ fontSize: 16 }}
        />
      </Col>
    </Row>
  </Card>
);
