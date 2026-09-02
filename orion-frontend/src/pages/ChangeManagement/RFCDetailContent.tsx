/**
 * RFC Detail Content — Descriptions list for RFC detail modal
 *
 * Extracted from index.tsx to reduce main file size.
 */
import { Descriptions, Tag } from 'antd';
import type { RFC } from '@/api/change';
import { rfcStatusConfig } from './config';
import dayjs from 'dayjs';

interface RFCDetailContentProps {
  rfc: RFC;
}

export function RFCDetailContent({ rfc }: RFCDetailContentProps) {
  return (
    <Descriptions column={1} bordered size="small">
      <Descriptions.Item label="RFC 编号">{rfc.rfc_number}</Descriptions.Item>
      <Descriptions.Item label="关联变更 ID">
        {rfc.change_request_id}
      </Descriptions.Item>
      <Descriptions.Item label="状态">
        <Tag color={rfcStatusConfig[rfc.status]?.color}>
          {rfcStatusConfig[rfc.status]?.label || rfc.status}
        </Tag>
      </Descriptions.Item>
      <Descriptions.Item label="审核人">{rfc.reviewed_by || '-'}</Descriptions.Item>
      <Descriptions.Item label="审核时间">
        {rfc.reviewed_at ? dayjs(rfc.reviewed_at).format('YYYY-MM-DD HH:mm') : '-'}
      </Descriptions.Item>
      <Descriptions.Item label="变更理由">
        {rfc.justification || '-'}
      </Descriptions.Item>
      <Descriptions.Item label="风险评估">
        {rfc.risk_assessment || '-'}
      </Descriptions.Item>
      <Descriptions.Item label="测试计划">{rfc.test_plan || '-'}</Descriptions.Item>
      <Descriptions.Item label="沟通计划">
        {rfc.communication_plan || '-'}
      </Descriptions.Item>
      <Descriptions.Item label="退出计划">
        {rfc.backout_plan || '-'}
      </Descriptions.Item>
      <Descriptions.Item label="创建时间">
        {dayjs(rfc.created_at).format('YYYY-MM-DD HH:mm')}
      </Descriptions.Item>
      <Descriptions.Item label="更新时间">
        {dayjs(rfc.updated_at).format('YYYY-MM-DD HH:mm')}
      </Descriptions.Item>
    </Descriptions>
  );
}
