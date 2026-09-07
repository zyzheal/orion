/**
 * PasswordPolicy history columns
 * 抽取自 index.tsx (P2-9 Phase 144)
 */
import { Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { colors } from '@/tokens';
import type { HistoryRecord } from './helpers';

const { Text } = Typography;

export const buildHistoryColumns = (): ColumnsType<HistoryRecord> => [
  {
    title: '用户名',
    dataIndex: 'username',
    key: 'username',
    render: (text: string) => <Text strong>{text}</Text>,
  },
  {
    title: '修改时间',
    dataIndex: 'updatedAt',
    key: 'updatedAt',
  },
  {
    title: '旧密码哈希（前缀）',
    dataIndex: 'oldHash',
    key: 'oldHash',
    render: (hash: string) => <code style={{ fontSize: 12 }}>{hash}</code>,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    render: (status: string) =>
      status === '正常' ? (
        <Tag color={colors.success[500]}>正常</Tag>
      ) : (
        <Tag color={colors.warning[500]}>过期</Tag>
      ),
  },
];
