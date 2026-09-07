/**
 * SBOM Detail Page
 * SBOM document detail with package list, vulnerability scan results, attestation status
 *
 * Split into components (P2-9 Phase 162):
 * - types.ts: 5 interfaces (SbomPackage, SbomVulnResult, SbomVulnDetail, SbomDocument, SbomAttestation)
 * - columns.tsx: buildPackageColumns + buildVulnColumns + buildVulnDetailColumns + VULN_DETAIL_COLOR_MAP
 * - useSbomDetailState.ts: useParams + 8 useState + loadData/handleScan/handleDownload/handleViewVulnDetails
 * - Components/PageHeader.tsx
 * - Components/DocumentCard.tsx
 * - Components/AttestationCard.tsx
 * - Components/PackageListCard.tsx
 * - Components/VulnResultsCard.tsx
 * - Components/VulnDetailModal.tsx
 */
import React, { useMemo } from 'react';
import { Spin, Typography } from 'antd';
import { useSbomDetailState } from './useSbomDetailState';
import {
  buildPackageColumns,
  buildVulnColumns,
  buildVulnDetailColumns,
} from './columns';
import { PageHeader } from './Components/PageHeader';
import { DocumentCard } from './Components/DocumentCard';
import { AttestationCard } from './Components/AttestationCard';
import { PackageListCard } from './Components/PackageListCard';
import { VulnResultsCard } from './Components/VulnResultsCard';
import { VulnDetailModal } from './Components/VulnDetailModal';

const { Text } = Typography;

const SbomDetail: React.FC = () => {
  const state = useSbomDetailState();
  const {
    loading,
    doc,
    packages,
    vulnResults,
    vulnDetails,
    attestation,
    scanLoading,
    vulnDetailVisible,
    setVulnDetailVisible,
    handleScan,
    handleDownload,
    handleViewVulnDetails,
  } = state;

  const packageColumns = useMemo(() => buildPackageColumns(), []);
  const vulnColumns = useMemo(
    () => buildVulnColumns({ onViewDetails: handleViewVulnDetails }),
    [handleViewVulnDetails],
  );
  const vulnDetailColumns = useMemo(() => buildVulnDetailColumns(), []);

  if (!doc && !loading) {
    return <Text type="secondary">SBOM document not found</Text>;
  }

  return (
    <Spin spinning={loading}>
      <div style={{ padding: 0 }}>
        <PageHeader />
        {doc && (
          <DocumentCard
            doc={doc}
            scanLoading={scanLoading}
            onDownload={handleDownload}
            onScan={handleScan}
          />
        )}
        {attestation && <AttestationCard attestation={attestation} />}
        <PackageListCard packages={packages} columns={packageColumns} />
        <VulnResultsCard vulnResults={vulnResults} columns={vulnColumns} />
        <VulnDetailModal
          open={vulnDetailVisible}
          vulnDetails={vulnDetails}
          columns={vulnDetailColumns}
          onCancel={() => setVulnDetailVisible(false)}
        />
      </div>
    </Spin>
  );
};

export default SbomDetail;
