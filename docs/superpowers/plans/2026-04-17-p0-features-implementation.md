# P0 Features Implementation Plan

## Goal

Implement 4 P0 features for the Orion platform as independently testable MVPs:

1. **SBOM Attestation & Supply Chain Provenance** - Auto-generate SBOMs with cryptographic signing
2. **OPA Policy-as-Code Engine** - Unified policy engine for CI/CD governance
3. **AI Change Intelligence** - Semantic blast radius analysis for PRs
4. **ML Canary Analysis** - ML-based canary deployment analysis

## Architecture

Each feature follows the established Orion pattern:
- Backend: Fastify routes -> Controller -> Service -> PostgreSQL models
- Frontend: API client (Axios) -> React page (Ant Design) -> Router registration
- Each feature is independently deployable

## Tech Stack
- Backend: Fastify (Node.js/TypeScript), PostgreSQL
- Frontend: React 18 + Ant Design 5, Axios API client
- Pipeline: Tekton integration, Argo Rollouts
- Canary: ClickHouse for timeseries data

---

# Feature 1: SBOM Attestation & Supply Chain Provenance

## MVP Scope
Generate SBOM documents, store in memory (PostgreSQL-ready), provide CRUD API, basic vulnerability scan recording, gate evaluation, and dashboard UI.

---

## Task 1.1: SBOM Database Models

**Files:** `orion-platform-service/src/models/SBOM.ts`

**Steps:** Create TypeScript interfaces following the Pipeline model pattern at `orion-platform-service/src/models/Pipeline.ts`.

```typescript
import { v4 as uuidv4 } from 'uuid';

export interface SBOMDocument {
  id: string;
  buildId: string;
  pipelineRunId: string;
  format: 'spdx' | 'cyclonedx';
  specVersion: string;
  documentId: string;
  content: Record<string, unknown>;
  packageCount: number;
  status: 'active' | 'expired' | 'revoked';
  createdAt: Date;
  expiresAt?: Date;
}

export interface SBOMPackage {
  id: string;
  sbomId: string;
  name: string;
  version: string;
  purl?: string;
  license?: string;
  supplier?: string;
}

export interface VulnerabilityResult {
  id: string;
  sbomId: string;
  scanner: string;
  totalVulns: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  gatePassed: boolean;
  gatePolicy: string;
  scannedAt: Date;
}

export interface VulnerabilityDetail {
  id: string;
  resultId: string;
  cveId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  cvssScore?: number;
  affectedPackage: string;
  fixedVersion?: string;
  description?: string;
}

export interface SBOMWaiver {
  id: string;
  cveId: string;
  packageName: string;
  packageVersion: string;
  reason: string;
  approvedBy: string;
  approvedAt: Date;
  expiresAt: Date;
  scope: 'global' | 'project' | 'environment';
  scopeTarget?: string;
}

export function createSBOMDocument(input: {
  buildId: string;
  pipelineRunId: string;
  format: 'spdx' | 'cyclonedx';
  specVersion: string;
  content: Record<string, unknown>;
}): SBOMDocument {
  const now = new Date();
  return {
    id: uuidv4(),
    buildId: input.buildId,
    pipelineRunId: input.pipelineRunId,
    format: input.format,
    specVersion: input.specVersion,
    documentId: `sbom-${input.buildId}-${Date.now()}`,
    content: input.content,
    packageCount: 0,
    status: 'active',
    createdAt: now,
  };
}

export function createVulnerabilityDetail(input: {
  resultId: string;
  cveId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  affectedPackage: string;
}): VulnerabilityDetail {
  return {
    id: uuidv4(),
    ...input,
  };
}
```

**Commit:** `feat: add SBOM data models (documents, packages, vulnerabilities, waivers)`

---

## Task 1.2: SBOM Service Layer

**Files:** `orion-platform-service/src/services/SBOMService.ts`

**Steps:** Follow PluginManagerService pattern. In-memory storage for MVP, PostgreSQL-ready interface.

```typescript
import pino from 'pino';
import { EventEmitter } from 'events';
import {
  SBOMDocument, SBOMPackage, VulnerabilityResult,
  VulnerabilityDetail, SBOMWaiver, createSBOMDocument,
} from '../models/SBOM';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export class SBOMService extends EventEmitter {
  private documents: Map<string, SBOMDocument> = new Map();
  private packages: Map<string, SBOMPackage[]> = new Map();
  private vulnResults: Map<string, VulnerabilityResult> = new Map();
  private vulnDetails: Map<string, VulnerabilityDetail[]> = new Map();
  private waivers: Map<string, SBOMWaiver> = new Map();

  async createDocument(input: {
    buildId: string; pipelineRunId: string;
    format: 'spdx' | 'cyclonedx'; specVersion?: string;
    content: Record<string, unknown>;
  }): Promise<SBOMDocument> {
    const doc = createSBOMDocument({
      ...input, specVersion: input.specVersion || '1.4',
    });
    doc.packageCount = this._countPackages(doc.content);
    this.documents.set(doc.id, doc);
    this.packages.set(doc.id, []);
    logger.info({ id: doc.id, buildId: input.buildId }, 'SBOM document created');
    return doc;
  }

  async getDocument(id: string): Promise<SBOMDocument | undefined> {
    return this.documents.get(id);
  }

  async listDocuments(filters?: {
    buildId?: string; format?: string; status?: string;
    page?: number; perPage?: number;
  }): Promise<{ data: SBOMDocument[]; total: number }> {
    let docs = Array.from(this.documents.values());
    if (filters?.buildId) docs = docs.filter(d => d.buildId === filters.buildId!);
    if (filters?.format) docs = docs.filter(d => d.format === filters.format);
    if (filters?.status) docs = docs.filter(d => d.status === filters.status);
    const page = filters?.page || 1;
    const perPage = filters?.perPage || 20;
    const start = (page - 1) * perPage;
    return { data: docs.slice(start, start + perPage), total: docs.length };
  }

  async addPackages(sbomId: string, pkgs: SBOMPackage[]): Promise<void> {
    this.packages.set(sbomId, pkgs);
    const doc = this.documents.get(sbomId);
    if (doc) doc.packageCount = pkgs.length;
  }

  async getPackages(sbomId: string): Promise<SBOMPackage[]> {
    return this.packages.get(sbomId) || [];
  }

  async recordVulnerabilityScan(input: {
    sbomId: string; scanner?: string;
    totalVulns: number; criticalCount: number;
    highCount: number; mediumCount: number;
    lowCount: number; gatePolicy: string;
  }): Promise<VulnerabilityResult> {
    const result: VulnerabilityResult = {
      id: `vr-${sbomId}-${Date.now()}`,
      sbomId: input.sbomId,
      scanner: input.scanner || 'grype',
      ...input,
      gatePassed: input.criticalCount === 0 && input.highCount === 0,
      scannedAt: new Date(),
    };
    this.vulnResults.set(result.id, result);
    this.vulnDetails.set(result.id, []);
    return result;
  }

  async addVulnerabilityDetails(resultId: string, details: VulnerabilityDetail[]): Promise<void> {
    this.vulnDetails.set(resultId, details);
  }

  async getVulnerabilityResults(sbomId: string): Promise<VulnerabilityResult[]> {
    return Array.from(this.vulnResults.values()).filter(r => r.sbomId === sbomId);
  }

  async getVulnerabilityDetails(resultId: string): Promise<VulnerabilityDetail[]> {
    return this.vulnDetails.get(resultId) || [];
  }

  async evaluateGate(sbomId: string, policy: string): Promise<{
    passed: boolean; result?: VulnerabilityResult; reason?: string;
  }> {
    const results = await this.getVulnerabilityResults(sbomId);
    const latest = results[results.length - 1];
    if (!latest) return { passed: false, reason: 'No scan results found' };
    if (policy === 'block-critical' && latest.criticalCount > 0) {
      return { passed: false, result: latest, reason: `${latest.criticalCount} critical vulnerabilities found` };
    }
    if (policy === 'block-critical-high' && (latest.criticalCount > 0 || latest.highCount > 0)) {
      return { passed: false, result: latest, reason: `${latest.criticalCount} critical, ${latest.highCount} high vulnerabilities` };
    }
    return { passed: true, result: latest };
  }

  async revokeDocument(id: string): Promise<boolean> {
    const doc = this.documents.get(id);
    if (!doc) return false;
    doc.status = 'revoked';
    return true;
  }

  async createWaiver(input: {
    cveId: string; packageName: string; packageVersion: string;
    reason: string; approvedBy: string; expiresAt: Date;
    scope?: string; scopeTarget?: string;
  }): Promise<SBOMWaiver> {
    const waiver: SBOMWaiver = {
      id: uuidv4(), ...input,
      scope: (input.scope as any) || 'global',
      approvedAt: new Date(),
    };
    this.waivers.set(waiver.id, waiver);
    return waiver;
  }

  async listWaivers(filters?: { scope?: string }): Promise<SBOMWaiver[]> {
    let waivers = Array.from(this.waivers.values());
    if (filters?.scope) waivers = waivers.filter(w => w.scope === filters.scope);
    return waivers;
  }

  async getComplianceReport(): Promise<{
    totalBuilds: number; sbomCoverage: number;
    activeDocuments: number; documentsWithVulnerabilities: number;
  }> {
    const docs = Array.from(this.documents.values());
    const total = docs.length;
    const active = docs.filter(d => d.status === 'active').length;
    const withVulns = docs.filter(d => {
      const results = Array.from(this.vulnResults.values()).filter(r => r.sbomId === d.id);
      return results.some(r => r.totalVulns > 0);
    }).length;
    return {
      totalBuilds: total,
      sbomCoverage: total > 0 ? Math.round((active / total) * 100) : 0,
      activeDocuments: active,
      documentsWithVulnerabilities: withVulns,
    };
  }

  private _countPackages(content: Record<string, unknown>): number {
    return (content as any).components?.length || (content as any).packages?.length || 0;
  }
}
```

**Command:** `cd orion-platform-service && npx tsc --noEmit`

**Commit:** `feat: implement SBOMService with CRUD, scan, gate, waiver, and compliance`

---

## Task 1.3: SBOM Controller

**Files:** `orion-platform-service/src/api/controllers/SBOMController.ts`

**Steps:** Follow PipelineController pattern at `orion-platform-service/src/api/controllers/PipelineController.ts`.

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { SBOMService } from '../../services/SBOMService';

export class SBOMController {
  private service: SBOMService;
  constructor(service: SBOMService) { this.service = service; }

