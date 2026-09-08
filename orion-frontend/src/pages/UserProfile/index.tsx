/**
 * UserProfile - 个人中心页面
 * 拆分自 index.tsx (P2-9 Phase 206)
 * - useUserProfileState.ts: state + useQuery + handleEdit/Save/Cancel
 * - Components/ProfileCard.tsx: 左侧资料卡片 (Avatar + Descriptions + Edit)
 * - Components/DetailTabs.tsx: 右侧 Tabs (团队/活动/权限)
 * - Components/EditProfileModal.tsx: 编辑资料 Modal
 */
import { Row, Col, Typography, Spin } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import { useUserProfileState } from './useUserProfileState';
import { ProfileCard } from './Components/ProfileCard';
import { DetailTabs } from './Components/DetailTabs';
import { EditProfileModal } from './Components/EditProfileModal';

const { Title } = Typography;

export default function UserProfilePage() {
  const {
    loading,
    profile,
    teams,
    activities,
    editVisible,
    form,
    handleEdit,
    handleSave,
    handleCancel,
  } = useUserProfileState();

  if (loading) {
    return (
      <div style={{ padding: spacing.lg, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.md }}>
        <UserOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        个人中心
      </Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <ProfileCard profile={profile} onEdit={handleEdit} />
        </Col>
        <Col xs={24} md={16}>
          <DetailTabs profile={profile} teams={teams} activities={activities} />
        </Col>
      </Row>

      <EditProfileModal
        open={editVisible}
        form={form}
        onOk={handleSave}
        onCancel={handleCancel}
      />
    </div>
  );
}
