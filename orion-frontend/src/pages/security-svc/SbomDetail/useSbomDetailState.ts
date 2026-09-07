/**
 * SBOM Detail state hook
 * 抽取自 index.tsx (P2-9 Phase 154)
 */
import { useCallback, useEffect, useState } from 'react';
import { message } from 'antd';
import { useParams } from 'react-router-dom';
import {
  getSbomDocument,
  getSbomPackages,
  getSbomVulnerabilityResults,
  getSbomVulnerabilityDetails,
  getSbomAttestation,
  triggerSbomVulnerabilityScan,
  downloadSbomDocument,
} from '@/api/sbom';
import type { SbomPackage, SbomVulnDetail, SbomVulnResult } from './types';

export function useSbomDetailState() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const [doc, setDoc] = useState<any>(null);
  const [packages, setPackages] = useState<SbomPackage[]>([]);
  const [vulnResults, setVulnResults] = useState<SbomVulnResult[]>([]);
  const [vulnDetails, setVulnDetails] = useState<SbomVulnDetail[]>([]);
  const [attestation, setAttestation] = useState<any>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [vulnDetailVisible, setVulnDetailVisible] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [docRes, pkgRes, vulnRes, attRes] = await Promise.all([
        getSbomDocument(id),
        getSbomPackages(id),
        getSbomVulnerabilityResults({ sbomId: id }),
        getSbomAttestation(id),
      ]);
      setDoc(docRes.data);
      setPackages(Array.isArray(pkgRes.data) ? pkgRes.data : []);
      setVulnResults(Array.isArray(vulnRes.data) ? vulnRes.data : []);
      setAttestation(attRes.data);
    } catch {
      message.error('Failed to load SBOM detail');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleScan = useCallback(async () => {
    if (!id) return;
    setScanLoading(true);
    try {
      await triggerSbomVulnerabilityScan({ sbomId: id });
      message.success('Vulnerability scan triggered');
      loadData();
    } catch {
      message.error('Failed to trigger scan');
    } finally {
      setScanLoading(false);
    }
  }, [id, loadData]);

  const handleDownload = useCallback(async () => {
    if (!id || !doc) return;
    try {
      await downloadSbomDocument(id, doc.format);
      message.success('Download started');
    } catch {
      message.error('Failed to download');
    }
  }, [id, doc]);

  const handleViewVulnDetails = useCallback(async (resultId: string) => {
    try {
      const res = await getSbomVulnerabilityDetails(resultId);
      setVulnDetails(Array.isArray(res.data) ? res.data : []);
      setVulnDetailVisible(true);
    } catch {
      message.error('Failed to load vulnerability details');
    }
  }, []);

  const handleModalClose = useCallback(() => {
    setVulnDetailVisible(false);
  }, []);

  return {
    id,
    loading,
    doc,
    packages,
    vulnResults,
    vulnDetails,
    attestation,
    scanLoading,
    vulnDetailVisible,
    loadData,
    handleScan,
    handleDownload,
    handleViewVulnDetails,
    handleModalClose,
  };
}

export type SbomDetailState = ReturnType<typeof useSbomDetailState>;
