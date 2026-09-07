/**
 * DeploymentDetail state hook
 * 抽取自 index.tsx (P2-9 Phase 168)
 */
import { useState, useEffect } from 'react';
import { message } from 'antd';
import { useParams } from 'react-router-dom';
import { getDeployment, rollbackDeployment, type Deployment } from '@/api/deployments';

export function useDeploymentDetailState() {
  const { id } = useParams<{ id: string }>();
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [rollbackModalVisible, setRollbackModalVisible] = useState(false);

  // Load deployment from API
  const loadDeployment = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await getDeployment(id);
      const data = response.data;
      setDeployment(data as Deployment);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载部署详情失败：${error.message}`);
      } else {
        message.error('加载部署详情失败');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeployment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Handle rollback
  const handleRollback = async () => {
    if (!deployment) return;
    setIsRollingBack(true);
    setRollbackModalVisible(false);
    try {
      await rollbackDeployment(deployment.id);
      message.success('回滚操作已触发，正在执行中...');
      // Reload to get updated status
      await loadDeployment();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`回滚操作失败：${error.message}`);
      } else {
        message.error('回滚操作失败');
      }
    } finally {
      setIsRollingBack(false);
    }
  };

  return {
    deployment,
    loading,
    isRollingBack,
    rollbackModalVisible,
    setRollbackModalVisible,
    loadDeployment,
    handleRollback,
  };
}