  async listDocuments(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      const result = await this.service.listDocuments({
        buildId: query.buildId, format: query.format, status: query.status,
        page: query.page ? parseInt(query.page) : 1,
        perPage: query.perPage ? parseInt(query.perPage) : 20,
      });
      await reply.send({
        data: result.data.map(d => ({
          id: d.id, buildId: d.buildId, format: d.format,
          specVersion: d.specVersion, packageCount: d.packageCount,
          status: d.status, createdAt: d.createdAt,
        })), total: result.total,
      });
    } catch (error) {
      await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000',
        message: error instanceof Error ? error.message : 'Failed to list SBOMs' });
    }
  }

  async getDocument(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const doc = await this.service.getDocument((request.params as any).id);
      if (!doc) { await reply.status(404).send({ error: 'NOT_FOUND', code: '30201', message: 'SBOM not found' }); return; }
      await reply.send(doc);
    } catch (error) {
      await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000', message: error instanceof Error ? error.message : 'Failed to get SBOM' });
    }
  }

  async getPackages(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const packages = await this.service.getPackages((request.params as any).id);
      await reply.send({ data: packages, total: packages.length });
    } catch (error) {
      await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000', message: error instanceof Error ? error.message : 'Failed to get packages' });
    }
  }

  async createDocument(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any || {};
      if (!body.buildId || !body.format || !body.content) {
        await reply.status(400).send({ error: 'VALIDATION_ERROR', code: '30101', message: 'Missing required fields: buildId, format, content' });
        return;
      }
      const doc = await this.service.createDocument(body);
      if (body.packages) await this.service.addPackages(doc.id, body.packages);
      await reply.status(201).send(doc);
    } catch (error) {
      await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000', message: error instanceof Error ? error.message : 'Failed to create SBOM' });
    }
  }

  async recordScan(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any || {};
      if (!body.sbomId) { await reply.status(400).send({ error: 'VALIDATION_ERROR', code: '30101', message: 'Missing sbomId' }); return; }
      const result = await this.service.recordVulnerabilityScan(body);
      if (body.details) await this.service.addVulnerabilityDetails(result.id, body.details);
      await reply.status(201).send(result);
    } catch (error) {
      await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000', message: error instanceof Error ? error.message : 'Failed to record scan' });
    }
  }

  async getScanResults(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const results = await this.service.getVulnerabilityResults((request.query as any).sbomId);
      await reply.send({ data: results, total: results.length });
    } catch (error) {
      await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000', message: error instanceof Error ? error.message : 'Failed to get scan results' });
    }
  }

  async evaluateGate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any || {};
      if (!body.sbomId || !body.policy) { await reply.status(400).send({ error: 'VALIDATION_ERROR', code: '30101', message: 'Missing sbomId or policy' }); return; }
      await reply.send(await this.service.evaluateGate(body.sbomId, body.policy));
    } catch (error) {
      await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000', message: error instanceof Error ? error.message : 'Failed to evaluate gate' });
    }
  }

  async revokeDocument(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const revoked = await this.service.revokeDocument((request.params as any).id);
      if (!revoked) { await reply.status(404).send({ error: 'NOT_FOUND', code: '30201', message: 'SBOM not found' }); return; }
      await reply.status(204).send();
    } catch (error) {
      await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000', message: error instanceof Error ? error.message : 'Failed to revoke SBOM' });
    }
  }

  async createWaiver(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any || {};
      if (!body.cveId || !body.packageName || !body.reason) {
        await reply.status(400).send({ error: 'VALIDATION_ERROR', code: '30101', message: 'Missing required fields' }); return;
      }
      await reply.status(201).send(await this.service.createWaiver(body));
    } catch (error) {
      await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000', message: error instanceof Error ? error.message : 'Failed to create waiver' });
    }
  }

  async listWaivers(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const waivers = await this.service.listWaivers((request.query as any).scope ? { scope: (request.query as any).scope } : undefined);
      await reply.send({ data: waivers, total: waivers.length });
    } catch (error) {
      await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000', message: error instanceof Error ? error.message : 'Failed to list waivers' });
    }
  }

  async getComplianceReport(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try { await reply.send(await this.service.getComplianceReport()); }
    catch (error) {
      await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000', message: error instanceof Error ? error.message : 'Failed to get compliance report' });
    }
  }
}
```

**Commit:** `feat: implement SBOMController with all REST endpoints`

---

## Task 1.4: SBOM Routes Registration

**Files:** `orion-platform-service/src/routes-sbom.ts`

**Steps:** Follow `routes-plugin.ts` pattern.

```typescript
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { SBOMService } from './services/SBOMService';
import { SBOMController } from './api/controllers/SBOMController';

export default async function registerSbomRoutes(app: FastifyInstance): Promise<void> {
  const sbomService = new SBOMService();
  const ctrl = new SBOMController(sbomService);

  app.get('/sbom/documents', async (req: FastifyRequest, rep: FastifyReply) => ctrl.listDocuments(req, rep));
  app.get('/sbom/documents/:id', async (req: FastifyRequest, rep: FastifyReply) => ctrl.getDocument(req, rep));
  app.get('/sbom/documents/:id/packages', async (req: FastifyRequest, rep: FastifyReply) => ctrl.getPackages(req, rep));
  app.post('/sbom/documents', async (req: FastifyRequest, rep: FastifyReply) => ctrl.createDocument(req, rep));
  app.delete('/sbom/documents/:id', async (req: FastifyRequest, rep: FastifyReply) => ctrl.revokeDocument(req, rep));
  app.post('/sbom/vulnerability/scan', async (req: FastifyRequest, rep: FastifyReply) => ctrl.recordScan(req, rep));
  app.get('/sbom/vulnerability/results', async (req: FastifyRequest, rep: FastifyReply) => ctrl.getScanResults(req, rep));
  app.post('/sbom/gate/evaluate', async (req: FastifyRequest, rep: FastifyReply) => ctrl.evaluateGate(req, rep));
  app.get('/sbom/waivers', async (req: FastifyRequest, rep: FastifyReply) => ctrl.listWaivers(req, rep));
  app.post('/sbom/waivers', async (req: FastifyRequest, rep: FastifyReply) => ctrl.createWaiver(req, rep));
  app.get('/sbom/compliance/report', async (req: FastifyRequest, rep: FastifyReply) => ctrl.getComplianceReport(req, rep));
}
```

**Integration:** In `orion-platform-service/src/server.ts`, add:
```typescript
import registerSbomRoutes from './routes-sbom';
await app.register(registerSbomRoutes, { prefix: '/api/v1' });
```

**Commit:** `feat: register SBOM routes with Fastify`

---

## Task 1.5: SBOM Frontend API Client

**Files:** `orion-frontend/src/api/sbom.ts`

**Steps:** Follow `orion-frontend/src/api/pipelines.ts` pattern.

```typescript
import { api } from './client';

export interface SBOMDocument {
  id: string; buildId: string; pipelineRunId: string;
  format: 'spdx' | 'cyclonedx'; specVersion: string;
  packageCount: number; status: 'active' | 'expired' | 'revoked';
  createdAt: string;
}

export interface SBOMPackage {
  id: string; sbomId: string; name: string; version: string;
  purl?: string; license?: string; supplier?: string;
}

export interface VulnerabilityResult {
  id: string; sbomId: string; scanner: string;
  totalVulns: number; criticalCount: number; highCount: number;
  mediumCount: number; lowCount: number; gatePassed: boolean;
  gatePolicy: string; scannedAt: string;
}

export interface SBOMWaiver {
  id: string; cveId: string; packageName: string;
  packageVersion: string; reason: string; scope: string;
  expiresAt: string; approvedAt: string;
}

export function getSBOMDocuments(params?: { buildId?: string; format?: string; status?: string; page?: number; perPage?: number }) {
  return api.get('/v1/sbom/documents', { params });
}
export function getSBOMDocument(id: string) {
  return api.get(`/v1/sbom/documents/${id}`);
}
export function getSBOMPackages(sbomId: string) {
  return api.get(`/v1/sbom/documents/${sbomId}/packages`);
}
export function createSBOMDocument(data: { buildId: string; pipelineRunId: string; format: 'spdx' | 'cyclonedx'; content: Record<string, unknown>; packages?: SBOMPackage[] }) {
  return api.post('/v1/sbom/documents', data);
}
export function revokeSBOMDocument(id: string) {
  return api.delete(`/v1/sbom/documents/${id}`);
}
export function recordVulnerabilityScan(data: { sbomId: string; totalVulns: number; criticalCount: number; highCount: number; mediumCount: number; lowCount: number; gatePolicy: string }) {
  return api.post('/v1/sbom/vulnerability/scan', data);
}
export function getScanResults(sbomId: string) {
  return api.get('/v1/sbom/vulnerability/results', { params: { sbomId } });
}
export function evaluateGate(data: { sbomId: string; policy: string }) {
  return api.post('/v1/sbom/gate/evaluate', data);
}
export function getWaivers(params?: { scope?: string }) {
  return api.get('/v1/sbom/waivers', { params });
}
export function createWaiver(data: { cveId: string; packageName: string; packageVersion: string; reason: string; approvedBy: string; expiresAt: string; scope?: string }) {
  return api.post('/v1/sbom/waivers', data);
}
export function getComplianceReport() {
  return api.get('/v1/sbom/compliance/report');
}
```

**Commit:** `feat: add SBOM API client`

---

## Task 1.6: SBOM Dashboard UI

**Files:** `orion-frontend/src/pages/SBOMDashboard/index.tsx`

**Steps:** Follow PluginManagement pattern. Ant Design Table + Card + Tag.

```typescript
import React, { useState, useEffect } from 'react';
import { Typography, Table, Tag, Space, Button, Card, Row, Col, message } from 'antd';
import { ReloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { getSBOMDocuments, getComplianceReport, type SBOMDocument } from '@/api/sbom';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const formatColors: Record<string, string> = { spdx: 'blue', cyclonedx: 'green' };
const statusColors: Record<string, string> = { active: 'green', expired: 'orange', revoked: 'red' };

export default function SBOMDashboard() {
  const [data, setData] = useState<SBOMDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [compliance, setCompliance] = useState({ totalBuilds: 0, sbomCoverage: 0, activeDocuments: 0, documentsWithVulnerabilities: 0 });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [docsRes, compRes] = await Promise.all([
        getSBOMDocuments({ page: 1, perPage: 50 }),
        getComplianceReport(),
      ]);
      setData(docsRes.data.data || []);
      setTotal(docsRes.data.total || 0);
      setCompliance(compRes.data || {});
    } catch { message.error('Failed to fetch SBOM data'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const columns = [
    { title: 'Build ID', dataIndex: 'buildId', key: 'buildId', width: 180, ellipsis: true },
    { title: 'Format', dataIndex: 'format', key: 'format', render: (f: string) => <Tag color={formatColors[f]}>{f.toUpperCase()}</Tag> },
    { title: 'Packages', dataIndex: 'packageCount', key: 'packageCount', width: 100, align: 'right' as const },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={statusColors[s]}>{s}</Tag> },
    { title: 'Created', dataIndex: 'createdAt', key: 'createdAt', width: 180, render: (d: string) => dayjs(d).format('YYYY-MM-DD HH:mm') },
    { title: 'Actions', key: 'actions', render: (_: any, r: SBOMDocument) => (
      <Button type="link" size="small" onClick={() => window.location.href = `/console/sbom/${r.id}`}>View</Button>
    ) },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {[
          { label: 'Total Builds', value: compliance.totalBuilds },
          { label: 'SBOM Coverage', value: `${compliance.sbomCoverage}%` },
          { label: 'Active SBOMs', value: compliance.activeDocuments },
          { label: 'With Vulns', value: compliance.documentsWithVulnerabilities },
        ].map(item => (
          <Col span={6} key={item.label}>
            <Card><Text type="secondary">{item.label}</Text><Title level={2} style={{ margin: '8px 0 0' }}>{item.value}</Title></Card>
          </Col>
        ))}
      </Row>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4}><SafetyCertificateOutlined /> SBOM Documents</Title>
        <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>Refresh</Button>
      </div>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} pagination={{ pageSize: 20, total }} />
    </div>
  );
}
```

**Commit:** `feat: add SBOM Dashboard page with compliance metrics`

---

## Task 1.7: Router Registration

**Files:** `orion-frontend/src/router/routes.ts`

**Steps:** Add to the routes array:

```typescript
{
  path: '/console/sbom',
  element: React.lazy(() => import('@/pages/SBOMDashboard')),
  protected: true,
},
```

**Command:** `cd orion-frontend && npx tsc --noEmit`

**Commit:** `feat: register SBOM routes in frontend router`

---

## Task 1.8: SBOM Service Tests

**Files:** `orion-platform-service/src/__tests__/sbom.test.ts`

```typescript
import { SBOMService } from '../services/SBOMService';

describe('SBOMService MVP', () => {
  let service: SBOMService;
  beforeEach(() => { service = new SBOMService(); });

  it('should create and list a document', async () => {
    const doc = await service.createDocument({
      buildId: 'build-1', pipelineRunId: 'run-1',
      format: 'cyclonedx', content: { components: [{ name: 'lodash', version: '4.17.21' }] },
    });
    expect(doc.buildId).toBe('build-1');
    const { data, total } = await service.listDocuments();
    expect(total).toBe(1);
  });

  it('should fail gate with critical vulns', async () => {
    const doc = await service.createDocument({
      buildId: 'build-2', pipelineRunId: 'run-2',
      format: 'cyclonedx', content: { components: [] },
    });
    await service.recordVulnerabilityScan({
      sbomId: doc.id, totalVulns: 3, criticalCount: 1, highCount: 2,
      mediumCount: 0, lowCount: 0, gatePolicy: 'block-critical',
    });
    const gate = await service.evaluateGate(doc.id, 'block-critical');
    expect(gate.passed).toBe(false);
    expect(gate.reason).toContain('critical');
  });

  it('should pass gate when no critical vulns', async () => {
    const doc = await service.createDocument({
      buildId: 'build-3', pipelineRunId: 'run-3',
      format: 'cyclonedx', content: { components: [] },
    });
    await service.recordVulnerabilityScan({
      sbomId: doc.id, totalVulns: 2, criticalCount: 0, highCount: 2,
      mediumCount: 0, lowCount: 0, gatePolicy: 'block-critical',
    });
    expect((await service.evaluateGate(doc.id, 'block-critical')).passed).toBe(true);
  });

  it('should return compliance report', async () => {
    const report = await service.getComplianceReport();
    expect(report).toHaveProperty('totalBuilds');
    expect(report).toHaveProperty('sbomCoverage');
  });
});
```

**Command:** `cd orion-platform-service && npx jest src/__tests__/sbom.test.ts`

**Commit:** `test: add SBOM service unit tests`

---

# Feature 2: OPA Policy-as-Code Engine

## MVP Scope
Manage policy definitions, store Rego source, evaluate policies against input JSON, track violations, basic UI for policy management and violation dashboard. Skip Git bundle sync and OPA sidecar for MVP.

---

## Task 2.1: Policy Database Models

**Files:** `orion-platform-service/src/models/Policy.ts`

```typescript
import { v4 as uuidv4 } from 'uuid';

