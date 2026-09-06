/**
 * useOnCallState.ts - OnCall 状态 Hook
 * 抽取自 OnCall/index.tsx (P2-9 Phase 78)
 */
import { useState, useEffect } from 'react';
import { message, Form } from 'antd';
import {
  getSchedules,
  createSchedule,
  deleteSchedule,
  getCurrentOnCall,
  createOverride,
  type OnCallSchedule,
  type OnCallOverride,
  type CreateScheduleInput,
  type CreateOverrideInput,
  type CurrentOnCallResult,
} from '@/api/oncall';
import { listUsers, type User } from '@/api/users';
import { FALLBACK_USERS } from './constants';

export const useOnCallState = () => {
  const [loading, setLoading] = useState(false);
  const [schedules, setSchedules] = useState<OnCallSchedule[]>([]);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [overrideModalVisible, setOverrideModalVisible] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<OnCallSchedule | null>(null);
  const [currentOnCall, setCurrentOnCall] = useState<Record<string, CurrentOnCallResult>>({});
  const [overrides] = useState<OnCallOverride[]>([]);
  const [createForm] = Form.useForm();
  const [overrideForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [memberInput, setMemberInput] = useState('');

  // ---- User Map (fetched from real API) ----
  const [userMap, setUserMap] = useState<Record<string, string>>(FALLBACK_USERS);
  const [usersLoading, setUsersLoading] = useState(false);

  /**
   * Resolve a user ID to display name using the fetched user map.
   * Falls back to the user ID itself if not found.
   */
  const resolveUserName = (userId: string): string => userMap[userId] || userId;

  // ---- Data Loading ----

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await listUsers({ limit: 200 });
      const users: User[] = res.data?.data || [];
      if (users.length > 0) {
        const map: Record<string, string> = {};
        for (const u of users) {
          map[u.id] = u.name || u.username || u.id;
        }
        setUserMap(map);
      }
    } catch (error: unknown) {
      // Use fallback users if API fails
      setUserMap(FALLBACK_USERS);
    } finally {
      setUsersLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getSchedules();
      const data = res.data?.schedules;
      setSchedules(Array.isArray(data) && data.length > 0 ? data : []);
    } catch (error: unknown) {
      setSchedules([]);
      message.error(`加载值班排班失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentOnCall = async (scheduleId: string) => {
    try {
      const res = await getCurrentOnCall(scheduleId);
      const result = res.data;
      if (result) {
        setCurrentOnCall((prev) => ({ ...prev, [scheduleId]: result }));
      } else {
        setCurrentOnCall((prev) => ({
          ...prev,
          [scheduleId]: { isOnCall: false },
        }));
      }
    } catch (error: unknown) {
      setCurrentOnCall((prev) => ({
        ...prev,
        [scheduleId]: { isOnCall: false },
      }));
    }
  };

  useEffect(() => {
    loadData();
    loadUsers();
  }, []);

  useEffect(() => {
    // Load current on-call for all schedules
    let cancelled = false;
    const promises = schedules.map((s) => loadCurrentOnCall(s.id));
    Promise.allSettled(promises).then(() => {
      if (!cancelled) {
        // All loaded, state already updated within individual loadCurrentOnCall calls
      }
    });
    return () => {
      cancelled = true;
    };
  }, [schedules]);

  // ---- Handlers ----

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      const teamMembers = memberInput
        ? memberInput
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean)
        : values.teamMembers || [];

      const payload: CreateScheduleInput = {
        name: values.name,
        timezone: values.timezone,
        rotationType: values.rotationType,
        teamMembers,
        rotationStartHour: values.rotationStartHour ?? 9,
      };
      await createSchedule(payload);
      message.success('值班排班创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      setMemberInput('');
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        if (error instanceof Error) {
          message.error(`创建失败：${error.message}`);
        } else {
          message.error('创建失败');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSchedule(id);
      message.success('值班排班已删除');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`删除失败：${error.message}`);
      } else {
        message.error('删除失败');
      }
    }
  };

  const openOverrideModal = (schedule: OnCallSchedule) => {
    setSelectedSchedule(schedule);
    overrideForm.setFieldsValue({
      rotationStartHour: 9,
    });
    setOverrideModalVisible(true);
  };

  const handleCreateOverride = async () => {
    if (!selectedSchedule) return;
    try {
      const values = await overrideForm.validateFields();
      setSubmitting(true);
      const payload: CreateOverrideInput = {
        scheduleId: selectedSchedule.id,
        originalUserId: values.originalUserId,
        overrideUserId: values.overrideUserId,
        startTime: values.startTime.format('YYYY-MM-DDTHH:mm:ssZ'),
        endTime: values.endTime.format('YYYY-MM-DDTHH:mm:ssZ'),
        reason: values.reason,
      };
      await createOverride(payload);
      message.success('代班创建成功');
      setOverrideModalVisible(false);
      overrideForm.resetFields();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        if (error instanceof Error) {
          message.error(`代班创建失败：${error.message}`);
        } else {
          message.error('代班创建失败');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = (schedule: OnCallSchedule) => {
    setSelectedSchedule(schedule);
    setDetailDrawerVisible(true);
    loadCurrentOnCall(schedule.id);
  };

  // ---- Computed ----

  const getAssignmentsForSchedule = (_scheduleId: string) => {
    return [];
  };

  const getOverridesForSchedule = (scheduleId: string): OnCallOverride[] => {
    return overrides.filter((o) => o.scheduleId === scheduleId);
  };

  return {
    loading,
    schedules,
    createModalVisible,
    setCreateModalVisible,
    overrideModalVisible,
    setOverrideModalVisible,
    detailDrawerVisible,
    setDetailDrawerVisible,
    selectedSchedule,
    setSelectedSchedule,
    currentOnCall,
    overrides,
    createForm,
    overrideForm,
    submitting,
    setSubmitting,
    memberInput,
    setMemberInput,
    userMap,
    usersLoading,
    resolveUserName,
    loadData,
    loadUsers,
    loadCurrentOnCall,
    handleCreate,
    handleDelete,
    openOverrideModal,
    handleCreateOverride,
    openDetail,
    getAssignmentsForSchedule,
    getOverridesForSchedule,
  };
};
