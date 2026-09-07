/**
 * TenantQuotaPage Detail Modal
 * 抽取自 index.tsx (P2-9 Phase 136)
 */
import React from 'react';
import { Modal, Button, Descriptions, Tag } from 'antd';
import type { QuotaPlan } from '@/api/tenantQuota';
import { PLAN_STATUS } from '../constants';

interface DetailModalProps {
  selectedPlan: QuotaPlan | null;
  detailOpen: boolean;
  setDetailOpen: (v: boolean) => void;
}

export const DetailModal: React.FC<DetailModalProps> = ({
  selectedPlan,
  detailOpen,
  setDetailOpen,
}) => (
  <Modal
    title="计划详情"
    open={detailOpen}
    onCancel={() => setDetailOpen(false)}
    footer={<Button onClick={() => setDetailOpen(false)}>关闭</Button>}
    width={600}
  >
    {selectedPlan && (
      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label="计划名称">{selectedPlan.name}</Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag color={PLAN_STATUS[selectedPlan.status]?.color}>
            {PLAN_STATUS[selectedPlan.status]?.label || selectedPlan.status}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="SLA">{selectedPlan.slaTier}</Descriptions.Item>
        {selectedPlan.description && (
          <Descriptions.Item label="描述">{selectedPlan.description}</Descriptions.Item>
        )}
        <Descriptions.Item label="API 每分钟">{selectedPlan.apiRateLimitPerMin}</Descriptions.Item>
        <Descriptions.Item label="API 每小时">{selectedPlan.apiRateLimitPerHour}</Descriptions.Item>
        <Descriptions.Item label="最大 CI 任务数">{selectedPlan.maxCIs}</Descriptions.Item>
        <Descriptions.Item label="最大用户数">{selectedPlan.maxUsers}</Descriptions.Item>
        <Descriptions.Item label="最大存储(MB)">{selectedPlan.maxStorageMB}</Descriptions.Item>
        <Descriptions.Item label="最大流水线数">{selectedPlan.maxPipelines}</Descriptions.Item>
        <Descriptions.Item label="最大并发任务">{selectedPlan.maxConcurrentJobs}</Descriptions.Item>
        <Descriptions.Item label="每日最大告警">{selectedPlan.maxAlertsPerDay}</Descriptions.Item>
        <Descriptions.Item label="创建时间">
          {selectedPlan.createdAt ? new Date(selectedPlan.createdAt).toLocaleString() : '-'}
        </Descriptions.Item>
      </Descriptions>
    )}
  </Modal>
);