export interface PolicyDefinition {
  id: string;
  name: string;
  description?: string;
  category: 'security' | 'cost' | 'quality' | 'governance';
  regoPath: string;
  regoSource: string;
  gateId?: string;
  severity: 'block' | 'warning' | 'info';
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PolicyEvaluation {
  id: string;
  policyId: string;
  runId: string;
  inputContext: Record<string, unknown>;
  result: { allow: boolean; reasons?: string[] };
  evaluatedAt: Date;
  evaluationMs?: number;
}

export interface PolicyViolation {
  id: string;
  evaluationId: string;
  policyId: string;
  severity: string;
  message: string;
  resourceType?: string;
  resourceId?: string;
  status: 'open' | 'waived' | 'resolved';
  createdAt: Date;
}

export interface PolicyOverride {
  id: string;
  policyId: string;
  violationId?: string;
  reason: string;
  approvedBy: string;
  approvedAt: Date;
  expiresAt: Date;
  scope: 'global' | 'project' | 'environment';
}

export function createPolicyDefinition(input: {
  name: string; description?: string; category: string;
  regoPath: string; regoSource: string; gateId?: string;
  severity?: string; metadata?: Record<string, unknown>;
}): PolicyDefinition {
  const now = new Date();
  return {
    id: uuidv4(), name: input.name, description: input.description,
    category: input.category as PolicyDefinition['category'],
    regoPath: input.regoPath, regoSource: input.regoSource,
    gateId: input.gateId,
    severity: (input.severity as PolicyDefinition['severity']) || 'warning',
    enabled: true, metadata: input.metadata || {},
    createdAt: now, updatedAt: now,
  };
}
```

**Commit:** `feat: add Policy data models`

---

## Task 2.2: Policy Service

**Files:** `orion-platform-service/src/services/PolicyService.ts`

```typescript
import pino from 'pino';
import { PolicyDefinition, PolicyEvaluation, PolicyViolation, PolicyOverride, createPolicyDefinition } from '../models/Policy';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export class PolicyService {
  private policies: Map<string, PolicyDefinition> = new Map();
  private evaluations: Map<string, PolicyEvaluation> = new Map();
  private violations: Map<string, PolicyViolation> = new Map();
  private overrides: Map<string, PolicyOverride> = new Map();

  async createPolicy(input: {
    name: string; description?: string; category: string;
    regoPath: string; regoSource: string; gateId?: string;
    severity?: string; metadata?: Record<string, unknown>;
  }): Promise<PolicyDefinition> {
    const policy = createPolicyDefinition(input);
    this.policies.set(policy.id, policy);
    logger.info({ id: policy.id, name: policy.name }, 'Policy created');
    return policy;
  }

  async listPolicies(filters?: { category?: string; enabled?: boolean }): Promise<PolicyDefinition[]> {
    let policies = Array.from(this.policies.values());
    if (filters?.category) policies = policies.filter(p => p.category === filters.category);
    if (filters?.enabled !== undefined) policies = policies.filter(p => p.enabled === filters.enabled);
    return policies;
  }

  async getPolicy(id: string): Promise<PolicyDefinition | undefined> {
    return this.policies.get(id);
  }

  async updatePolicy(id: string, updates: Partial<PolicyDefinition>): Promise<PolicyDefinition | undefined> {
    const policy = this.policies.get(id);
    if (!policy) return undefined;
    Object.assign(policy, updates, { updatedAt: new Date() });
    return policy;
  }

  async togglePolicy(id: string): Promise<PolicyDefinition | undefined> {
    const policy = this.policies.get(id);
    if (!policy) return undefined;
    policy.enabled = !policy.enabled;
    policy.updatedAt = new Date();
    return policy;
  }

  async deletePolicy(id: string): Promise<boolean> {
    return this.policies.delete(id);
  }

  /**
   * Evaluate a single policy using a simple Rego interpreter.
   * MVP: Parse allow/deny from rego comments and basic rules.
   * Full implementation would integrate with OPA WASM.
   */
  async evaluatePolicy(policyId: string, inputContext: Record<string, unknown>, runId: string): Promise<PolicyEvaluation> {
    const policy = this.policies.get(policyId);
    if (!policy) throw new Error(`Policy ${policyId} not found`);
    if (!policy.enabled) {
      return { id: `eval-${Date.now()}`, policyId, runId, inputContext, result: { allow: true, reasons: ['Policy disabled'] }, evaluatedAt: new Date(), evaluationMs: 0 };
    }

    const startTime = Date.now();
    const result = this._evaluateRego(policy.regoSource, inputContext);
    const evalMs = Date.now() - startTime;

    const evaluation: PolicyEvaluation = {
      id: `eval-${Date.now()}`, policyId, runId, inputContext,
      result, evaluatedAt: new Date(), evaluationMs: evalMs,
    };
    this.evaluations.set(evaluation.id, evaluation);

    if (!result.allow && policy.severity === 'block') {
      const violation: PolicyViolation = {
        id: `viol-${Date.now()}`, evaluationId: evaluation.id,
        policyId, severity: 'block',
        message: result.reasons?.join('; ') || 'Policy denied',
        status: 'open', createdAt: new Date(),
      };
      this.violations.set(violation.id, violation);
    }

    return evaluation;
  }

  /**
   * Evaluate all policies for a given gate.
   */
  async evaluateGate(gateId: string, inputContext: Record<string, unknown>, runId: string): Promise<{
    passed: boolean; evaluations: PolicyEvaluation[]; violations: PolicyViolation[];
  }> {
    const policies = (await this.listPolicies()).filter(p => p.gateId === gateId && p.enabled);
    const evaluations: PolicyEvaluation[] = [];
    const violations: PolicyViolation[] = [];

    for (const policy of policies) {
      const eval_ = await this.evaluatePolicy(policy.id, inputContext, runId);
      evaluations.push(eval_);
      if (!eval_.result.allow) {
        const policyViolations = Array.from(this.violations.values()).filter(v => v.evaluationId === eval_.id);
        violations.push(...policyViolations);
      }
    }

    const hasBlock = evaluations.some(e => {
      const policy = this.policies.get(e.policyId);
      return !e.result.allow && policy?.severity === 'block';
    });

    return { passed: !hasBlock, evaluations, violations };
  }

  async getEvaluations(runId?: string): Promise<PolicyEvaluation[]> {
    let evals = Array.from(this.evaluations.values());
    if (runId) evals = evals.filter(e => e.runId === runId);
    return evals;
  }

  async getViolations(filters?: { status?: string; severity?: string }): Promise<PolicyViolation[]> {
    let violations = Array.from(this.violations.values());
    if (filters?.status) violations = violations.filter(v => v.status === filters.status);
    if (filters?.severity) violations = violations.filter(v => v.severity === filters.severity);
    return violations;
  }

  async waiveViolation(violationId: string, reason: string): Promise<PolicyViolation | undefined> {
    const violation = this.violations.get(violationId);
    if (!violation) return undefined;
    violation.status = 'waived';
    return violation;
  }

  async resolveViolation(violationId: string): Promise<PolicyViolation | undefined> {
    const violation = this.violations.get(violationId);
    if (!violation) return undefined;
    violation.status = 'resolved';
    return violation;
  }

  async createOverride(input: {
    policyId: string; violationId?: string; reason: string;
    approvedBy: string; expiresAt: Date; scope?: string;
  }): Promise<PolicyOverride> {
    const override: PolicyOverride = {
      id: uuidv4(), ...input,
      scope: (input.scope as any) || 'global',
      approvedAt: new Date(),
    };
    this.overrides.set(override.id, override);
    return override;
  }

  /**
   * MVP Rego evaluator - parses simple allow/deny rules.
   * Full implementation would use OPA WASM (@openpolicyagent/opa-wasm).
   */
  private _evaluateRego(regoSource: string, input: Record<string, unknown>): { allow: boolean; reasons?: string[] } {
    // MVP: Look for "deny" or "allow" rules in the Rego source
    const hasDeny = /deny\s*[=:{]/.test(regoSource);
    const hasExplicitAllow = /allow\s*[=:{]/.test(regoSource);

    // MVP heuristic: if rego contains "deny", check input against simple patterns
    if (hasDeny) {
      // Check for common denial patterns in the input
      const reasons: string[] = [];

      // Check for root user pattern
      if (regoSource.includes('root') && (input as any).user === 'root') {
        reasons.push('Running as root user is not allowed');
      }

      // Check for privileged container pattern
      if (regoSource.includes('privileged') && (input as any).privileged === true) {
        reasons.push('Privileged container is not allowed');
      }

      // Check for latest tag pattern
      if (regoSource.includes('latest') && (input as any).imageTag === 'latest') {
        reasons.push('Using "latest" tag is not allowed');
      }

      // Check for missing resource limits
      if (regoSource.includes('resources') && !(input as any).resources) {
        reasons.push('Resource limits are required');
      }

      // Generic fallback: if deny rule exists but no specific match, allow with warning
      if (reasons.length === 0) {
        return { allow: true, reasons: ['Policy evaluated, no specific violations detected'] };
      }

      return { allow: false, reasons };
    }

    return { allow: true, reasons: ['Policy passed'] };
  }
}
```

**Commit:** `feat: implement PolicyService with CRUD, evaluation, and gate logic`

---

## Task 2.3: Policy Controller

**Files:** `orion-platform-service/src/api/controllers/PolicyController.ts`

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { PolicyService } from '../../services/PolicyService';

export class PolicyController {
  private service: PolicyService;
  constructor(service: PolicyService) { this.service = service; }

  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any || {};
      if (!body.name || !body.category || !body.regoPath || !body.regoSource) {
        await reply.status(400).send({ error: 'VALIDATION_ERROR', code: '30101', message: 'Missing required fields' }); return;
      }
      await reply.status(201).send(await this.service.createPolicy(body));
    } catch (error) {
      await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000', message: error instanceof Error ? error.message : 'Failed to create policy' });
    }
  }

  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      const policies = await this.service.listPolicies({ category: query.category, enabled: query.enabled !== undefined ? query.enabled === 'true' : undefined });
      await reply.send({ data: policies, total: policies.length });
    } catch (error) {
      await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000', message: error instanceof Error ? error.message : 'Failed to list policies' });
    }
  }

  async getById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const policy = await this.service.getPolicy((request.params as any).id);
      if (!policy) { await reply.status(404).send({ error: 'NOT_FOUND', code: '30201', message: 'Policy not found' }); return; }
      await reply.send(policy);
    } catch (error) {
      await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000', message: error instanceof Error ? error.message : 'Failed to get policy' });
    }
  }

  async update(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const updated = await this.service.updatePolicy((request.params as any).id, request.body as any);
      if (!updated) { await reply.status(404).send({ error: 'NOT_FOUND', code: '30201', message: 'Policy not found' }); return; }
      await reply.send(updated);
    } catch (error) {
      await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000', message: error instanceof Error ? error.message : 'Failed to update policy' });
    }
  }

  async toggle(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const policy = await this.service.togglePolicy((request.params as any).id);
      if (!policy) { await reply.status(404).send({ error: 'NOT_FOUND', code: '30201', message: 'Policy not found' }); return; }
      await reply.send(policy);
    } catch (error) {
      await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000', message: error instanceof Error ? error.message : 'Failed to toggle policy' });
    }
  }

  async delete(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const deleted = await this.service.deletePolicy((request.params as any).id);
      if (!deleted) { await reply.status(404).send({ error: 'NOT_FOUND', code: '30201', message: 'Policy not found' }); return; }
      await reply.status(204).send();
    } catch (error) {
      await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000', message: error instanceof Error ? error.message : 'Failed to delete policy' });
    }
  }

  async evaluate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any || {};
      if (!body.policyId || !body.input) { await reply.status(400).send({ error: 'VALIDATION_ERROR', code: '30101', message: 'Missing policyId or input' }); return; }
      const result = await this.service.evaluatePolicy(body.policyId, body.input, body.runId || 'manual');
      await reply.send(result);
    } catch (error) {
      await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000', message: error instanceof Error ? error.message : 'Failed to evaluate policy' });
    }
  }

  async evaluateGate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { gateId } = request.params as any;
      const body = request.body as any || {};
      if (!body.input) { await reply.status(400).send({ error: 'VALIDATION_ERROR', code: '30101', message: 'Missing input' }); return; }
      const result = await this.service.evaluateGate(gateId, body.input, body.runId || 'manual');
      await reply.send(result);
    } catch (error) {
      await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000', message: error instanceof Error ? error.message : 'Failed to evaluate gate' });
    }
  }

  async getViolations(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      const violations = await this.service.getViolations({ status: query.status, severity: query.severity });
      await reply.send({ data: violations, total: violations.length });
    } catch (error) {
      await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000', message: error instanceof Error ? error.message : 'Failed to get violations' });
    }
  }

  async waiveViolation(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const violation = await this.service.waiveViolation((request.params as any).id, (request.body as any).reason || 'Waived');
      if (!violation) { await reply.status(404).send({ error: 'NOT_FOUND', code: '30201', message: 'Violation not found' }); return; }
      await reply.send(violation);
    } catch (error) {
      await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000', message: error instanceof Error ? error.message : 'Failed to waive violation' });
    }
  }

  async resolveViolation(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const violation = await this.service.resolveViolation((request.params as any).id);
      if (!violation) { await reply.status(404).send({ error: 'NOT_FOUND', code: '30201', message: 'Violation not found' }); return; }
      await reply.send(violation);
    } catch (error) {
      await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000', message: error instanceof Error ? error.message : 'Failed to resolve violation' });
    }
  }

  async getEvaluations(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const evaluations = await this.service.getEvaluations((request.query as any).runId);
      await reply.send({ data: evaluations, total: evaluations.length });
    } catch (error) {
      await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000', message: error instanceof Error ? error.message : 'Failed to get evaluations' });
    }
  }
}
```

**Commit:** `feat: implement PolicyController with all REST endpoints`

---

## Task 2.4: Policy Routes

**Files:** `orion-platform-service/src/routes-policy.ts`

```typescript
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PolicyService } from './services/PolicyService';
import { PolicyController } from './api/controllers/PolicyController';

export default async function registerPolicyRoutes(app: FastifyInstance): Promise<void> {
  const service = new PolicyService();
  const ctrl = new PolicyController(service);

  app.get('/policies', async (req, rep) => ctrl.list(req, rep));
  app.post('/policies', async (req, rep) => ctrl.create(req, rep));
  app.get('/policies/:id', async (req, rep) => ctrl.getById(req, rep));
  app.put('/policies/:id', async (req, rep) => ctrl.update(req, rep));
  app.delete('/policies/:id', async (req, rep) => ctrl.delete(req, rep));
  app.patch('/policies/:id/toggle', async (req, rep) => ctrl.toggle(req, rep));
  app.post('/policies/evaluate', async (req, rep) => ctrl.evaluate(req, rep));
  app.post('/policies/gate/:gateId/evaluate', async (req, rep) => ctrl.evaluateGate(req, rep));
  app.get('/policies/violations', async (req, rep) => ctrl.getViolations(req, rep));
  app.post('/policies/violations/:id/waive', async (req, rep) => ctrl.waiveViolation(req, rep));
  app.post('/policies/violations/:id/resolve', async (req, rep) => ctrl.resolveViolation(req, rep));
  app.get('/policies/evaluations', async (req, rep) => ctrl.getEvaluations(req, rep));
}
```

**Integration:** Add to server.ts:
```typescript
import registerPolicyRoutes from './routes-policy';
await app.register(registerPolicyRoutes, { prefix: '/api/v1' });
```

**Commit:** `feat: register OPA policy routes with Fastify`

---

## Task 2.5: Policy Frontend API Client

**Files:** `orion-frontend/src/api/policies.ts`

```typescript
import { api } from './client';

export interface PolicyDefinition {
  id: string; name: string; description?: string;
  category: 'security' | 'cost' | 'quality' | 'governance';
  regoPath: string; regoSource: string; gateId?: string;
  severity: 'block' | 'warning' | 'info';
  enabled: boolean; createdAt: string; updatedAt: string;
}

export interface PolicyViolation {
  id: string; policyId: string; severity: string;
  message: string; status: 'open' | 'waived' | 'resolved';
  createdAt: string;
}

export interface PolicyEvaluation {
  id: string; policyId: string; runId: string;
  result: { allow: boolean; reasons?: string[] };
  evaluatedAt: string; evaluationMs?: number;
}

export function getPolicies(params?: { category?: string; enabled?: boolean }) {
  return api.get('/v1/policies', { params });
}
export function createPolicy(data: { name: string; description?: string; category: string; regoPath: string; regoSource: string; gateId?: string; severity?: string }) {
  return api.post('/v1/policies', data);
}
export function getPolicy(id: string) {
  return api.get(`/v1/policies/${id}`);
}
export function updatePolicy(id: string, data: Partial<PolicyDefinition>) {
  return api.put(`/v1/policies/${id}`, data);
}
export function deletePolicy(id: string) {
  return api.delete(`/v1/policies/${id}`);
}
export function togglePolicy(id: string) {
  return api.patch(`/v1/policies/${id}/toggle`);
}
export function evaluatePolicy(data: { policyId: string; input: Record<string, unknown>; runId?: string }) {
  return api.post('/v1/policies/evaluate', data);
}
export function evaluateGate(gateId: string, data: { input: Record<string, unknown>; runId?: string }) {
  return api.post(`/v1/policies/gate/${gateId}/evaluate`, data);
}
export function getViolations(params?: { status?: string; severity?: string }) {
  return api.get('/v1/policies/violations', { params });
}
export function waiveViolation(id: string, reason?: string) {
  return api.post(`/v1/policies/violations/${id}/waive`, { reason });
}
export function resolveViolation(id: string) {
  return api.post(`/v1/policies/violations/${id}/resolve`);
}
export function getEvaluations(runId?: string) {
  return api.get('/v1/policies/evaluations', { params: { runId } });
}
```

**Commit:** `feat: add Policy API client`

---

## Task 2.6: Policy Management UI

**Files:** `orion-frontend/src/pages/PolicyManagement/index.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { Typography, Table, Tag, Switch, Button, Space, Modal, Form, Input, Select, message, Tabs } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { getPolicies, createPolicy, togglePolicy, getViolations, waiveViolation, type PolicyDefinition, type PolicyViolation } from '@/api/policies';
import dayjs from 'dayjs';

const { Title } = Typography;

const categoryColors: Record<string, string> = { security: 'red', cost: 'gold', quality: 'blue', governance: 'purple' };
const severityColors: Record<string, string> = { block: 'red', warning: 'orange', info: 'blue' };

export default function PolicyManagement() {
  const [policies, setPolicies] = useState<PolicyDefinition[]>([]);
  const [violations, setViolations] = useState<PolicyViolation[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [polRes, violRes] = await Promise.all([getPolicies(), getViolations({ status: 'open' })]);
      setPolicies(polRes.data.data || []);
      setViolations(violRes.data.data || []);
    } catch { message.error('Failed to fetch data'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleToggle = async (id: string, checked: boolean) => {
    try { await togglePolicy(id); fetchData(); }
    catch { message.error('Failed to toggle policy'); }
  };

  const handleCreate = async (values: any) => {
    try { await createPolicy(values); setModalOpen(false); form.resetFields(); fetchData(); message.success('Policy created'); }
    catch { message.error('Failed to create policy'); }
  };

  const policyColumns = [
    { title: 'Name', dataIndex: 'name', key: 'name', width: 200 },
    { title: 'Category', dataIndex: 'category', key: 'category', render: (c: string) => <Tag color={categoryColors[c]}>{c}</Tag> },
    { title: 'Severity', dataIndex: 'severity', key: 'severity', render: (s: string) => <Tag color={severityColors[s]}>{s}</Tag> },
    { title: 'Gate', dataIndex: 'gateId', key: 'gateId', render: (g: string) => g || '-' },
    { title: 'Enabled', dataIndex: 'enabled', key: 'enabled', render: (checked: boolean, record: PolicyDefinition) => <Switch checked={checked} onChange={(v) => handleToggle(record.id, v)} size="small" /> },
    { title: 'Updated', dataIndex: 'updatedAt', key: 'updatedAt', width: 180, render: (d: string) => dayjs(d).format('YYYY-MM-DD HH:mm') },
  ];

  const violationColumns = [
    { title: 'Message', dataIndex: 'message', key: 'message', ellipsis: true },
    { title: 'Severity', dataIndex: 'severity', key: 'severity', render: (s: string) => <Tag color={severityColors[s] || 'default'}>{s}</Tag> },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (s: string) => <Tag>{s}</Tag> },
    { title: 'Created', dataIndex: 'createdAt', key: 'createdAt', width: 180, render: (d: string) => dayjs(d).format('YYYY-MM-DD HH:mm') },
    { title: 'Actions', key: 'actions', render: (_: any, record: PolicyViolation) => (
      <Space>
        <Button type="link" size="small" onClick={async () => { try { await waiveViolation(record.id); fetchData(); } catch { message.error('Failed'); } }}>Waive</Button>
        <Button type="link" size="small" onClick={async () => { try { await resolveViolationApi(record.id); fetchData(); } catch { message.error('Failed'); } }}>Resolve</Button>
      </Space>
    )},
  ];

  const { resolveViolation: resolveViolationApi } = { resolveViolation: async (id: string) => {
    const { api } = await import('@/api/client');
    return api.post(`/v1/policies/violations/${id}/resolve`);
  }};

  return (
    <div style={{ padding: 24 }}>
      <Tabs defaultActiveKey="policies" items={[
        {
          key: 'policies', label: 'Policies', children: (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <Title level={4}>Policy Definitions</Title>
                <Space>
                  <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>Refresh</Button>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>Add Policy</Button>
                </Space>
              </div>
              <Table columns={policyColumns} dataSource={policies} rowKey="id" loading={loading} pagination={{ pageSize: 20 }} />
            </>
          ),
        },
        {
          key: 'violations', label: `Violations (${violations.length})`, children: (
            <>
              <Title level={4}>Open Violations</Title>
              <Table columns={violationColumns} dataSource={violations} rowKey="id" loading={loading} pagination={{ pageSize: 20 }} />
            </>
          ),
        },
      ]} />
      <Modal title="Create Policy" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Description"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="category" label="Category" rules={[{ required: true }]}>
            <Select options={[{ value: 'security', label: 'Security' }, { value: 'cost', label: 'Cost' }, { value: 'quality', label: 'Quality' }, { value: 'governance', label: 'Governance' }]} />
          </Form.Item>
          <Form.Item name="severity" label="Severity" rules={[{ required: true }]}>
            <Select options={[{ value: 'block', label: 'Block' }, { value: 'warning', label: 'Warning' }, { value: 'info', label: 'Info' }]} />
          </Form.Item>
          <Form.Item name="regoPath" label="Rego Path" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="regoSource" label="Rego Source" rules={[{ required: true }]}><Input.TextArea rows={6} /></Form.Item>
          <Form.Item name="gateId" label="Gate ID"><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
```

**Commit:** `feat: add Policy Management page with violations dashboard`

---

## Task 2.7: Router Registration

**Files:** `orion-frontend/src/router/routes.ts`

```typescript
{
  path: '/console/policies',
  element: React.lazy(() => import('@/pages/PolicyManagement')),
  protected: true,
},
```

**Commit:** `feat: register Policy routes in frontend router`

---

## Task 2.8: Policy Service Tests

**Files:** `orion-platform-service/src/__tests__/policy.test.ts`

```typescript
import { PolicyService } from '../services/PolicyService';

describe('PolicyService MVP', () => {
  let service: PolicyService;
  beforeEach(() => { service = new PolicyService(); });

  it('should create and list policies', async () => {
    const policy = await service.createPolicy({
      name: 'no-root', category: 'security',
      regoPath: 'policies/no-root.rego',
      regoSource: 'package main\ndeny { input.user == "root" }',
    });
    expect(policy.name).toBe('no-root');
    expect(policy.enabled).toBe(true);
    const policies = await service.listPolicies();
    expect(policies.length).toBe(1);
  });

  it('should evaluate policy and detect violations', async () => {
    const policy = await service.createPolicy({
      name: 'no-root', category: 'security', severity: 'block',
      regoPath: 'policies/no-root.rego',
      regoSource: 'package main\ndeny { input.user == "root" }',
    });
    const result = await service.evaluatePolicy(policy.id, { user: 'root' }, 'run-1');
    expect(result.result.allow).toBe(false);
    expect(result.result.reasons).toContain('Running as root user is not allowed');
  });

  it('should pass policy when input is valid', async () => {
    const policy = await service.createPolicy({
      name: 'no-root', category: 'security', severity: 'block',
      regoPath: 'policies/no-root.rego',
      regoSource: 'package main\ndeny { input.user == "root" }',
    });
    const result = await service.evaluatePolicy(policy.id, { user: 'appuser' }, 'run-2');
    expect(result.result.allow).toBe(true);
  });

  it('should evaluate gate with multiple policies', async () => {
    await service.createPolicy({ name: 'no-root', category: 'security', severity: 'block', regoPath: 'policies/no-root.rego', regoSource: 'deny { input.user == "root" }', gateId: 'build-gate' });
    await service.createPolicy({ name: 'no-latest', category: 'security', severity: 'block', regoPath: 'policies/no-latest.rego', regoSource: 'deny { input.imageTag == "latest" }', gateId: 'build-gate' });
    const result = await service.evaluateGate('build-gate', { user: 'appuser', imageTag: 'latest' }, 'run-3');
    expect(result.passed).toBe(false);
  });

  it('should toggle policy', async () => {
    const policy = await service.createPolicy({ name: 'test', category: 'security', regoPath: 'test.rego', regoSource: '' });
    expect(policy.enabled).toBe(true);
    const toggled = await service.togglePolicy(policy.id);
    expect(toggled?.enabled).toBe(false);
  });
});
```

**Command:** `cd orion-platform-service && npx jest src/__tests__/policy.test.ts`

**Commit:** `test: add Policy service unit tests`

---

# Feature 3: AI Change Intelligence

## MVP Scope
Analyze PR changes, compute heuristic risk score (file count, tier affected, change size), identify affected services via config mapping, display risk dashboard. Skip CodeBERT/Neo4j/XGBoost for MVP -- use rule-based scoring.

---

## Task 3.1: Change Intelligence Models

**Files:** `orion-platform-service/src/models/ChangeIntelligence.ts`

```typescript
import { v4 as uuidv4 } from 'uuid';

export interface CIReport {
  id: string;
  prId: string;
  repoId: string;
  commitSha: string;
  riskScore: number;       // 0.00 - 1.00
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  affectedServices: number;
  affectedCapabilities: number;
  shapFactors: RiskFactor[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RiskFactor {
  factorName: string;
  factorValue: number;
  weight: number;
  contribution: number;
  description: string;
}

export interface AffectedService {
  id: string;
  reportId: string;
  serviceName: string;
  serviceTier: string;
  impactType: 'direct' | 'dependency' | 'indirect';
  changedFiles: string[];
  sloRisk: 'none' | 'low' | 'medium' | 'high';
  recommendedReviewers: string[];
}

export function createCIReport(input: {
  prId: string; repoId: string; commitSha: string;
  riskScore: number; shapFactors: RiskFactor[];
  affectedServices: number; affectedCapabilities: number;
}): CIReport {
  const now = new Date();
  const score = Math.min(1, Math.max(0, input.riskScore));
  return {
    id: uuidv4(), ...input, riskScore: Math.round(score * 100) / 100,
    riskLevel: score < 0.25 ? 'low' : score < 0.5 ? 'medium' : score < 0.75 ? 'high' : 'critical',
    createdAt: now, updatedAt: now,
  };
}
```

**Commit:** `feat: add Change Intelligence data models`

---

## Task 3.2: Change Intelligence Service

**Files:** `orion-platform-service/src/services/ChangeIntelligenceService.ts`

```typescript
import pino from 'pino';
import { CIReport, AffectedService, RiskFactor, createCIReport } from '../models/ChangeIntelligence';
import { v4 as uuidv4 } from 'uuid';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// MVP: Simple file-to-service mapping
const FILE_SERVICE_MAP: Record<string, string> = {
  'src/api/': 'api-gateway', 'src/auth/': 'auth-service',
  'src/payment/': 'payment-service', 'src/user/': 'user-service',
  'src/notification/': 'notification-service', 'src/inventory/': 'inventory-service',
  'src/search/': 'search-service', 'src/analytics/': 'analytics-service',
  'src/config/': 'config-service', 'src/database/': 'database-service',
};

const SERVICE_TIER: Record<string, string> = {
  'auth-service': 'tier-0', 'payment-service': 'tier-0',
  'api-gateway': 'tier-0', 'user-service': 'tier-1',
  'notification-service': 'tier-2', 'inventory-service': 'tier-1',
  'search-service': 'tier-1', 'analytics-service': 'tier-2',
  'config-service': 'tier-1', 'database-service': 'tier-0',
};

export class ChangeIntelligenceService {
  private reports: Map<string, CIReport> = new Map();
  private affectedServices: Map<string, AffectedService[]> = new Map();

  async analyzePR(input: {
    prId: string; repoId: string; commitSha: string;
    changedFiles: string[]; additions: number; deletions: number;
  }): Promise<CIReport> {
    const factors = this._computeRiskFactors(input.changedFiles, input.additions, input.deletions);
    const riskScore = this._aggregateScore(factors);
    const services = this._mapServices(input.changedFiles);

    const report = createCIReport({
      prId: input.prId, repoId: input.repoId, commitSha: input.commitSha,
      riskScore, shapFactors: factors,
      affectedServices: services.length,
      affectedCapabilities: new Set(services.map(s => s.serviceName)).size,
    });

    this.reports.set(report.id, report);
    this.affectedServices.set(report.id, services);

    logger.info({ id: report.id, prId: input.prId, riskScore }, 'CI analysis complete');
    return report;
  }

  async getReport(id: string): Promise<CIReport | undefined> {
    return this.reports.get(id);
  }

  async listReports(filters?: { prId?: string; repoId?: string }): Promise<CIReport[]> {
    let reports = Array.from(this.reports.values());
    if (filters?.prId) reports = reports.filter(r => r.prId === filters.prId);
    if (filters?.repoId) reports = reports.filter(r => r.repoId === filters.repoId);
    return reports.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getAffectedServices(reportId: string): Promise<AffectedService[]> {
    return this.affectedServices.get(reportId) || [];
  }

  async getTrends(repoId: string, days: number = 30): Promise<{ date: string; avgRisk: number; count: number }[]> {
    const reports = Array.from(this.reports.values()).filter(r => r.repoId === repoId);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const filtered = reports.filter(r => r.createdAt >= cutoff);

    const dailyMap = new Map<string, { total: number; count: number }>();
    for (const r of filtered) {
      const date = r.createdAt.toISOString().split('T')[0];
      const existing = dailyMap.get(date) || { total: 0, count: 0 };
      existing.total += r.riskScore;
      existing.count++;
      dailyMap.set(date, existing);
    }

    return Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, avgRisk: Math.round((data.total / data.count) * 100) / 100, count: data.count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private _computeRiskFactor(files: string[], additions: number, deletions: number): RiskFactor[] {
    const factors: RiskFactor[] = [];
    const totalChanges = additions + deletions;
    const affectedTierServices = this._getAffectedTierServices(files);

    // Factor 1: File count
    const fileCountValue = Math.min(1, files.length / 50);
    factors.push({
      factorName: 'file_count', factorValue: fileCountValue, weight: 0.15,
      contribution: fileCountValue * 0.15, description: `Number of changed files: ${files.length}`,
    });

    // Factor 2: Change volume
    const changeVolumeValue = Math.min(1, totalChanges / 5000);
    factors.push({
      factorName: 'change_volume', factorValue: changeVolumeValue, weight: 0.15,
      contribution: changeVolumeValue * 0.15, description: `Total lines changed: ${totalChanges}`,
    });

    // Factor 3: Tier-0 services affected
    const tier0Value = Math.min(1, affectedTierServices['tier-0'].length / 3);
    factors.push({
      factorName: 'tier0_impact', factorValue: tier0Value, weight: 0.35,
      contribution: tier0Value * 0.35, description: `Tier-0 services affected: ${affectedTierServices['tier-0'].join(', ') || 'none'}`,
    });

    // Factor 4: Number of services affected
    const serviceCountValue = Math.min(1, new Set(this._mapServices(files).map(s => s.serviceName)).size / 5);
    factors.push({
      factorName: 'service_count', factorValue: serviceCountValue, weight: 0.20,
      contribution: serviceCountValue * 0.20, description: `Services affected: ${new Set(this._mapServices(files).map(s => s.serviceName)).size}`,
    });

    // Factor 5: Deletion ratio (deletions are riskier)
    const deletionRatio = totalChanges > 0 ? deletions / totalChanges : 0;
    factors.push({
      factorName: 'deletion_ratio', factorValue: deletionRatio, weight: 0.15,
      contribution: deletionRatio * 0.15, description: `Deletion ratio: ${(deletionRatio * 100).toFixed(0)}%`,
    });

    return factors;
  }

  private _computeRiskFactors(files: string[], additions: number, deletions: number): RiskFactor[] {
    return this._computeRiskFactor(files, additions, deletions);
  }

  private _aggregateScore(factors: RiskFactor[]): number {
    return Math.min(1, factors.reduce((sum, f) => sum + f.contribution, 0));
  }

  private _mapServices(files: string[]): AffectedService[] {
    const serviceMap = new Map<string, string[]>();
    for (const file of files) {
      for (const [path, service] of Object.entries(FILE_SERVICE_MAP)) {
        if (file.includes(path)) {
          if (!serviceMap.has(service)) serviceMap.set(service, []);
          serviceMap.get(service)!.push(file);
          break;
        }
      }
    }

    return Array.from(serviceMap.entries()).map(([service, files]) => ({
      id: uuidv4(), reportId: '', serviceName: service,
      serviceTier: SERVICE_TIER[service] || 'tier-2',
      impactType: 'direct', changedFiles: files,
      sloRisk: SERVICE_TIER[service] === 'tier-0' ? 'high' : SERVICE_TIER[service] === 'tier-1' ? 'medium' : 'low',
      recommendedReviewers: this._getRecommendedReviewers(service),
    }));
  }

  private _getAffectedTierServices(files: string[]): Record<string, string[]> {
    const services = this._mapServices(files);
    const result: Record<string, string[]> = { 'tier-0': [], 'tier-1': [], 'tier-2': [] };
    for (const s of services) {
      result[s.serviceTier].push(s.serviceName);
    }
    return result;
  }

  private _getRecommendedReviewers(service: string): string[] {
    const owners: Record<string, string[]> = {
      'auth-service': ['@auth-team'], 'payment-service': ['@payments-team'],
      'api-gateway': ['@platform-team'], 'user-service': ['@users-team'],
    };
    return owners[service] || ['@team'];
  }
}
```

**Commit:** `feat: implement ChangeIntelligenceService with heuristic risk scoring`

---

## Task 3.3: Change Intelligence Controller

**Files:** `orion-platform-service/src/api/controllers/ChangeIntelligenceController.ts`

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { ChangeIntelligenceService } from '../../services/ChangeIntelligenceService';

export class ChangeIntelligenceController {
  private service: ChangeIntelligenceService;
  constructor(service: ChangeIntelligenceService) { this.service = service; }

  async analyze(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any || {};
      if (!body.prId || !body.repoId || !body.commitSha || !body.changedFiles) {
        await reply.status(400).send({ error: 'VALIDATION_ERROR', code: '30101', message: 'Missing required fields' }); return;
      }
      const report = await this.service.analyzePR({
        prId: body.prId, repoId: body.repoId, commitSha: body.commitSha,
        changedFiles: body.changedFiles, additions: body.additions || 0, deletions: body.deletions || 0,
      });
      await reply.status(201).send(report);
    } catch (error) {
      await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000', message: error instanceof Error ? error.message : 'Failed to analyze' });
    }
  }

  async listReports(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      const reports = await this.service.listReports({ prId: query.prId, repoId: query.repoId });
      await reply.send({ data: reports, total: reports.length });
    } catch (error) {
      await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000', message: error instanceof Error ? error.message : 'Failed to list reports' });
    }
  }

  async getReport(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const report = await this.service.getReport((request.params as any).id);
      if (!report) { await reply.status(404).send({ error: 'NOT_FOUND', code: '30201', message: 'Report not found' }); return; }
      await reply.send(report);
    } catch (error) {
      await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000', message: error instanceof Error ? error.message : 'Failed to get report' });
    }
  }

