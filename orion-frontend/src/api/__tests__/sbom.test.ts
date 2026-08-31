import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSbomDocuments, getSbomDocument, createSbomDocument, deleteSbomDocument,
  getSbomPackages, triggerSbomVulnerabilityScan,
  getSbomVulnerabilityResults,
  getSbomWaivers, createSbomWaiver, deleteSbomWaiver } from '../sbom';
import { api } from '../client';

vi.mock('../client', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() } }));

describe('SBOM API', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should list SBOM documents', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [], total: 0 }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getSbomDocuments();
    expect(api.get).toHaveBeenCalledWith('/sbom/documents', { params: undefined });
  });

  it('should get SBOM document by id', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { id: '1' } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getSbomDocument('1');
    expect(api.get).toHaveBeenCalledWith('/sbom/documents/1');
  });

  it('should create SBOM document', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: '1' } }, status: 201, statusText: 'Created', headers: {}, config: {} } as any);
    // SbomDocumentInput 是结构化字段集，没有 name
    await createSbomDocument({ buildId: 'b-1', pipelineRunId: 'r-1', format: 'cyclonedx', specVersion: '1.5', documentId: 'sbom-1', content: { name: 'test-sbom' } });
    expect(api.post).toHaveBeenCalledWith('/sbom/documents', { buildId: 'b-1', pipelineRunId: 'r-1', format: 'cyclonedx', specVersion: '1.5', documentId: 'sbom-1', content: { name: 'test-sbom' } });
  });

  it('should delete SBOM document', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: {}, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await deleteSbomDocument('1');
    expect(api.delete).toHaveBeenCalledWith('/sbom/documents/1');
  });

  it('should get SBOM packages', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getSbomPackages('1');
    expect(api.get).toHaveBeenCalledWith('/sbom/documents/1/packages');
  });

  it('should trigger vulnerability scan', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: 'scan-1' } }, status: 201, statusText: 'Created', headers: {}, config: {} } as any);
    await triggerSbomVulnerabilityScan({ sbomId: '1' });
    expect(api.post).toHaveBeenCalledWith('/sbom/vulnerability/scan', { sbomId: '1' });
  });

  it('should get vulnerability results', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getSbomVulnerabilityResults({ sbomId: '1' });
    expect(api.get).toHaveBeenCalledWith('/sbom/vulnerability/results', { params: { sbomId: '1' } });
  });

  it('should get SBOM waivers', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getSbomWaivers({ scope: 'package' });
    expect(api.get).toHaveBeenCalledWith('/sbom/waivers', { params: { scope: 'package' } });
  });

  it('should create SBOM waiver', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: 'w-1' } }, status: 201, statusText: 'Created', headers: {}, config: {} } as any);
    // SbomWaiverInput 用 cveId + packageName/packageVersion 三元组定位被豁免的组件
    await createSbomWaiver({ cveId: 'CVE-2024-1234', packageName: 'lodash', packageVersion: '4.17.21', reason: 'accepted risk', expiresAt: '2027-01-01', scope: 'project' });
    expect(api.post).toHaveBeenCalledWith('/sbom/waivers', { cveId: 'CVE-2024-1234', packageName: 'lodash', packageVersion: '4.17.21', reason: 'accepted risk', expiresAt: '2027-01-01', scope: 'project' });
  });

  it('should delete SBOM waiver', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: {}, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await deleteSbomWaiver('1');
    expect(api.delete).toHaveBeenCalledWith('/sbom/waivers/1');
  });
});
