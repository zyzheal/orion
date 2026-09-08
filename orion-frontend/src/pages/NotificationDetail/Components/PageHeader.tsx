import { Button, Popconfirm, Space, Typography } from 'antd';
import { ArrowLeftOutlined, CheckOutlined, DeleteOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface Props {
  typeIcon: React.ReactNode;
  notification: any;
  actionLoading: boolean;
  onBack: () => void;
  onMarkAsRead: () => void;
  onDelete: () => void;
}

export function PageHeader({ typeIcon, notification, actionLoading, onBack, onMarkAsRead, onDelete }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.lg,
      }}
    >
      <div>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <ArrowLeftOutlined
            style={{ marginRight: spacing[3], color: colors.primary[500], cursor: 'pointer' }}
            onClick={onBack}
          />
          {typeIcon}
          通知详情
        </Title>
        <Text type="secondary">查看通知完整内容与相关操作</Text>
      </div>
      <Space>
        {!notification.read && (
          <Button icon={<CheckOutlined />} onClick={onMarkAsRead} loading={actionLoading}>
            标记已读
          </Button>
        )}
        <Popconfirm title="确定删除此通知？" onConfirm={onDelete} okText="确定" cancelText="取消">
          <Button danger icon={<DeleteOutlined />} loading={actionLoading}>
            删除
          </Button>
        </Popconfirm>
      </Space>
    </div>
  );
}