  async getBlastRadius(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const services = await this.service.getAffectedServices((request.params as any).id);
      await reply.send({ data: services, total: services.length });
    } catch (error) {
      await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000', message: error instanceof Error ? error.message : 'Failed to get blast radius' });
    }
  }

  async getTrends(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      if (!query.repoId) { await reply.status(400).send({ error: 'VALIDATION_ERROR', code: '30101', message: 'Missing repoId' }); return; }
      const trends = await this.service.getTrends(query.repoId, query.days ? parseInt(query.days) : 30);
      await reply.send({ data: trends });
    } catch (error) {
      await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000', message: error instanceof Error ? error.message : 'Failed to get trends' });
    }
  }
}
```

**Commit:** `feat: implement ChangeIntelligenceController`

---

## Task 3.4: CI Routes

**Files:** `orion-platform-service/src/routes-change-intelligence.ts`

```typescript
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ChangeIntelligenceService } from './services/ChangeIntelligenceService';
import { ChangeIntelligenceController } from './api/controllers/ChangeIntelligenceController';

export default async function registerCIRoutes(app: FastifyInstance): Promise<void> {
  const service = new ChangeIntelligenceService();
  const ctrl = new ChangeIntelligenceController(service);

  app.post('/change-intelligence/analyze', async (req, rep) => ctrl.analyze(req, rep));
  app.get('/change-intelligence/reports', async (req, rep) => ctrl.listReports(req, rep));
  app.get('/change-intelligence/reports/:id', async (req, rep) => ctrl.getReport(req, rep));
  app.get('/change-intelligence/reports/:id/blast-radius', async (req, rep) => ctrl.getBlastRadius(req, rep));
  app.get('/change-intelligence/trends', async (req, rep) => ctrl.getTrends(req, rep));
}
```

**Integration:** Add to server.ts:
```typescript
import registerCIRoutes from './routes-change-intelligence';
await app.register(registerCIRoutes, { prefix: '/api/v1' });
```

**Commit:** `feat: register Change Intelligence routes`

---

## Task 3.5: CI Frontend API Client

**Files:** `orion-frontend/src/api/change-intelligence.ts`

```typescript
import { api } from './client';

