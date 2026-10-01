/**
 * SBOM (软件物料清单) API 路由
 *
 * 提供 SBOM 管理功能：
 * - GET /api/v1/sbom - 获取 SBOM 列表
 * - POST /api/v1/sbom - 生成 SBOM
 * - GET /api/v1/sbom/:id - 获取 SBOM 详情
 * - GET /api/v1/sbom/:id/components - 获取 SBOM 组件列表
 * - GET /api/v1/sbom/:id/vulnerabilities - 获取漏洞扫描结果
 * - POST /api/v1/sbom/:id/scan - 执行漏洞扫描
 * - GET /api/v1/sbom/:id/licenses - 获取许可证信息
 * - GET /api/v1/sbom/:id/attestation - 获取 SBOM 证明
 * - POST /api/v1/sbom/:id/attestation - 创建 SBOM 证明
 * - GET /api/v1/sbom/:id/export - 导出 SBOM
 * - POST /api/v1/sbom/compare - 比较 SBOM
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ErrorCodes, ErrorFactory } from '../errors/error-codes';
import { PaginationHelper, OffsetPaginationParams } from '../utils/pagination';

/**
 * SBOM 格式枚举
 */
export enum SBOMFormat {
  SPDX = 'spdx',
  CYCLONE_DX = 'cyclonedx',
  SWID = 'swid',
}

/**
 * SBOM 状态枚举
 */
export enum SBOMStatus {
  GENERATED = 'generated',
  SCANNING = 'scanning',
  SCANNED = 'scanned',
  ATTESTED = 'attested',
  EXPIRED = 'expired',
}

/**
 * 漏洞严重程度枚举
 */
export enum VulnerabilitySeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  NEGLIGIBLE = 'negligible',
  UNKNOWN = 'unknown',
}

/**
 * 许可证类型枚举
 */
export enum LicenseType {
  PERMISSIVE = 'permissive',
  PROPRIETARY = 'proprietary',
  GPL = 'gpl',
  LGPL = 'lgpl',
  MIT = 'mit',
  APACHE = 'apache',
  BSD = 'bsd',
  CDDL = 'cddl',
  ECL = 'ecl',
  UNKNOWN = 'unknown',
}

/**
 * SBOM 文档
 */
export interface SBOMDocument {
  id: string;
  name: string;
  version: string;
  format: SBOMFormat;
  status: SBOMStatus;
  artifactId: string;
  artifactType: 'image' | 'package' | 'repository' | 'deployment';
  componentsCount: number;
  vulnerabilitiesCount: number;
  licensesCount: number;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  attestation?: SBOMAttestation;
  metadata: Record<string, unknown>;
}

/**
 * SBOM 组件
 */
export interface SBOMComponent {
  id: string;
  sbomId: string;
  name: string;
  version: string;
  type: 'library' | 'application' | 'framework' | 'container' | 'operating-system' | 'device' | 'file';
  supplier?: string;
  author?: string;
  publisher?: string;
  purl?: string; // Package URL
  cpe?: string; // Common Platform Enumeration
  swid?: string; // SWID Tag ID
  hash?: {
    algorithm: 'sha256' | 'sha512' | 'md5';
    value: string;
  };
  license: {
    id: string;
    name: string;
    type: LicenseType;
  };
  dependencies: string[];
  properties: Record<string, unknown>;
}

/**
 * 漏洞信息
 */
export interface Vulnerability {
  id: string;
  sbomId: string;
  componentId: string;
  componentName: string;
  cveId: string;
  severity: VulnerabilitySeverity;
  cvssScore: number;
  description: string;
  affectedVersions: string;
  fixedVersions?: string;
  references: string[];
  status: 'open' | 'fixed' | 'ignored' | 'accepted';
  publishedAt: string;
  discoveredAt: string;
}

/**
 * 许可证信息
 */
export interface LicenseInfo {
  id: string;
  name: string;
  spdxId: string;
  type: LicenseType;
  componentsCount: number;
  riskLevel: 'low' | 'medium' | 'high';
  obligations: string[];
  restrictions: string[];
  compatibility: string[];
}

/**
 * SBOM 证明
 */
export interface SBOMAttestation {
  id: string;
  sbomId: string;
  type: 'provenance' | 'vulnerability' | 'license' | 'quality';
  policy: string;
  verifiedBy: string;
  verifiedAt: string;
  signature?: string;
  publicKey?: string;
  payload: Record<string, unknown>;
}

