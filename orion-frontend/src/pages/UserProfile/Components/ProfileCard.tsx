/**
 * ProfileCard - 左侧个人资料卡片
 * 抽取自 index.tsx (P2-9 Phase 206)
 */
import { Card, Avatar, Tag, Descriptions, Button, Typography } from 'antd';
import {
  UserOutlined,
  EditOutlined,
  MailOutlined,
  PhoneOutlined,
} from '@ant-design/icons';
import type { UserProfile } from '@/api/user';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

const { Title } = Typography;

const ROLE_COLORS: Record<string, string> = {
  admin: 'red',
  developer: 'blue',
  viewer: 'green',
  operator: 'orange',
};

interface Props {
  profile: UserProfile | null;
  onEdit: () => void;
}

export const ProfileCard = ({ profile, onEdit }: Props) => (
  <Card>
    <div style={{ textAlign: 'center', marginBottom: spacing.lg }}>
      <Avatar size={80} icon={<UserOutlined />} src={profile?.avatar} />
      <Title level={4} style={{ marginTop: spacing[3], marginBottom: 4 }}>
        {profile?.username || '未知用户'}
      </Title>
      <Tag color={ROLE_COLORS[profile?.role || ''] || 'default'}>
        {profile?.role || '未知角色'}
      </Tag>
    </div>

    <Descriptions column={1} size="small">
      <Descriptions.Item
        label={
          <>
            <MailOutlined /> 邮箱
          </>
        }
      >
        {profile?.email || '-'}
      </Descriptions.Item>
      <Descriptions.Item
        label={
          <>
            <PhoneOutlined /> 手机
          </>
        }
      >
        {profile?.phone || '-'}
      </Descriptions.Item>
      <Descriptions.Item label="状态">
        <Tag color={profile?.status === 'active' ? 'green' : 'red'}>
          {profile?.status === 'active' ? '活跃' : '未激活'}
        </Tag>
      </Descriptions.Item>
      <Descriptions.Item label="注册时间">
        {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('zh-CN') : '-'}
      </Descriptions.Item>
    </Descriptions>

    <Button
      type="primary"
      icon={<EditOutlined />}
      block
      style={{ marginTop: spacing.md, color: profile ? undefined : colors.primary[500] }}
      onClick={onEdit}
    >
      编辑资料
    </Button>
  </Card>
);
