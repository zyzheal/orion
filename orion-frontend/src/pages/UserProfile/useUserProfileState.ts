/**
 * useUserProfileState.ts - 个人中心状态管理 Hook
 * 抽取自 index.tsx (P2-9 Phase 206)
 */
import { useState, useEffect } from 'react';
import { Form, message } from 'antd';
import { userApi, UserProfile as UserProfileType, UserActivity, UserTeam } from '@/api/user';
import { useQuery } from '@/providers/QueryProvider';

export interface EditProfileFormValues {
  username: string;
  email: string;
  phone?: string;
}

export function useUserProfileState() {
  const [editVisible, setEditVisible] = useState(false);
  const [form] = Form.useForm<EditProfileFormValues>();

  // Use current user ID (in real app this would come from auth context)
  const userId = 'current';

  const {
    data: userData,
    isLoading: loading,
    isError,
    error,
    refetch: loadData,
  } = useQuery<{
    profile: UserProfileType | null;
    teams: UserTeam[];
    activities: UserActivity[];
  }>({
    queryKey: ['user-profile', userId],
    queryFn: async () => {
      const [profileRes, teamsRes, activitiesRes] = await Promise.allSettled([
        userApi.getProfile(userId),
        userApi.getTeams(userId),
        userApi.getActivities(userId),
      ]);
      return {
        profile:
          profileRes.status === 'fulfilled'
            ? (((profileRes.value as any)?.data || profileRes.value) as UserProfileType)
            : null,
        teams:
          teamsRes.status === 'fulfilled'
            ? (() => {
                const data = (teamsRes.value as any)?.data || teamsRes.value;
                return Array.isArray(data) ? data : [];
              })()
            : [],
        activities:
          activitiesRes.status === 'fulfilled'
            ? (() => {
                const data = (activitiesRes.value as any)?.data || activitiesRes.value;
                return Array.isArray(data) ? data : [];
              })()
            : [],
      };
    },
    staleTime: 30_000,
  });

  const profile = userData?.profile ?? null;
  const teams = userData?.teams ?? [];
  const activities = userData?.activities ?? [];

  // 加载失败反馈：本仓库锁定的 react-query 构建不触发 useQuery 的 onError 选项
  // （QueryObserver 未实现 observer 级回调），统一用 isError + useEffect 呈现。
  useEffect(() => {
    if (!isError) return;
    message.error(error instanceof Error && error.message ? error.message : '加载用户信息失败');
  }, [isError, error]);

  const handleEdit = () => {
    if (profile) {
      form.setFieldsValue({
        username: profile.username,
        email: profile.email,
        phone: profile.phone,
      });
    }
    setEditVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      await userApi.updateProfile(userId, values);
      message.success('更新成功');
      setEditVisible(false);
      loadData();
    } catch {
      message.error('更新失败');
    }
  };

  const handleCancel = () => setEditVisible(false);

  return {
    loading,
    profile,
    teams,
    activities,
    editVisible,
    form,
    handleEdit,
    handleSave,
    handleCancel,
    loadData,
  };
}