/**
 * SBOM 比较
 */
export interface SBOMComparison {
  id: string;
  fromSBOMId: string;
  toSBOMId: string;
  addedComponents: string[];
  removedComponents: string[];
  updatedComponents: {
    name: string;
    fromVersion: string;
    toVersion: string;
  }[];
  newVulnerabilities: string[];
  fixedVulnerabilities: string[];
  licenseChanges: {
    component: string;
    fromLicense: string;
    toLicense: string;
  }[];
  summary: string;
}

/**
 * 生成 SBOM 请求
 */
export interface GenerateSBOMRequest {
  artifactId: string;
  artifactType: 'image' | 'package' | 'repository' | 'deployment';
  name: string;
  version: string;
  format?: SBOMFormat;
  deepScan?: boolean;
}

/**
 * 执行扫描请求
 */
export interface ScanRequest {
  scanner?: string;
  severityThreshold?: VulnerabilitySeverity;
}

/**
 * 创建证明请求
 */
export interface CreateAttestationRequest {
  type: 'provenance' | 'vulnerability' | 'license' | 'quality';
  policy: string;
  payload?: Record<string, unknown>;
}

/**
 * 比较 SBOM 请求
 */
export interface CompareSBOMRequest {
  fromSBOMId: string;
  toSBOMId: string;
}

/**
 * SBOM 服务类
 */
export class SBOMService {
  private sboms: Map<string, SBOMDocument> = new Map();
  private components: Map<string, SBOMComponent[]> = new Map();
  private vulnerabilities: Map<string, Vulnerability[]> = new Map();
  private attestations: Map<string, SBOMAttestation[]> = new Map();
  private sbomCounter = 0;
  private componentCounter = 0;
  private vulnCounter = 0;

  /**
   * 生成 SBOM ID
   */
  private generateSBOMId(): string {
    this.sbomCounter++;
    return `sbom_${Date.now()}_${this.sbomCounter}`;
  }

  /**
   * 生成组件 ID
   */
  private generateComponentId(): string {
    this.componentCounter++;
    return `comp_${Date.now()}_${this.componentCounter}`;
  }

  /**
   * 生成漏洞 ID
   */
  private generateVulnId(): string {
    this.vulnCounter++;
    return `vuln_${Date.now()}_${this.vulnCounter}`;
  }

  /**
   * 生成 SBOM
   */
  async generateSBOM(data: GenerateSBOMRequest): Promise<SBOMDocument> {
    const id = this.generateSBOMId();
    const now = new Date().toISOString();

    const sbom: SBOMDocument = {
      id,
      name: data.name,
      version: data.version,
      format: data.format || SBOMFormat.CYCLONE_DX,
      status: SBOMStatus.GENERATED,
      artifactId: data.artifactId,
      artifactType: data.artifactType,
      componentsCount: 0,
      vulnerabilitiesCount: 0,
      licensesCount: 0,
      createdAt: now,
      updatedAt: now,
      metadata: {},
    };

    this.sboms.set(id, sbom);

    // 模拟生成组件
    this.generateMockComponents(id, data.deepScan);

    return sbom;
  }