export interface CIReport {
  id: string; prId: string; repoId: string; commitSha: string;
  riskScore: number; riskLevel: 'low' | 'medium' | 'high' | 'critical';
  affectedServices: number; affectedCapabilities: number;
  shapFactors: Array<{ factorName: string; factorValue: number; weight: number; contribution: number; description: string }>;
  createdAt: string;
}

export interface AffectedService {
  id: string; serviceName: string; serviceTier: string;
  impactType: string; changedFiles: string[]; sloRisk: string;
  recommendedReviewers: string[];
}

export function analyzePR(data: { prId: string; repoId: string; commitSha: string; changedFiles: string[]; additions?: number; deletions?: number }) {
  return api.post('/v1/change-intelligence/analyze', data);
}
export function getCIReports(params?: { prId?: string; repoId?: string }) {
  return api.get('/v1/change-intelligence/reports', { params });
}
export function getCIReport(id: string) {
  return api.get(`/v1/change-intelligence/reports/${id}`);
}
export function getBlastRadius(reportId: string) {
  return api.get(`/v1/change-intelligence/reports/${reportId}/blast-radius`);
}
export function getCITrends(repoId: string, days?: number) {
  return api.get('/v1/change-intelligence/trends', { params: { repoId, days } });
}
```

**Commit:** `feat: add Change Intelligence API client`

---

## Task 3.6: CI Report UI

**Files:** `orion-frontend/src/pages/ChangeIntelligence/index.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { Typography, Table, Tag, Button, Card, Row, Col, Progress, message, Descriptions } from 'antd';
import { ReloadOutlined, AlertOutlined } from '@ant-design/icons';
import { getCIReports, type CIReport } from '@/api/change-intelligence';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const riskColors: Record<string, string> = { low: 'green', medium: 'orange', high: 'red', critical: 'magenta' };

