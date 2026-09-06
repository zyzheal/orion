/**
 * useApprovalTableColumns - 超时审批列表列配置 Hook
 */
import { useMemo } from 'react';
import { Typography, Space, Button, Tooltip } from 'antd';
import { ArrowUpOutlined, SendOutlined, EyeOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import type { ColumnsType } from 'antd/es/table';
import { formatWaitTime, statusTag } from './constants';
import type { ApprovalRecord } from './types';

const { Text } = Typography;

export interface ApprovalTableColumnsProps {
  handleEscalate: (record: ApprovalRecord) => void;
  handleUrgent: (record: ApprovalRecord) => void;
  handleViewDetail: (record: ApprovalRecord) => void;
}

export const useApprovalTableColumns = ({
  handleEscalate,
  handleUrgent,
  handleViewDetail,
}: ApprovalTableColumnsProps): ColumnsType<ApprovalRecord> =>
  useMemo<ColumnsType<ApprovalRecord>>(
    () => [
      {
        title: '审批单号',
        dataIndex: 'requestNo',
        key: 'requestNo',
        width: 180,
        render: (val: string) => (
          <Text strong style={{ color: colors.primary[500] }}>
            {val}
          </Text>
        ),
      },
      {
        title: '申请人',
        dataIndex: 'applicant',
        key: 'applicant',
        width: 80,
      },
      {
        title: '审批人',
        dataIndex: 'approver',
        key: 'approver',
        width: 80,
      },
      {
        title: '提交时间',
        dataIndex: 'submitTime',
        key: 'submitTime',
        width: 150,
        render: (val: string) => <Text type="secondary">{val}</Text>,
      },
      {
        title: '已等待',
        dataIndex: 'waitMinutes',
        key: 'waitMinutes',
        width: 110,
        render: (minutes: number) => {
          const color =
            minutes > 180
              ? colors.purple[500]
              : minutes > 90
                ? colors.error[500]
                : minutes > 30
                  ? colors.warning[500]
                  : colors.success[500];
          return (
            <Text style={{ color, fontWeight: 600, fontSize: 14 }}>
              {formatWaitTime(minutes)}
            </Text>
          );
        },
      },
      {
        title: 'SLA 时限',
        dataIndex: 'slaLimit',
        key: 'slaLimit',
        width: 90,
        render: (val: string) => <Text>{val}</Text>,
      },
      {
        title: '超时状态',
        dataIndex: 'status',
        key: 'status',
        width: 100,
        render: (status: ApprovalRecord['status']) => statusTag(status),
      },
      {
        title: '操作',
        key: 'action',
        width: 220,
        render: (_: unknown, record: ApprovalRecord) => (
          <Space size="small">
            <Tooltip title="手动升级至上一级审批人">
              <Button
                type="primary"
                size="small"
                danger
                icon={<ArrowUpOutlined />}
                onClick={() => handleEscalate(record)}
              >
                升级
              </Button>
            </Tooltip>
            <Tooltip title="发送催办通知给当前审批人">
              <Button
                size="small"
                icon={<SendOutlined />}
                style={{ borderColor: colors.warning[500], color: colors.warning[500] }}
                onClick={() => handleUrgent(record)}
              >
                催办
              </Button>
            </Tooltip>
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
            >
              详情
            </Button>
          </Space>
        ),
      },
    ],
    [handleEscalate, handleUrgent, handleViewDetail]
  );
