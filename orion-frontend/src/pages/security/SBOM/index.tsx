/**
 * SBOM Supply Chain Security Page
 * P3-15: Software Bill of Materials - dependency tracking, vulnerability tracking, license compliance
 * Refactored in P2-9 Phase 134.
 */
import React from 'react';
import { Row, Col, Divider } from 'antd';
import { spacing, themeVars } from '@/tokens';
import { useSbomState } from './useSbomState';
import { SBOMHeader } from './Components/SBOMHeader';
import { SBOMStatsRow } from './Components/SBOMStatsRow';
import { ComponentTableCard } from './Components/ComponentTableCard';
import { VulnerabilityDetailsCard } from './Components/VulnerabilityDetailsCard';
import { LicenseComplianceCard } from './Components/LicenseComplianceCard';

const SBOMPage: React.FC = () => {
  const state = useSbomState();

  return (
    <div
      style={{
        padding: spacing.lg,
        backgroundColor: themeVars.bgSecondary,
        minHeight: '100vh',
      }}
    >
      <SBOMHeader />
      <SBOMStatsRow stats={state.stats} />

      <Divider style={{ margin: `${spacing.md}px 0` }} />

      <Row gutter={[spacing.md, spacing.md]}>
        <Col span={14}>
          <ComponentTableCard
            filteredComponents={state.filteredComponents}
            loading={state.loading}
            filterType={state.filterType}
            setFilterType={state.setFilterType}
            filterStatus={state.filterStatus}
            setFilterStatus={state.setFilterStatus}
            handleViewSBOM={state.handleViewSBOM}
            handleViewVulnDetails={state.handleViewVulnDetails}
          />
        </Col>
        <Col span={10}>
          <VulnerabilityDetailsCard
            selectedComponent={state.selectedComponent}
            selectedVulns={state.selectedVulns}
          />
        </Col>
      </Row>

      <Divider style={{ margin: `${spacing.md}px 0` }} />

      <Row gutter={[spacing.md, spacing.md]}>
        <Col span={24}>
          <LicenseComplianceCard licenseData={state.licenseData} />
        </Col>
      </Row>
    </div>
  );
};

export default SBOMPage;