export default function ChangeIntelligencePage() {
  const [reports, setReports] = useState<CIReport[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getCIReports();
      setReports(res.data.data || []);
    } catch { message.error('Failed to fetch reports'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const columns = [
    { title: 'PR', dataIndex: 'prId', key: 'prId', width: 120 },
    { title: 'Commit', dataIndex: 'commitSha', key: 'commitSha', render: (sha: string) => sha?.slice(0, 8) || '-' },
    {
      title: 'Risk Score', dataIndex: 'riskScore', key: 'riskScore', width: 200,
      render: (score: number, record: CIReport) => (
        <div><Progress percent={Math.round(score * 100)} strokeColor={riskColors[record.riskLevel]} size="small" />{score.toFixed(2)}</div>
      ),
    },
    { title: 'Risk Level', dataIndex: 'riskLevel', key: 'riskLevel', render: (l: string) => <Tag color={riskColors[l]}>{l.toUpperCase()}</Tag> },
    { title: 'Services', dataIndex: 'affectedServices', key: 'affectedServices', width: 100, align: 'right' as const },
    { title: 'Created', dataIndex: 'createdAt', key: 'createdAt', width: 180, render: (d: string) => dayjs(d).format('YYYY-MM-DD HH:mm') },
    { title: 'Actions', key: 'actions', render: (_: any, r: CIReport) => (
      <Button type="link" size="small" onClick={() => window.location.href = `/console/change-intelligence/${r.id}`}>Details</Button>
    )},
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4}><AlertOutlined /> Change Intelligence Reports</Title>
        <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>Refresh</Button>
      </div>
      <Table columns={columns} dataSource={reports} rowKey="id" loading={loading} pagination={{ pageSize: 20 }} />
    </div>
  );
}
```

**Commit:** `feat: add Change Intelligence reports page`

---

## Task 3.7: Router Registration

**Files:** `orion-frontend/src/router/routes.ts`

```typescript
{
  path: '/console/change-intelligence',
  element: React.lazy(() => import('@/pages/ChangeIntelligence')),
  protected: true,
},
```

**Commit:** `feat: register Change Intelligence routes in frontend router`

---

## Task 3.8: CI Service Tests

**Files:** `orion-platform-service/src/__tests__/change-intelligence.test.ts`

```typescript
import { ChangeIntelligenceService } from '../services/ChangeIntelligenceService';

describe('ChangeIntelligenceService MVP', () => {
  let service: ChangeIntelligenceService;
  beforeEach(() => { service = new ChangeIntelligenceService(); });

  it('should analyze a PR and produce a risk score', async () => {
    const report = await service.analyzePR({
      prId: 'pr-1', repoId: 'repo-1', commitSha: 'abc123',
      changedFiles: ['src/api/handler.ts', 'src/auth/middleware.ts'],
      additions: 200, deletions: 50,
    });
    expect(report.riskScore).toBeGreaterThanOrEqual(0);
    expect(report.riskScore).toBeLessThanOrEqual(1);
    expect(report.shapFactors.length).toBeGreaterThan(0);
  });

  it('should produce higher risk for tier-0 changes', async () => {
    const lowReport = await service.analyzePR({
      prId: 'pr-2', repoId: 'repo-1', commitSha: 'def456',
      changedFiles: ['src/notification/email.ts'],
      additions: 100, deletions: 0,
    });
    const highReport = await service.analyzePR({
      prId: 'pr-3', repoId: 'repo-1', commitSha: 'ghi789',
      changedFiles: ['src/auth/token.ts', 'src/payment/charge.ts', 'src/api/gateway.ts'],
      additions: 500, deletions: 200,
    });
    expect(highReport.riskScore).toBeGreaterThan(lowReport.riskScore);
  });

  it('should map services correctly', async () => {
    const report = await service.analyzePR({
      prId: 'pr-4', repoId: 'repo-1', commitSha: 'jkl012',
      changedFiles: ['src/payment/charge.ts', 'src/payment/refund.ts'],
      additions: 50, deletions: 10,
    });
    const services = await service.getAffectedServices(report.id);
    expect(services.some(s => s.serviceName === 'payment-service')).toBe(true);
  });

  it('should return trends data', async () => {
    await service.analyzePR({ prId: 'pr-5', repoId: 'repo-1', commitSha: 'aaa', changedFiles: ['src/api/a.ts'], additions: 10, deletions: 0 });
    const trends = await service.getTrends('repo-1', 30);
    expect(trends.length).toBeGreaterThanOrEqual(1);
    expect(trends[0]).toHaveProperty('avgRisk');
    expect(trends[0]).toHaveProperty('count');
  });
});
```

**Command:** `cd orion-platform-service && npx jest src/__tests__/change-intelligence.test.ts`

**Commit:** `test: add Change Intelligence service unit tests`

---

# Feature 4: ML Canary Analysis

## MVP Scope
Manage analysis configs, run analysis with simulated metrics, store results in PostgreSQL, compute statistical verdicts (simplified), provide dashboard. Skip ClickHouse, Prometheus, XGBoost, and Argo Rollouts integration for MVP.

---

## Task 4.1: Canary Analysis Models

**Files:** `orion-platform-service/src/models/CanaryAnalysis.ts`

```typescript
import { v4 as uuidv4 } from 'uuid';

export interface CanaryAnalysisRun {
  id: string;
  deploymentId: string;
  runNumber: number;
  trafficSplit: { canary: number; baseline: number };
  status: 'running' | 'promote' | 'rollback' | 'inconclusive';
  confidence: number;
  decision: 'promote' | 'rollback' | 'continue';
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
}

export interface CanaryMetricResult {
  id: string;
  runId: string;
  metricName: string;
  baselineValue: number;
  canaryValue: number;
  verdict: 'pass' | 'warn' | 'fail';
  category: 'latency' | 'error_rate' | 'throughput' | 'saturation';
}

export interface CanaryAnalysisConfig {
  id: string;
  serviceName: string;
  environment: string;
  analysisIntervalSec: number;
  maxRounds: number;
  warmupPeriodSec: number;
  promoteThreshold: number;
  rollbackThreshold: number;
  trafficStep: number;
  metricWeights: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CanaryDecision {
  id: string;
  runId: string;
  decision: string;
  reason: string;
  decidedAt: Date;
}

export function createCanaryRun(input: {
  deploymentId: string; runNumber: number;
  trafficSplit?: { canary: number; baseline: number };
}): CanaryAnalysisRun {
  return {
    id: uuidv4(), ...input,
    trafficSplit: input.trafficSplit || { canary: 10, baseline: 90 },
    status: 'running', confidence: 0, decision: 'continue',
    startedAt: new Date(),
  };
}

export function createAnalysisConfig(input: {
  serviceName: string; environment: string;
}): CanaryAnalysisConfig {
  const now = new Date();
  return {
    id: uuidv4(), ...input,
    analysisIntervalSec: 300, maxRounds: 5, warmupPeriodSec: 600,
    promoteThreshold: 0.75, rollbackThreshold: 0.60, trafficStep: 20,
    metricWeights: { latency: 0.4, error_rate: 0.3, throughput: 0.2, saturation: 0.1 },
    createdAt: now, updatedAt: now,
  };
}
```

**Commit:** `feat: add Canary Analysis data models`

---

## Task 4.2: Canary Analysis Service

**Files:** `orion-platform-service/src/services/CanaryAnalysisService.ts`

```typescript
import pino from 'pino';
import { CanaryAnalysisRun, CanaryMetricResult, CanaryAnalysisConfig, CanaryDecision, createCanaryRun, createAnalysisConfig } from '../models/CanaryAnalysis';
import { v4 as uuidv4 } from 'uuid';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export class CanaryAnalysisService {
  private runs: Map<string, CanaryAnalysisRun> = new Map();
  private metrics: Map<string, CanaryMetricResult[]> = new Map();
  private configs: Map<string, CanaryAnalysisConfig> = new Map();
  private decisions: Map<string, CanaryDecision> = new Map();

  async createConfig(input: { serviceName: string; environment: string }): Promise<CanaryAnalysisConfig> {
    const config = createAnalysisConfig(input);
    const key = `${input.serviceName}:${input.environment}`;
    this.configs.set(key, config);
    return config;
  }

  async getConfig(serviceName: string, environment: string): Promise<CanaryAnalysisConfig | undefined> {
    return this.configs.get(`${serviceName}:${environment}`);
  }

  async listConfigs(): Promise<CanaryAnalysisConfig[]> {
    return Array.from(this.configs.values());
  }

  async updateConfig(id: string, updates: Partial<CanaryAnalysisConfig>): Promise<CanaryAnalysisConfig | undefined> {
    const config = Array.from(this.configs.values()).find(c => c.id === id);
    if (!config) return undefined;
    Object.assign(config, updates, { updatedAt: new Date() });
    return config;
  }

  async deleteConfig(id: string): Promise<boolean> {
    for (const [key, config] of this.configs) {
      if (config.id === id) { this.configs.delete(key); return true; }
    }
    return false;
  }

  async triggerRun(input: {
    deploymentId: string; roundNumber?: number;
    config?: { serviceName: string; environment: string };
  }): Promise<CanaryAnalysisRun> {
    const run = createCanaryRun({
      deploymentId: input.deploymentId,
      runNumber: input.roundNumber || 1,
    });
    this.runs.set(run.id, run);
    this.metrics.set(run.id, []);

    // MVP: Simulate metrics and analysis
    const result = await this._analyzeRun(run);

    run.status = result.status;
    run.decision = result.decision;
    run.confidence = result.confidence;
    run.completedAt = new Date();
    run.durationMs = Date.now() - run.startedAt.getTime();

    this.decisions.set(run.id, {
      id: uuidv4(), runId: run.id, decision: result.decision,
      reason: result.reason, decidedAt: new Date(),
    });

    logger.info({ runId: run.id, decision: result.decision }, 'Canary analysis complete');
    return run;
  }

  async getRun(id: string): Promise<CanaryAnalysisRun | undefined> {
    return this.runs.get(id);
  }

  async listRuns(deploymentId?: string): Promise<CanaryAnalysisRun[]> {
    let runs = Array.from(this.runs.values());
    if (deploymentId) runs = runs.filter(r => r.deploymentId === deploymentId);
    return runs.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  async getMetrics(runId: string): Promise<CanaryMetricResult[]> {
    return this.metrics.get(runId) || [];
  }

  async forcePromote(runId: string, reason: string): Promise<CanaryDecision | undefined> {
    const run = this.runs.get(runId);
    if (!run) return undefined;
    run.status = 'promote';
    run.decision = 'promote';
    run.completedAt = new Date();
    const decision: CanaryDecision = { id: uuidv4(), runId, decision: 'promote', reason, decidedAt: new Date() };
    this.decisions.set(`override-${runId}`, decision);
    return decision;
  }

  async forceRollback(runId: string, reason: string): Promise<CanaryDecision | undefined> {
    const run = this.runs.get(runId);
    if (!run) return undefined;
    run.status = 'rollback';
    run.decision = 'rollback';
    run.completedAt = new Date();
    const decision: CanaryDecision = { id: uuidv4(), runId, decision: 'rollback', reason, decidedAt: new Date() };
    this.decisions.set(`override-${runId}`, decision);
    return decision;
  }

  async discoverMetrics(): Promise<string[]> {
    return ['http_request_duration_seconds', 'http_requests_total', 'http_errors_total', 'cpu_usage_percent', 'memory_usage_bytes', 'go_goroutines'];
  }

  /**
   * MVP: Simulate metric analysis with realistic data.
   * Full implementation would query Prometheus and run statistical tests.
   */
  private async _analyzeRun(run: CanaryAnalysisRun): Promise<{
    status: CanaryAnalysisRun['status']; decision: CanaryAnalysisRun['decision'];
    confidence: number; reason: string;
  }> {
    const metricDefs = [
      { name: 'http_request_duration_seconds', category: 'latency' as const, baseline: 0.150, stddev: 0.02 },
      { name: 'http_requests_total', category: 'throughput' as const, baseline: 1000, stddev: 50 },
      { name: 'http_errors_total', category: 'error_rate' as const, baseline: 5, stddev: 2 },
      { name: 'cpu_usage_percent', category: 'saturation' as const, baseline: 45, stddev: 5 },
      { name: 'memory_usage_bytes', category: 'saturation' as const, baseline: 536870912, stddev: 10000000 },
      { name: 'go_goroutines', category: 'saturation' as const, baseline: 120, stddev: 10 },
    ];

    const results: CanaryMetricResult[] = [];
    let passCount = 0, warnCount = 0, failCount = 0;

    for (const def of metricDefs) {
      // Simulate canary value with small random deviation from baseline
      const canaryValue = def.baseline + (Math.random() - 0.5) * def.stddev * 4;
      const deviation = Math.abs(canaryValue - def.baseline) / def.baseline;

      let verdict: 'pass' | 'warn' | 'fail';
      if (deviation < 0.1) { verdict = 'pass'; passCount++; }
      else if (deviation < 0.25) { verdict = 'warn'; warnCount++; }
      else { verdict = 'fail'; failCount++; }

      results.push({
        id: uuidv4(), runId: run.id, metricName: def.name,
        baselineValue: def.baseline, canaryValue: Math.round(canaryValue * 1000) / 1000,
        verdict, category: def.category,
      });
    }

    this.metrics.set(run.id, results);

    const total = results.length;
    const confidence = passCount / total;
    const config = Array.from(this.configs.values())[0];
    const promoteThreshold = config?.promoteThreshold || 0.75;
    const rollbackThreshold = config?.rollbackThreshold || 0.60;

    if (confidence >= promoteThreshold) {
      return { status: 'promote', decision: 'promote', confidence, reason: `${passCount}/${total} metrics passed` };
    }
    if (confidence < rollbackThreshold) {
      return { status: 'rollback', decision: 'rollback', confidence, reason: `${failCount} metrics failed, confidence ${confidence.toFixed(2)} below threshold` };
    }
    return { status: 'running', decision: 'continue', confidence, reason: `Insufficient data: ${warnCount} warnings` };
  }
}
```

**Commit:** `feat: implement CanaryAnalysisService with simulated analysis`

---

## Task 4.3: Canary Analysis Controller

**Files:** `orion-platform-service/src/api/controllers/CanaryAnalysisController.ts`

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { CanaryAnalysisService } from '../../services/CanaryAnalysisService';

export class CanaryAnalysisController {
  private service: CanaryAnalysisService;
  constructor(service: CanaryAnalysisService) { this.service = service; }

  async triggerRun(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any || {};
      if (!body.deploymentId) { await reply.status(400).send({ error: 'VALIDATION_ERROR', code: '30101', message: 'Missing deploymentId' }); return; }
      await reply.status(201).send(await this.service.triggerRun(body));
    } catch (error) {
      await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000', message: error instanceof Error ? error.message : 'Failed to trigger analysis' });
    }
  }

  async listRuns(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const runs = await this.service.listRuns((request.query as any).deploymentId);
      await reply.send({ data: runs, total: runs.length });
    } catch (error) {
      await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000', message: error instanceof Error ? error.message : 'Failed to list runs' });
    }
  }

  async getRun(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const run = await this.service.getRun((request.params as any).id);
      if (!run) { await reply.status(404).send({ error: 'NOT_FOUND', code: '30201', message: 'Run not found' }); return; }
      await reply.send(run);
    } catch (error) {
      await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000', message: error instanceof Error ? error.message : 'Failed to get run' });
    }
  }

  async getMetrics(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const metrics = await this.service.getMetrics((request.params as any).id);
      await reply.send({ data: metrics, total: metrics.length });
    } catch (error) {
      await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000', message: error instanceof Error ? error.message : 'Failed to get metrics' });
    }
  }

  async createConfig(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any || {};
      if (!body.serviceName || !body.environment) { await reply.status(400).send({ error: 'VALIDATION_ERROR', code: '30101', message: 'Missing serviceName or environment' }); return; }
      await reply.status(201).send(await this.service.createConfig(body));
    } catch (error) {
      await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000', message: error instanceof Error ? error.message : 'Failed to create config' });
    }
  }

  async listConfigs(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try { await reply.send({ data: await this.service.listConfigs() }); }
    catch (error) { await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000', message: error instanceof Error ? error.message : 'Failed' }); }
  }

  async getConfig(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const config = await this.service.getConfig((request.params as any).service, (request.params as any).env);
      if (!config) { await reply.status(404).send({ error: 'NOT_FOUND', code: '30201', message: 'Config not found' }); return; }
      await reply.send(config);
    } catch (error) { await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000', message: error instanceof Error ? error.message : 'Failed' }); }
  }

  async updateConfig(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const config = await this.service.updateConfig((request.params as any).id, request.body as any);
      if (!config) { await reply.status(404).send({ error: 'NOT_FOUND', code: '30201', message: 'Config not found' }); return; }
      await reply.send(config);
    } catch (error) { await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000', message: error instanceof Error ? error.message : 'Failed' }); }
  }

  async deleteConfig(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const deleted = await this.service.deleteConfig((request.params as any).id);
      if (!deleted) { await reply.status(404).send({ error: 'NOT_FOUND', code: '30201', message: 'Config not found' }); return; }
      await reply.status(204).send();
    } catch (error) { await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000', message: error instanceof Error ? error.message : 'Failed' }); }
  }

  async forcePromote(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any || {};
      const decision = await this.service.forcePromote(body.runId, body.reason || 'Manual promote');
      if (!decision) { await reply.status(404).send({ error: 'NOT_FOUND', code: '30201', message: 'Run not found' }); return; }
      await reply.send(decision);
    } catch (error) { await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000', message: error instanceof Error ? error.message : 'Failed' }); }
  }

  async forceRollback(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any || {};
      const decision = await this.service.forceRollback(body.runId, body.reason || 'Manual rollback');
      if (!decision) { await reply.status(404).send({ error: 'NOT_FOUND', code: '30201', message: 'Run not found' }); return; }
      await reply.send(decision);
    } catch (error) { await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000', message: error instanceof Error ? error.message : 'Failed' }); }
  }

  async discoverMetrics(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try { await reply.send({ data: await this.service.discoverMetrics() }); }
    catch (error) { await reply.status(500).send({ error: 'INTERNAL_ERROR', code: '50000', message: error instanceof Error ? error.message : 'Failed' }); }
  }
}
```

**Commit:** `feat: implement CanaryAnalysisController`

---

## Task 4.4: Canary Routes

**Files:** `orion-platform-service/src/routes-canary-analysis.ts`

```typescript
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CanaryAnalysisService } from './services/CanaryAnalysisService';
import { CanaryAnalysisController } from './api/controllers/CanaryAnalysisController';

export default async function registerCanaryRoutes(app: FastifyInstance): Promise<void> {
  const service = new CanaryAnalysisService();
  const ctrl = new CanaryAnalysisController(service);

  app.get('/canary-analysis/runs', async (req, rep) => ctrl.listRuns(req, rep));
  app.post('/canary-analysis/runs', async (req, rep) => ctrl.triggerRun(req, rep));
  app.get('/canary-analysis/runs/:id', async (req, rep) => ctrl.getRun(req, rep));
  app.get('/canary-analysis/runs/:id/metrics', async (req, rep) => ctrl.getMetrics(req, rep));
  app.get('/canary-analysis/configs', async (req, rep) => ctrl.listConfigs(req, rep));
  app.post('/canary-analysis/configs', async (req, rep) => ctrl.createConfig(req, rep));
  app.get('/canary-analysis/configs/:service/:env', async (req, rep) => ctrl.getConfig(req, rep));
  app.put('/canary-analysis/configs/:id', async (req, rep) => ctrl.updateConfig(req, rep));
  app.delete('/canary-analysis/configs/:id', async (req, rep) => ctrl.deleteConfig(req, rep));
  app.post('/canary-analysis/force-promote', async (req, rep) => ctrl.forcePromote(req, rep));
  app.post('/canary-analysis/force-rollback', async (req, rep) => ctrl.forceRollback(req, rep));
  app.get('/canary-analysis/metrics/discover', async (req, rep) => ctrl.discoverMetrics(req, rep));
}
```

**Integration:** Add to server.ts:
```typescript
import registerCanaryRoutes from './routes-canary-analysis';
await app.register(registerCanaryRoutes, { prefix: '/api/v1' });
```

**Commit:** `feat: register Canary Analysis routes`

---

## Task 4.5: Canary Frontend API Client

**Files:** `orion-frontend/src/api/canary-analysis.ts`

```typescript
import { api } from './client';

export interface CanaryAnalysisRun {
  id: string; deploymentId: string; runNumber: number;
  trafficSplit: { canary: number; baseline: number };
  status: 'running' | 'promote' | 'rollback' | 'inconclusive';
  confidence: number; decision: 'promote' | 'rollback' | 'continue';
  startedAt: string; completedAt?: string; durationMs?: number;
}

export interface CanaryMetricResult {
  id: string; runId: string; metricName: string;
  baselineValue: number; canaryValue: number;
  verdict: 'pass' | 'warn' | 'fail';
  category: 'latency' | 'error_rate' | 'throughput' | 'saturation';
}

export interface CanaryAnalysisConfig {
  id: string; serviceName: string; environment: string;
  analysisIntervalSec: number; maxRounds: number;
  promoteThreshold: number; rollbackThreshold: number;
  trafficStep: number; metricWeights: Record<string, number>;
  createdAt: string; updatedAt: string;
}

export function triggerCanaryRun(data: { deploymentId: string; roundNumber?: number }) {
  return api.post('/v1/canary-analysis/runs', data);
}
export function getCanaryRuns(deploymentId?: string) {
  return api.get('/v1/canary-analysis/runs', { params: { deploymentId } });
}
export function getCanaryRun(id: string) {
  return api.get(`/v1/canary-analysis/runs/${id}`);
}
export function getCanaryMetrics(runId: string) {
  return api.get(`/v1/canary-analysis/runs/${runId}/metrics`);
}
export function getCanaryConfigs() {
  return api.get('/v1/canary-analysis/configs');
}
export function createCanaryConfig(data: { serviceName: string; environment: string }) {
  return api.post('/v1/canary-analysis/configs', data);
}
export function getCanaryConfig(service: string, env: string) {
  return api.get(`/v1/canary-analysis/configs/${service}/${env}`);
}
export function updateCanaryConfig(id: string, data: Partial<CanaryAnalysisConfig>) {
  return api.put(`/v1/canary-analysis/configs/${id}`, data);
}
export function deleteCanaryConfig(id: string) {
  return api.delete(`/v1/canary-analysis/configs/${id}`);
}
export function forcePromote(data: { runId: string; reason: string }) {
  return api.post('/v1/canary-analysis/force-promote', data);
}
export function forceRollback(data: { runId: string; reason: string }) {
  return api.post('/v1/canary-analysis/force-rollback', data);
}
export function discoverMetrics() {
  return api.get('/v1/canary-analysis/metrics/discover');
}
```

**Commit:** `feat: add Canary Analysis API client`

---

## Task 4.6: Canary Dashboard UI

**Files:** `orion-frontend/src/pages/CanaryAnalysis/index.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { Typography, Table, Tag, Button, Card, Row, Col, Progress, message, Badge, Statistic } from 'antd';
import { RocketOutlined, RollbackOutlined, ReloadOutlined } from '@ant-design/icons';
import { getCanaryRuns, triggerCanaryRun, forcePromote, forceRollback, type CanaryAnalysisRun, type CanaryMetricResult, getCanaryMetrics } from '@/api/canary-analysis';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const decisionColors: Record<string, string> = { promote: 'green', rollback: 'red', continue: 'blue' };
const verdictColors: Record<string, string> = { pass: 'green', warn: 'orange', fail: 'red' };

export default function CanaryAnalysisPage() {
  const [runs, setRuns] = useState<CanaryAnalysisRun[]>([]);
  const [metrics, setMetrics] = useState<CanaryMetricResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getCanaryRuns();
      setRuns(res.data.data || []);
    } catch { message.error('Failed to fetch runs'); }
    finally { setLoading(false); }
  };

  const loadMetrics = async (runId: string) => {
    setSelectedRun(runId);
    try {
      const res = await getCanaryMetrics(runId);
      setMetrics(res.data.data || []);
    } catch { message.error('Failed to fetch metrics'); }
  };

  const handleTrigger = async () => {
    try {
      await triggerCanaryRun({ deploymentId: `deploy-${Date.now()}` });
      fetchData(); message.success('Analysis triggered');
    } catch { message.error('Failed to trigger'); }
  };

  const handleForce = async (runId: string, action: 'promote' | 'rollback') => {
    try {
      await (action === 'promote' ? forcePromote : forceRollback)({ runId, reason: `Manual ${action}` });
      fetchData(); message.success(`Force ${action} executed`);
    } catch { message.error(`Failed to force ${action}`); }
  };

  useEffect(() => { fetchData(); }, []);

  const runColumns = [
    { title: 'Run #', dataIndex: 'runNumber', key: 'runNumber', width: 80 },
    { title: 'Deployment', dataIndex: 'deploymentId', key: 'deploymentId', width: 200, ellipsis: true },
    { title: 'Traffic', dataIndex: 'trafficSplit', key: 'trafficSplit', render: (t: any) => `${t.canary}% / ${t.baseline}%` },
    {
      title: 'Confidence', dataIndex: 'confidence', key: 'confidence', width: 150,
      render: (c: number, record: CanaryAnalysisRun) => <Progress percent={Math.round(c * 100)} strokeColor={decisionColors[record.decision]} size="small" />,
    },
    { title: 'Decision', dataIndex: 'decision', key: 'decision', render: (d: string) => <Tag color={decisionColors[d]}>{d.toUpperCase()}</Tag> },
    { title: 'Started', dataIndex: 'startedAt', key: 'startedAt', width: 180, render: (d: string) => dayjs(d).format('YYYY-MM-DD HH:mm') },
    { title: 'Duration', dataIndex: 'durationMs', key: 'durationMs', width: 100, render: (ms: number) => ms ? `${(ms / 1000).toFixed(1)}s` : '-' },
    { title: 'Actions', key: 'actions', render: (_: any, record: CanaryAnalysisRun) => (
      <span>
        <Button type="link" size="small" onClick={() => loadMetrics(record.id)}>Metrics</Button>
        {record.status === 'running' && <><Button type="link" size="small" danger onClick={() => handleForce(record.id, 'rollback')}><RollbackOutlined /></Button><Button type="link" size="small" onClick={() => handleForce(record.id, 'promote')}><RocketOutlined /></Button></>}
      </span>
    )},
  ];

  const metricColumns = [
    { title: 'Metric', dataIndex: 'metricName', key: 'metricName' },
    { title: 'Category', dataIndex: 'category', key: 'category', render: (c: string) => <Tag>{c}</Tag> },
    { title: 'Baseline', dataIndex: 'baselineValue', key: 'baselineValue', render: (v: number) => typeof v === 'number' && v > 1000 ? (v / 1000000).toFixed(1) + 'M' : v.toFixed(3) },
    { title: 'Canary', dataIndex: 'canaryValue', key: 'canaryValue', render: (v: number) => typeof v === 'number' && v > 1000 ? (v / 1000000).toFixed(1) + 'M' : v.toFixed(3) },
    { title: 'Verdict', dataIndex: 'verdict', key: 'verdict', render: (v: string) => <Tag color={verdictColors[v]}>{v.toUpperCase()}</Tag> },
  ];

  const passCount = metrics.filter(m => m.verdict === 'pass').length;
  const warnCount = metrics.filter(m => m.verdict === 'warn').length;
  const failCount = metrics.filter(m => m.verdict === 'fail').length;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4}>Canary Analysis Runs</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>Refresh</Button>
          <Button type="primary" icon={<RocketOutlined />} onClick={handleTrigger}>Trigger Analysis</Button>
        </Space>
      </div>
      <Table columns={runColumns} dataSource={runs} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />

      {selectedRun && (
        <>
          <Title level={5} style={{ marginTop: 24 }}>Metrics for Run: {selectedRun}</Title>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}><Card><Statistic title="Pass" value={passCount} valueStyle={{ color: '#52c41a' }} /></Card></Col>
            <Col span={8}><Card><Statistic title="Warnings" value={warnCount} valueStyle={{ color: '#faad14' }} /></Card></Col>
            <Col span={8}><Card><Statistic title="Failures" value={failCount} valueStyle={{ color: '#ff4d4f' }} /></Card></Col>
          </Row>
          <Table columns={metricColumns} dataSource={metrics} rowKey="id" pagination={false} />
        </>
      )}
    </div>
  );
}

const { Space } = require('antd');
```

**Commit:** `feat: add Canary Analysis dashboard with metrics view`

---

## Task 4.7: Router Registration

**Files:** `orion-frontend/src/router/routes.ts`

```typescript
{
  path: '/console/canary-analysis',
  element: React.lazy(() => import('@/pages/CanaryAnalysis')),
  protected: true,
},
```

**Commit:** `feat: register Canary Analysis routes in frontend router`

---

## Task 4.8: Canary Service Tests

**Files:** `orion-platform-service/src/__tests__/canary-analysis.test.ts`

```typescript
import { CanaryAnalysisService } from '../services/CanaryAnalysisService';

describe('CanaryAnalysisService MVP', () => {
  let service: CanaryAnalysisService;
  beforeEach(() => { service = new CanaryAnalysisService(); });

  it('should trigger analysis and produce a decision', async () => {
    const run = await service.triggerRun({ deploymentId: 'deploy-1' });
    expect(run.status).toMatch(/^(promote|rollback|running)$/);
    expect(run.decision).toMatch(/^(promote|rollback|continue)$/);
    expect(run.confidence).toBeGreaterThanOrEqual(0);
    expect(run.confidence).toBeLessThanOrEqual(1);
    expect(run.completedAt).toBeDefined();
  });

  it('should produce metrics for a run', async () => {
    const run = await service.triggerRun({ deploymentId: 'deploy-2' });
    const metrics = await service.getMetrics(run.id);
    expect(metrics.length).toBeGreaterThan(0);
    expect(metrics[0]).toHaveProperty('metricName');
    expect(metrics[0]).toHaveProperty('verdict');
  });

  it('should manage configs', async () => {
    const config = await service.createConfig({ serviceName: 'web', environment: 'production' });
    expect(config.serviceName).toBe('web');
    const retrieved = await service.getConfig('web', 'production');
    expect(retrieved?.id).toBe(config.id);
    const all = await service.listConfigs();
    expect(all.length).toBeGreaterThanOrEqual(1);
  });

  it('should force promote', async () => {
    const run = await service.triggerRun({ deploymentId: 'deploy-3' });
    const decision = await service.forcePromote(run.id, 'Test promote');
    expect(decision?.decision).toBe('promote');
    const updated = await service.getRun(run.id);
    expect(updated?.status).toBe('promote');
  });

  it('should force rollback', async () => {
    const run = await service.triggerRun({ deploymentId: 'deploy-4' });
    const decision = await service.forceRollback(run.id, 'Test rollback');
    expect(decision?.decision).toBe('rollback');
  });

  it('should discover metrics', async () => {
    const metrics = await service.discoverMetrics();
    expect(metrics.length).toBeGreaterThan(0);
    expect(metrics).toContain('http_request_duration_seconds');
  });
});
```

**Command:** `cd orion-platform-service && npx jest src/__tests__/canary-analysis.test.ts`

**Commit:** `test: add Canary Analysis service unit tests`

---

# Implementation Order & Dependencies

All 4 features are **independently developable** -- no cross-feature dependencies in the MVP. Recommended parallel order:

1. **SBOM** (Tasks 1.1-1.8) - Foundation for supply chain security
2. **OPA Policy** (Tasks 2.1-2.8) - Governance layer
3. **AI Change Intelligence** (Tasks 3.1-3.8) - PR risk analysis
4. **Canary Analysis** (Tasks 4.1-4.8) - Deployment quality

Each feature produces its own route file, controller, service, model, API client, and UI page -- all following established Orion patterns.

# Future Enhancements (Post-MVP)

- **SBOM**: Sigstore/cosign signing, Syft/Grype CLI integration, EO 14028 compliance reports
- **OPA**: OPA WASM engine integration, Git bundle sync, Rego editor with syntax highlighting
- **AI CI**: CodeBERT semantic analysis, Neo4j dependency traversal, XGBoost risk scoring
- **Canary**: Prometheus metric queries, ClickHouse timeseries, XGBoost/DBSCAN ML models, Argo Rollouts webhook integration