  /**
   * 获取 SBOM 列表
   */
  async listSBOMs(
    params: OffsetPaginationParams,
    filters?: {
      artifactId?: string;
      artifactType?: string;
      status?: SBOMStatus;
      format?: SBOMFormat;
    }
  ): Promise<{ data: SBOMDocument[]; total: number }> {
    let sboms = Array.from(this.sboms.values());

    if (filters?.artifactId) {
      sboms = sboms.filter(s => s.artifactId === filters.artifactId);
    }
    if (filters?.artifactType) {
      sboms = sboms.filter(s => s.artifactType === filters.artifactType);
    }
    if (filters?.status) {
      sboms = sboms.filter(s => s.status === filters.status);
    }
    if (filters?.format) {
      sboms = sboms.filter(s => s.format === filters.format);
    }

    const sortField = params.sort || 'createdAt';
    const sortOrder = params.order || 'desc';
    sboms.sort((a, b) => {
      const aVal = a[sortField as keyof SBOMDocument];
      const bVal = b[sortField as keyof SBOMDocument];
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const total = sboms.length;
    const offset = params.offset || 0;
    const limit = params.limit || 20;
    sboms = sboms.slice(offset, offset + limit);

    return { data: sboms, total };
  }

  /**
   * 获取 SBOM 详情
   */
  async getSBOM(id: string): Promise<SBOMDocument | null> {
    return this.sboms.get(id) || null;
  }

  /**
   * 获取 SBOM 组件列表
   */
  async getComponents(id: string, params: OffsetPaginationParams): Promise<{ data: SBOMComponent[]; total: number }> {
    const components = this.components.get(id) || [];
    const total = components.length;
    const offset = params.offset || 0;
    const limit = params.limit || 50;

    return {
      data: components.slice(offset, offset + limit),
      total,
    };
  }

  /**
   * 获取漏洞扫描结果
   */
  async getVulnerabilities(id: string, params: OffsetPaginationParams & { severity?: VulnerabilitySeverity }): Promise<{ data: Vulnerability[]; total: number }> {
    let vulns = this.vulnerabilities.get(id) || [];

    if (params.severity) {
      vulns = vulns.filter(v => v.severity === params.severity);
    }

    const total = vulns.length;
    const offset = params.offset || 0;
    const limit = params.limit || 50;

    return {
      data: vulns.slice(offset, offset + limit),
      total,
    };
  }

  /**
   * 执行漏洞扫描
   */
  async scanSBOM(id: string, data: ScanRequest): Promise<SBOMDocument> {
    const sbom = await this.getSBOM(id);
    if (!sbom) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'sbom',
        identifier: id,
      });
    }

    sbom.status = SBOMStatus.SCANNING;
    sbom.updatedAt = new Date().toISOString();
    this.sboms.set(id, sbom);

    // 模拟扫描
    this.generateMockVulnerabilities(id);

    sbom.status = SBOMStatus.SCANNED;
    sbom.vulnerabilitiesCount = this.vulnerabilities.get(id)?.length || 0;
    sbom.updatedAt = new Date().toISOString();
    this.sboms.set(id, sbom);

