/**
 * CMDB - Configuration Management Database
 * CI management, topology view, integration status, web terminal, batch execution, audit
 *
 * 2026-05-19: 扩展为 6 Tab — 新增 Web 终端、批量执行、审计日志
 * 原有组件拆分为独立文件
 * 2026-07-27: 新增 4 个统计卡片 (CI总数/主机/K8s/CICD)，调用后端 API
 */
import React, { useEffect, useState } from 'react';
import { Row, Col, Tabs, Spin, Empty } from 'antd';
import { StatCard } from '@/components/charts';
import {
  CloudServerOutlined,
  DesktopOutlined,
  ClusterOutlined,
  RocketOutlined,
  DeploymentUnitOutlined,
  LinkOutlined,
  CodeOutlined,
  EyeOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { getCIs, getHosts, getK8sResources, getCICDResources } from '@/api/cmdb';
import CITablePage from './CITablePage';
import TopologyPage from './TopologyPage';
import IntegrationPage from './IntegrationPage';
import WebTerminalPage from './WebTerminalPage';
import BatchExecPage from './BatchExecPage';
import AuditLogPage from './AuditLogPage';

interface CMDBStats {
  ciTotal: number;
  hostCount: number;
  k8sCount: number;
  cicdCount: number;
}

const defaultStats: CMDBStats = { ciTotal: 0, hostCount: 0, k8sCount: 0, cicdCount: 0 };

const CMDBPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<CMDBStats>(defaultStats);

  useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
      try {
        const [cisRes, hostsRes, k8sRes, cicdRes] = await Promise.all([
          getCIs().catch(() => ({ data: [] })),
          getHosts().catch(() => ({ data: [] })),
          getK8sResources().catch(() => ({ data: [] })),
          getCICDResources().catch(() => ({ data: [] })),
        ]);

        if (cancelled) return;

        const ciArr = cisRes.data || [];
        const hostArr = hostsRes.data || [];
        const k8sArr = k8sRes.data || [];
        const cicdArr = cicdRes.data || [];

        setStats({
          ciTotal: ciArr.length,
          hostCount: hostArr.length,
          k8sCount: k8sArr.length,
          cicdCount: cicdArr.length,
        });
      } catch {
        if (!cancelled) {
          setStats(defaultStats);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchAll();
    return () => {
      cancelled = true;
    };
  }, []);

  const tabItems = [
    {
      key: 'cis',
      label: (
        <span>
          <CloudServerOutlined /> 配置项
        </span>
      ),
      children: <CITablePage />,
    },
    {
      key: 'topology',
      label: (
        <span>
          <DeploymentUnitOutlined /> 拓扑图
        </span>
      ),
      children: <TopologyPage />,
    },
    {
      key: 'integration',
      label: (
        <span>
          <LinkOutlined /> 集成资源
        </span>
      ),
      children: <IntegrationPage />,
    },
    {
      key: 'terminal',
      label: (
        <span>
          <DesktopOutlined /> Web 终端
        </span>
      ),
      children: <WebTerminalPage />,
    },
    {
      key: 'batch-exec',
      label: (
        <span>
          <CodeOutlined /> 批量执行
        </span>
      ),
      children: <BatchExecPage />,
    },
    {
      key: 'audit',
      label: (
        <span>
          <EyeOutlined /> 审计日志
        </span>
      ),
      children: <AuditLogPage />,
    },
  ];

  return (
    <Spin spinning={loading}>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="配置项 (CI)"
            value={stats.ciTotal}
            icon={<DatabaseOutlined style={{ color: colors.primary[500], fontSize: 20 }} />}
            color={colors.primary[500]}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="主机"
            value={stats.hostCount}
            icon={<DesktopOutlined style={{ color: colors.success[500], fontSize: 20 }} />}
            color={colors.success[500]}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="K8s 资源"
            value={stats.k8sCount}
            icon={<ClusterOutlined style={{ color: colors.info[500], fontSize: 20 }} />}
            color={colors.info[500]}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="CICD 资源"
            value={stats.cicdCount}
            icon={<RocketOutlined style={{ color: colors.warning[500], fontSize: 20 }} />}
            color={colors.warning[500]}
          />
        </Col>
      </Row>

      {tabItems.length > 0 ? (
        <Tabs defaultActiveKey="cis" items={tabItems} size="large" />
      ) : (
        <Empty description="暂无数据" />
      )}
    </Spin>
  );
};

export default CMDBPage;
