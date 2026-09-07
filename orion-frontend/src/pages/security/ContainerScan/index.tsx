/**
 * Container Image Security Scan Integration Page
 * 容器镜像安全扫描集成页面 - P4-12
 * 纯前端 Mock 数据：Trivy/Clair 漏洞扫描、镜像合规、修复建议
 *
 * 拆分为: useContainerScanState + scanColumns + Components/*
 * 参考: P2-9 Phase 133
 */
import React from 'react';
import { Row, Col } from 'antd';
import { spacing } from '@/tokens';
import { useContainerScanState } from './useContainerScanState';
import { ContainerScanHeader } from './Components/ContainerScanHeader';
import { StatsRow } from './Components/StatsRow';
import { ScanResultsCard } from './Components/ScanResultsCard';
import { VulnDistributionCard } from './Components/VulnDistributionCard';
import { ScanPolicyCard } from './Components/ScanPolicyCard';

const ContainerScanPage: React.FC = () => {
  const state = useContainerScanState();

  return (
    <div>
      <ContainerScanHeader />

      <StatsRow
        totalImages={state.totalImages}
        highVulns={state.highVulns}
        fixRate={state.fixRate}
        pendingScan={state.pendingScan}
      />

      <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.lg }}>
        <Col span={14}>
          <ScanResultsCard
            loading={state.loading}
            filteredData={state.filteredData}
            searchText={state.searchText}
            setSearchText={state.setSearchText}
            statusFilter={state.statusFilter}
            setStatusFilter={state.setStatusFilter}
            scanningKey={state.scanningKey}
            handleScan={state.handleScan}
          />
        </Col>
        <Col span={10}>
          <VulnDistributionCard vulnDist={state.vulnDist} />
        </Col>
      </Row>

      <ScanPolicyCard
        policy={state.policy}
        setPolicy={state.setPolicy}
        policyForm={state.policyForm}
      />
    </div>
  );
};

export default ContainerScanPage;