    return sbom;
  }

  /**
   * 获取许可证信息
   */
  async getLicenses(id: string): Promise<LicenseInfo[]> {
    const components = this.components.get(id) || [];
    const licenseMap = new Map<string, { license: SBOMComponent['license']; count: number }>();

    for (const comp of components) {
      const key = comp.license.spdxId || comp.license.name;
      const existing = licenseMap.get(key) || { license: comp.license, count: 0 };
      existing.count++;
      licenseMap.set(key, existing);
    }

    return Array.from(licenseMap.entries()).map(([key, data]) => ({
      id: `license_${key}`,
      name: data.license.name,
      spdxId: data.license.spdxId || key,
      type: data.license.type,
      componentsCount: data.count,
      riskLevel: this.getLicenseRiskLevel(data.license.type),
      obligations: this.getLicenseObligations(data.license.type),
      restrictions: this.getLicenseRestrictions(data.license.type),
      compatibility: this.getLicenseCompatibility(data.license.type),
    }));
  }

  /**
   * 获取 SBOM 证明
   */
  async getAttestations(id: string): Promise<SBOMAttestation[]> {
    return this.attestations.get(id) || [];
  }

  /**
   * 创建 SBOM 证明
   */
  async createAttestation(id: string, data: CreateAttestationRequest): Promise<SBOMAttestation> {
    const sbom = await this.getSBOM(id);
    if (!sbom) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'sbom',
        identifier: id,
      });
    }

    const attestation: SBOMAttestation = {
      id: `att_${Date.now()}`,
      sbomId: id,
      type: data.type,
      policy: data.policy,
      verifiedBy: 'policy-engine',
      verifiedAt: new Date().toISOString(),
      payload: data.payload || {},
    };

    const attestations = this.attestations.get(id) || [];
    attestations.push(attestation);
    this.attestations.set(id, attestations);

    sbom.attestation = attestation;
    sbom.status = SBOMStatus.ATTESTED;
    sbom.updatedAt = new Date().toISOString();
    this.sboms.set(id, sbom);

    return attestation;
  }

  /**
   * 导出 SBOM
   */
  async exportSBOM(id: string, format: SBOMFormat): Promise<{ format: SBOMFormat; content: string }> {
    const sbom = await this.getSBOM(id);
    if (!sbom) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'sbom',
        identifier: id,
      });
    }

    // 模拟导出内容
    const components = this.components.get(id) || [];
    const content = this.formatSBOMContent(sbom, components, format);

    return { format, content };
  }

  /**
   * 比较 SBOM
   */
  async compareSBOMs(data: CompareSBOMRequest): Promise<SBOMComparison> {
    const fromSBOM = await this.getSBOM(data.fromSBOMId);
    const toSBOM = await this.getSBOM(data.toSBOMId);

    if (!fromSBOM || !toSBOM) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'sbom',
        identifier: !fromSBOM ? data.fromSBOMId : data.toSBOMId,
      });
    }

    const fromComponents = this.components.get(data.fromSBOMId) || [];
    const toComponents = this.components.get(data.toSBOMId) || [];

    const fromNames = new Set(fromComponents.map(c => c.name));
    const toNames = new Set(toComponents.map(c => c.name));

    const added = Array.from(toNames).filter(n => !fromNames.has(n));
    const removed = Array.from(fromNames).filter(n => !toNames.has(n));

    const updated = toComponents
      .filter(c => fromNames.has(c.name))
      .map(c => {
        const fromComp = fromComponents.find(fc => fc.name === c.name);
        if (fromComp && fromComp.version !== c.version) {
          return {
            name: c.name,
            fromVersion: fromComp.version,
            toVersion: c.version,
          };
        }
        return null;
      })
      .filter(Boolean) as { name: string; fromVersion: string; toVersion: string }[];

    const summary = `SBOM 比较: 新增 ${added.length} 个组件，移除 ${removed.length} 个组件，更新 ${updated.length} 个组件`;

    return {
      id: `compare_${Date.now()}`,
      fromSBOMId: data.fromSBOMId,
      toSBOMId: data.toSBOMId,
      addedComponents: added,
      removedComponents: removed,
      updatedComponents: updated,
      newVulnerabilities: [],
      fixedVulnerabilities: [],
      licenseChanges: [],
      summary,
    };
  }

  /**
   * 模拟生成组件
   */
  private generateMockComponents(sbomId: string, deepScan?: boolean): void {
    const count = deepScan ? 50 : 20;
    const components: SBOMComponent[] = [];

    const mockPackages = [
      { name: 'express', version: '4.18.2', license: 'MIT' },
      { name: 'lodash', version: '4.17.21', license: 'MIT' },
      { name: 'axios', version: '1.4.0', license: 'MIT' },
      { name: 'react', version: '18.2.0', license: 'MIT' },
      { name: 'typescript', version: '5.0.4', license: 'Apache-2.0' },
      { name: 'webpack', version: '5.88.0', license: 'MIT' },
      { name: 'jest', version: '29.5.0', license: 'MIT' },
      { name: 'eslint', version: '8.44.0', license: 'MIT' },
      { name: 'fastify', version: '4.21.0', license: 'MIT' },
      { name: 'node', version: '20.5.0', license: 'MIT' },
    ];

    for (let i = 0; i < count; i++) {
      const pkg = mockPackages[i % mockPackages.length];
      components.push({
        id: this.generateComponentId(),
        sbomId,
        name: pkg.name,
        version: pkg.version,
        type: 'library',
        purl: `pkg:npm/${pkg.name}@${pkg.version}`,
        hash: { algorithm: 'sha256', value: `hash_${i}` },
        license: {
          id: pkg.license,
          name: pkg.license,
          type: this.getLicenseType(pkg.license),
        },
        dependencies: [],
        properties: {},
      });
    }

    this.components.set(sbomId, components);

    // 更新 SBOM 组件计数
    const sbom = this.sboms.get(sbomId);
    if (sbom) {
      sbom.componentsCount = count;
      sbom.licensesCount = new Set(components.map(c => c.license.id)).size;
      this.sboms.set(sbomId, sbom);
    }
  }

  /**
   * 模拟生成漏洞
   */
  private generateMockVulnerabilities(sbomId: string): void {
    const components = this.components.get(sbomId) || [];
    const vulnerabilities: Vulnerability[] = [];

    const mockVulns = [
      { cveId: 'CVE-2023-1234', severity: VulnerabilitySeverity.HIGH, cvss: 8.5 },
      { cveId: 'CVE-2023-5678', severity: VulnerabilitySeverity.MEDIUM, cvss: 5.5 },
      { cveId: 'CVE-2023-9012', severity: VulnerabilitySeverity.CRITICAL, cvss: 9.8 },
    ];

    // 随机为一些组件添加漏洞
    const vulnComponents = components.slice(0, Math.min(components.length, 5));

    for (const comp of vulnComponents) {
      const vuln = mockVulns[Math.floor(Math.random() * mockVulns.length)];
      vulnerabilities.push({
        id: this.generateVulnId(),
        sbomId,
        componentId: comp.id,
        componentName: comp.name,
        cveId: vuln.cveId,
        severity: vuln.severity,
        cvssScore: vuln.cvss,
        description: `安全漏洞 ${vuln.cveId}`,
        affectedVersions: comp.version,
        references: [`https://nvd.nist.gov/vuln/detail/${vuln.cveId}`],
        status: 'open',
        publishedAt: new Date().toISOString(),
        discoveredAt: new Date().toISOString(),
      });
    }

    this.vulnerabilities.set(sbomId, vulnerabilities);
  }

  /**
   * 根据许可证 ID 获取类型
   */
  private getLicenseType(licenseId: string): LicenseType {
    if (licenseId.startsWith('MIT')) return LicenseType.MIT;
    if (licenseId.startsWith('Apache')) return LicenseType.APACHE;
    if (licenseId.startsWith('BSD')) return LicenseType.BSD;
    if (licenseId.startsWith('GPL')) return LicenseType.GPL;
    if (licenseId.startsWith('LGPL')) return LicenseType.LGPL;
    return LicenseType.PERMISSIVE;
  }

  /**
   * 获取许可证风险等级
   */
  private getLicenseRiskLevel(type: LicenseType): 'low' | 'medium' | 'high' {
    if (type === LicenseType.GPL) return 'high';
    if (type === LicenseType.LGPL || type === LicenseType.CDDL || type === LicenseType.ECL) return 'medium';
    return 'low';
  }

  /**
   * 获取许可证义务
   */
  private getLicenseObligations(type: LicenseType): string[] {
    if (type === LicenseType.GPL) return ['源代码必须公开', '衍生作品必须使用相同许可证'];
    if (type === LicenseType.LGPL) return ['库使用需要注明', '修改库需要公开源代码'];
    if (type === LicenseType.APACHE) return ['保留版权声明', '保留许可证文本'];
    if (type === LicenseType.MIT) return ['保留版权声明', '保留许可证文本'];
    return [];
  }

  /**
   * 获取许可证限制
   */
  private getLicenseRestrictions(type: LicenseType): string[] {
    if (type === LicenseType.GPL) return ['不能与其他许可证混合', '商业使用需要开源'];
    if (type === LicenseType.PROPRIETARY) return ['禁止分发', '禁止修改'];
    return [];
  }

  /**
   * 获取许可证兼容性
   */
  private getLicenseCompatibility(type: LicenseType): string[] {
    if (type === LicenseType.MIT) return ['Apache-2.0', 'BSD', 'GPL'];
    if (type === LicenseType.APACHE) return ['MIT', 'BSD', 'GPL-3.0'];
    if (type === LicenseType.GPL) return ['GPL'];
    return [];
  }

  /**
   * 格式化 SBOM 内容
   */
  private formatSBOMContent(sbom: SBOMDocument, components: SBOMComponent[], format: SBOMFormat): string {
    if (format === SBOMFormat.SPDX) {
      return JSON.stringify({
        spdxVersion: 'SPDX-2.3',
        dataLicense: 'CC0-1.0',
        SPDXID: `SPDXRef-${sbom.id}`,
        name: sbom.name,
        documentNamespace: `https://example.com/${sbom.id}`,
        packages: components.map(c => ({
          SPDXID: `SPDXRef-${c.id}`,
          name: c.name,
          versionInfo: c.version,
          licenseConcluded: c.license.id,
        })),
      });
    }

    // CycloneDX 格式
    return JSON.stringify({
      bomFormat: 'CycloneDX',
      specVersion: '1.5',
      serialNumber: `urn:uuid:${sbom.id}`,
      metadata: {
        component: {
          type: sbom.artifactType,
          name: sbom.name,
          version: sbom.version,
        },
      },
      components: components.map(c => ({
        bomRef: c.id,
        type: c.type,
        name: c.name,
        version: c.version,
        purl: c.purl,
        licenses: [{ license: { id: c.license.id } }],
      })),
    });
  }
}

