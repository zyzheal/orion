/**
 * ApprovalDetailModal - 审批详情 Modal（含升级路径）
 */
import React from 'react';
import {
  Typography,
  Space,
  Button,
  Modal,
  Divider,
  Descriptions,
  Timeline,
} from 'antd';
import {
  ClockCircleOutlined,
  ArrowUpOutlined,
  ExclamationCircleOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing, themeVars } from '@/tokens';
import { formatWaitTime, statusTag } from './constants';
import type { ApprovalRecord } from './types';

const { Text, Paragraph } = Typography;

export interface ApprovalDetailModalProps {
  visible: boolean;
  record: ApprovalRecord | null;
  onClose: () => void;
  onUrgent: (record: ApprovalRecord) => void;
  onEscalate: (record: ApprovalRecord) => void;
}

export const ApprovalDetailModal: React.FC<ApprovalDetailModalProps> = ({
  visible,
  record: selectedRecord,
  onClose,
  onUrgent,
  onEscalate,
}) => (
  <Modal
    title={
      <Space>
        <ClockCircleOutlined style={{ color: colors.info[500] }} />
        <Text strong>审批详情</Text>
      </Space>
    }
    open={visible}
    onCancel={onClose}
    footer={[
      <Button key="close" onClick={onClose}>
        关闭
      </Button>,
      <Button
        key="urgent"
        icon={<SendOutlined />}
        style={{ color: colors.warning[500], borderColor: colors.warning[500] }}
        onClick={() => {
          if (selectedRecord) onUrgent(selectedRecord);
        }}
      >
        催办审批人
      </Button>,
      <Button
        key="escalate"
        type="primary"
        danger
        icon={<ArrowUpOutlined />}
        onClick={() => {
          if (selectedRecord) onEscalate(selectedRecord);
        }}
      >
        手动升级
      </Button>,
    ]}
  >
    {selectedRecord && (
      <div>
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="审批单号">
            <Text strong style={{ color: colors.primary[500] }}>
              {selectedRecord.requestNo}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="审批类型">{selectedRecord.approvalType}</Descriptions.Item>
          <Descriptions.Item label="申请人">
            {selectedRecord.applicant}（{selectedRecord.department}）
          </Descriptions.Item>
          <Descriptions.Item label="当前审批人">{selectedRecord.approver}</Descriptions.Item>
          <Descriptions.Item label="提交时间">{selectedRecord.submitTime}</Descriptions.Item>
          <Descriptions.Item label="已等待">
            <Text
              style={{
                color: colors.error[500],
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              {formatWaitTime(selectedRecord.waitMinutes)}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="SLA 时限">{selectedRecord.slaLimit}</Descriptions.Item>
          <Descriptions.Item label="当前状态">
            {statusTag(selectedRecord.status)}
          </Descriptions.Item>
        </Descriptions>

        <Divider />

        <Text type="secondary" style={{ fontSize: 13 }}>
          <Paragraph>
            <ExclamationCircleOutlined style={{ color: colors.warning[500], marginRight: 4 }} />
            此审批单已等待 {formatWaitTime(selectedRecord.waitMinutes)}， 已超过 SLA 时限（
            {selectedRecord.slaLimit}）。
            {selectedRecord.status === 'escalated'
              ? ' 已触发自动升级，当前处理人为上级审批人。'
              : selectedRecord.status === 'timeout'
                ? ' 建议立即催办或手动升级。'
                : ''}
          </Paragraph>
        </Text>

        <div
          style={{
            marginTop: spacing.md,
            padding: spacing.md,
            background: themeVars.bgSecondary,
            borderRadius: spacing.sm,
          }}
        >
          <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
            升级路径
          </Text>
          <Timeline
            items={[
              {
                color: colors.primary[500],
                children: <Text>{selectedRecord.approver}（当前审批人）</Text>,
              },
              {
                color: colors.warning[500],
                children: <Text>直属上级（一级升级）</Text>,
              },
              {
                color: colors.error[500],
                children: <Text>部门负责人（二级升级）</Text>,
              },
              {
                color: colors.purple[500],
                children: <Text>管理层（三级升级）</Text>,
              },
            ]}
          />
        </div>
      </div>
    )}
  </Modal>
);
