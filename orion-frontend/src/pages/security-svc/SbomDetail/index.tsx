/**
 * SBOM Detail Page
 * SBOM document detail with package list, vulnerability scan results, attestation status
 *
 * Split into components (P2-9 Phase 154):
 * - types.ts / columns.tsx / useSbomDetailState.ts
 * - Components/{SbomDetailHeader,DocInfoCard,AttestationCard,PackagesCard,VulnResultsCard,VulnDetailModal}.tsx
 */
import React, { useMemo } from 'react';
import { Spin, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useSbomDetailState } from './useSbomDetailState';
import {
  buildPackageColumns,
  buildVulnColumns,
  buildVulnDetailColumns,
} from './columns';
import { SbomDetailHeader } from './Components/SbomDetailHeader';
import { DocInfoCard } from './Components/DocInfoCard';
import { AttestationCard } from './Components/AttestationCard';
import { PackagesCard } from './Components/PackagesCard';
import { VulnResultsCard } from './Components/VulnResultsCard';
import { VulnDetailModal } from './Components/VulnDetailModal';

const { Text } = Typography;

const SbomDetail: React.FC = () => {
  const navigate = useNavigate();
  const state = useSbomDetailState();

  const packageColumns = useMemo(() => buildPackageColumns(), []);
  const vulnColumns = useMemo(
    () => buildVulnColumns({ handleViewVulnDetails: state.handleViewVulnDetails }),
    [state.handleViewVulnDetails],
  );
  const vulnDetailColumns = useMemo(() => buildVulnDetailColumns(), []);

  if (!state.doc && !state.loading) {
    return <Text type="secondary">SBOM document not found</Text>;
  }

  return (
    <Spin spinning={state.loading}>
      <div style={{ padding: 0 }}>
        <SbomDetailHeader onBack={() => navigate('/sbom')} />

        {state.doc && (
          <DocInfoCard
            doc={state.doc}
            scanLoading={state.scanLoading}
            onDownload={state.handleDownload}
            onScan={state.handleScan}
          />
        )}

        <AttestationCard attestation={state.attestation} />
        <PackagesCard packages={state.packages} columns={packageColumns} />
        <VulnResultsCard results={state.vulnResults} columns={vulnColumns} />
        <VulnDetailModal
          open={state.vulnDetailVisible}
          details={state.vulnDetails}
          columns={vulnDetailColumns}
          onClose={state.handleModalClose}
        />
      </div>
    </Spin>
  );
};

export default SbomDetail;