// 单例服务实例
export const sbomService = new SBOMService();

/**
 * SBOM 路由类
 */
export class SBOMRoutes {
  constructor(private app: FastifyInstance) {}

  register(): void {
    // GET /api/v1/sbom - 获取 SBOM 列表
    this.app.get('/api/v1/sbom', async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as OffsetPaginationParams & {
        artifactId?: string;
        artifactType?: string;
        status?: SBOMStatus;
        format?: SBOMFormat;
      };

      const paginationParams = PaginationHelper.parseOffsetParams(query);
      const { data, total } = await sbomService.listSBOMs(
        paginationParams,
        {
          artifactId: query.artifactId,
          artifactType: query.artifactType,
          status: query.status,
          format: query.format,
        }
      );

      return reply.send(
        PaginationHelper.createOffsetResponse(data, {
          offset: paginationParams.offset || 0,
          limit: paginationParams.limit || 20,
          total,
        })
      );
    });

    // POST /api/v1/sbom - 生成 SBOM
    this.app.post('/api/v1/sbom', async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as GenerateSBOMRequest;
      const sbom = await sbomService.generateSBOM(body);
      return reply.code(201).send(sbom);
    });

    // POST /api/v1/sbom/compare - 比较 SBOM
    this.app.post('/api/v1/sbom/compare', async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as CompareSBOMRequest;
      const comparison = await sbomService.compareSBOMs(body);
      return reply.send(comparison);
    });

    // GET /api/v1/sbom/:id - 获取 SBOM 详情
    this.app.get('/api/v1/sbom/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const sbom = await sbomService.getSBOM(params.id);

      if (!sbom) {
        throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
          resourceType: 'sbom',
          identifier: params.id,
        });
      }

      return reply.send(sbom);
    });

    // GET /api/v1/sbom/:id/components - 获取 SBOM 组件列表
    this.app.get('/api/v1/sbom/:id/components', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const query = request.query as OffsetPaginationParams;

      const paginationParams = PaginationHelper.parseOffsetParams(query);
      const { data, total } = await sbomService.getComponents(params.id, paginationParams);

      return reply.send(
        PaginationHelper.createOffsetResponse(data, {
          offset: paginationParams.offset || 0,
          limit: paginationParams.limit || 50,
          total,
        })
      );
    });

    // GET /api/v1/sbom/:id/vulnerabilities - 获取漏洞扫描结果
    this.app.get('/api/v1/sbom/:id/vulnerabilities', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const query = request.query as OffsetPaginationParams & { severity?: VulnerabilitySeverity };

      const paginationParams = PaginationHelper.parseOffsetParams(query);
      const { data, total } = await sbomService.getVulnerabilities(params.id, {
        ...paginationParams,
        severity: query.severity,
      });

      return reply.send(
        PaginationHelper.createOffsetResponse(data, {
          offset: paginationParams.offset || 0,
          limit: paginationParams.limit || 50,
          total,
        })
      );
    });

    // POST /api/v1/sbom/:id/scan - 执行漏洞扫描
    this.app.post('/api/v1/sbom/:id/scan', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const body = (request.body || {}) as ScanRequest;

      const sbom = await sbomService.scanSBOM(params.id, body);
      return reply.send(sbom);
    });

    // GET /api/v1/sbom/:id/licenses - 获取许可证信息
    this.app.get('/api/v1/sbom/:id/licenses', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const licenses = await sbomService.getLicenses(params.id);
      return reply.send({ data: licenses });
    });

    // GET /api/v1/sbom/:id/attestation - 获取 SBOM 证明
    this.app.get('/api/v1/sbom/:id/attestation', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const attestations = await sbomService.getAttestations(params.id);
      return reply.send({ data: attestations });
    });

    // POST /api/v1/sbom/:id/attestation - 创建 SBOM 证明
    this.app.post('/api/v1/sbom/:id/attestation', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const body = request.body as CreateAttestationRequest;

      const attestation = await sbomService.createAttestation(params.id, body);
      return reply.code(201).send(attestation);
    });

    // GET /api/v1/sbom/:id/export - 导出 SBOM
    this.app.get('/api/v1/sbom/:id/export', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const query = request.query as { format?: SBOMFormat };

      const format = query.format || SBOMFormat.CYCLONE_DX;
      const result = await sbomService.exportSBOM(params.id, format);

      reply.header('Content-Type', 'application/json');
      reply.header('Content-Disposition', `attachment; filename="sbom-${params.id}.json"`);
      return reply.send(result.content);
    });
  }
}