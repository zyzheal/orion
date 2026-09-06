/**
 * useFederationState.ts - 联邦调度状态 Hook
 * 抽取自 FederationPage.tsx (P2-9 Phase 89)
 */
import { useState, useEffect, useMemo } from 'react';
import { message, Modal, Form } from 'antd';
import {
  federationApi,
  type FederationCluster,
  type ClusterHealth,
  type CrossClusterJob,
  type ResourcePool,
} from '@/api/federation';

export const useFederationState = () => {
  const [clusters, setClusters] = useState<FederationCluster[]>([]);
  const [clusterHealth, setClusterHealth] = useState<Record<string, ClusterHealth>>({});
  const [jobs, setJobs] = useState<CrossClusterJob[]>([]);
  const [resourcePools, setResourcePools] = useState<ResourcePool[]>([]);
  const [loading, setLoading] = useState(false);
  const [createClusterModal, setCreateClusterModal] = useState(false);
  const [createJobModal, setCreateJobModal] = useState(false);
  const [createPoolModal, setCreatePoolModal] = useState(false);
  const [clusterForm] = Form.useForm<{ name: string; provider: string; region: string; endpoint?: string }>();
  const [jobForm] = Form.useForm<{ name: string; targetClusters: string[] }>();
  const [poolForm] = Form.useForm<{ name: string; clusterId: string; cpuCores: number; memoryMb: number }>();

  const loadData = async () => {
    setLoading(true);
    try {
      const [clustersRes, jobsRes, poolsRes] = await Promise.allSettled([
        federationApi.listClusters(),
        federationApi.listJobs(),
        federationApi.listResourcePools(),
      ]);

      if (clustersRes.status === 'fulfilled') {
        const clusterList = Array.isArray(clustersRes.value) ? clustersRes.value : [];
        setClusters(clusterList);

        const healthMap: Record<string, ClusterHealth> = {};
        await Promise.all(
          clusterList.map(async (c) => {
            try {
              const health = await federationApi.getClusterHealth(c.id);
              healthMap[c.id] = health;
            } catch {
              // Ignore individual health failures
            }
          })
        );
        setClusterHealth(healthMap);
      }
      if (jobsRes.status === 'fulfilled') {
        setJobs(Array.isArray(jobsRes.value) ? jobsRes.value : []);
      }
      if (poolsRes.status === 'fulfilled') {
        setResourcePools(Array.isArray(poolsRes.value) ? poolsRes.value : []);
      }
    } catch (error: unknown) {
      message.error(`加载联邦数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateCluster = async (values: { name: string; provider: string; region: string; endpoint?: string }) => {
    try {
      await federationApi.registerCluster({
        name: values.name,
        provider: values.provider,
        region: values.region,
        endpoint: values.endpoint || '',
      });
      message.success('集群注册成功');
      setCreateClusterModal(false);
      clusterForm.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(`注册失败: ${(error as Error).message}`);
    }
  };

  const handleSubmitJob = async (values: { name: string; targetClusters: string[] }) => {
    try {
      await federationApi.submitCrossClusterJob({
        name: values.name,
        targetClusters: values.targetClusters,
        spec: {},
      });
      message.success('跨集群作业提交成功');
      setCreateJobModal(false);
      jobForm.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(`提交失败: ${(error as Error).message}`);
    }
  };

  const handleCreatePool = async (values: { name: string; clusterId: string; cpuCores: number; memoryMb: number }) => {
    try {
      await federationApi.createResourcePool({
        name: values.name,
        clusterId: values.clusterId,
        cpuCores: values.cpuCores,
        memoryMb: values.memoryMb,
      });
      message.success('资源池创建成功');
      setCreatePoolModal(false);
      poolForm.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(`创建失败: ${(error as Error).message}`);
    }
  };

  const handleDeregisterCluster = (cluster: FederationCluster) => {
    Modal.confirm({
      title: '确认注销集群？',
      content: `确定要注销集群 "${cluster.name}" 吗？此操作不可撤销。`,
      okText: '确认注销',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await federationApi.deregisterCluster(cluster.id);
          message.success('集群已注销');
          loadData();
        } catch (error: unknown) {
          message.error(`注销失败: ${(error as Error).message}`);
        }
      },
    });
  };

  const handleDeleteJob = (job: CrossClusterJob) => {
    Modal.confirm({
      title: '确认删除作业？',
      content: `确定要删除作业 "${job.name}" 吗？`,
      okText: '确认删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await federationApi.deleteJob(job.id);
          message.success('作业已删除');
          loadData();
        } catch (error: unknown) {
          message.error(`删除失败: ${(error as Error).message}`);
        }
      },
    });
  };

  const handleDeletePool = (pool: ResourcePool) => {
    Modal.confirm({
      title: '确认删除资源池？',
      content: `确定要删除资源池 "${pool.name}" 吗？`,
      okText: '确认删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await federationApi.deleteResourcePool(pool.id);
          message.success('资源池已删除');
          loadData();
        } catch (error: unknown) {
          message.error(`删除失败: ${(error as Error).message}`);
        }
      },
    });
  };

  const stats = useMemo(
    () => ({
      total: clusters.length,
      active: clusters.filter((c) => c.status === 'active').length,
      totalJobs: jobs.length,
      runningJobs: jobs.filter((j) => j.status === 'running').length,
      totalPools: resourcePools.length,
    }),
    [clusters, jobs, resourcePools]
  );

  return {
    clusters,
    clusterHealth,
    jobs,
    resourcePools,
    loading,
    createClusterModal,
    setCreateClusterModal,
    createJobModal,
    setCreateJobModal,
    createPoolModal,
    setCreatePoolModal,
    clusterForm,
    jobForm,
    poolForm,
    loadData,
    handleCreateCluster,
    handleSubmitJob,
    handleCreatePool,
    handleDeregisterCluster,
    handleDeleteJob,
    handleDeletePool,
    stats,
  };
};
