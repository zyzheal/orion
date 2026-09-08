import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { getNotification, markAsRead, deleteNotification } from '@/api/notifications';
import { useQuery, useQueryClient } from '@/providers/QueryProvider';

export function useNotificationDetailState() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [actionLoading, setActionLoading] = useState(false);

  const {
    data: notification,
    isLoading: loading,
    isError,
    error,
  } = useQuery<any>({
    queryKey: ['notification', id],
    queryFn: async () => {
      if (!id) return null;
      return getNotification(id);
    },
    enabled: !!id,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!isError) return;
    if (error instanceof Error) {
      message.error(`获取通知详情失败：${error.message}`);
    } else {
      message.error('获取通知详情失败');
    }
  }, [isError, error]);

  const handleMarkAsRead = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await markAsRead(id);
      queryClient.setQueryData(['notification', id], (prev: any) => ({ ...prev, read: true }));
      message.success('已标记为已读');
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`操作失败：${error.message}`);
      } else {
        message.error('操作失败');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await deleteNotification(id);
      message.success('通知已删除');
      navigate('/notifications');
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`删除失败：${error.message}`);
      } else {
        message.error('删除失败');
      }
    } finally {
      setActionLoading(false);
    }
  };

  return { id, navigate, notification, loading, actionLoading, handleMarkAsRead, handleDelete };
}
