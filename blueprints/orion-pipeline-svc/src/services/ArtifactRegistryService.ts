/**
 * ArtifactRegistryService - 多类型制品库服务 (Task 3.1)
 *
 * 职责：
 * - 支持 Maven 仓库类型 (jar/war/pom)
 * - 支持 npm 仓库类型 (tgz)
 * - 支持 Helm 仓库类型 (chart)
 * - 通用制品库 (docker 镜像等)
 * - 按类型路由到不同存储策略
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import pino from 'pino';
import { ArtifactSignatureService } from './ArtifactSignatureService';

const logger = pino({ name: 'artifact-registry-service' });

export type ArtifactType = 'maven' | 'npm' | 'helm' | 'docker' | 'generic';

export interface MavenArtifact {
  groupId: string;
  artifactId: string;
  version: string;
  packaging?: string;
  classifier?: string;
  pomPath?: string;
}

export interface NpmArtifact {
  name: string;
  version: string;
  registryUrl?: string;
}

export interface HelmArtifact {
  chartName: string;
  version: string;
  repository?: string;
}

export interface ArtifactRegistryConfig {
  baseDir?: string;
  repositories?: {
    maven?: { path?: string; snapshotsPath?: string };
    npm?: { path?: string; registryUrl?: string };
    helm?: { path?: string; indexUrl?: string };
  };
}

export interface PublishedArtifact {
  type: ArtifactType;
  name: string;
  version: string;
  filePath: string;
  checksum: string;
  publishedAt: string;
  publishedBy?: string;
  size: number;
}

export interface ArtifactListResult {
  items: PublishedArtifact[];
  total: number;
  page: number;
  pageSize: number;
}

export class ArtifactRegistryService {
  private baseDir: string;
  private repos: {
    maven: { snapshots: string; releases: string };
    npm: { path: string };
    helm: { path: string };
    docker: { path: string };
    generic: { path: string };
  };
  private signatureService: ArtifactSignatureService;

  constructor(config?: ArtifactRegistryConfig) {
    this.baseDir = config?.baseDir || '/tmp/orion-registry';
    this.signatureService = new ArtifactSignatureService();

    const mavenPath = config?.repositories?.maven?.path || 'maven';
    const npmPath = config?.repositories?.npm?.path || 'npm';
    const helmPath = config?.repositories?.helm?.path || 'helm';

    this.repos = {
      maven: {
        snapshots: path.join(this.baseDir, mavenPath, 'snapshots'),
        releases: path.join(this.baseDir, mavenPath, 'releases'),
      },
      npm: {
        path: path.join(this.baseDir, npmPath),
      },
      helm: {
        path: path.join(this.baseDir, helmPath),
      },
      docker: {
        path: path.join(this.baseDir, 'docker'),
      },
      generic: {
        path: path.join(this.baseDir, 'generic'),
      },
    };

    this.ensureDirs();
  }

  /**
   * 发布 Maven 制品
   */
  async publishMaven(
    artifact: MavenArtifact,
    filePath: string,
    pomContent?: string,
    isSnapshot?: boolean
  ): Promise<PublishedArtifact> {
    const repoDir = isSnapshot ? this.repos.maven.snapshots : this.repos.maven.releases;
    const groupPath = artifact.groupId.replace(/\./g, path.sep);
    const artifactDir = path.join(repoDir, groupPath, artifact.artifactId, artifact.version);

    this.ensureDir(artifactDir);

    const fileName = this.mavenFileName(artifact);
    const targetPath = path.join(artifactDir, fileName);

    fs.copyFileSync(filePath, targetPath);

    // 发布 POM 文件
    if (pomContent) {
      fs.writeFileSync(path.join(artifactDir, `${artifact.artifactId}-${artifact.version}.pom`), pomContent);
    }

    // 生成 checksum
    const checksum = this.computeChecksum(targetPath);
    fs.writeFileSync(`${targetPath}.sha256`, checksum);

    const published: PublishedArtifact = {
      type: 'maven',
      name: `${artifact.groupId}:${artifact.artifactId}`,
      version: artifact.version,
      filePath: targetPath,
      checksum,
      publishedAt: new Date().toISOString(),
      size: fs.statSync(targetPath).size,
    };

    logger.info(
      { name: published.name, version: published.version, isSnapshot },
      'Maven artifact published'
    );

    return published;
  }

  /**
   * 发布 npm 制品
   */
  async publishNpm(
    artifact: NpmArtifact,
    filePath: string,
    metadata?: Record<string, unknown>
  ): Promise<PublishedArtifact> {
    const pkgDir = path.join(this.repos.npm.path, artifact.name.replace(/[/@]/g, '_'));
    this.ensureDir(pkgDir);

    const targetPath = path.join(pkgDir, `${artifact.name}-${artifact.version}.tgz`);
    fs.copyFileSync(filePath, targetPath);

    // 保存元数据
    const metaPath = path.join(pkgDir, 'package.json');
    const pkgMeta = {
      name: artifact.name,
      version: artifact.version,
      publishedAt: new Date().toISOString(),
      dist: {
        tarball: targetPath,
        shasum: this.computeChecksum(targetPath),
        integrity: `sha512-${Buffer.from(this.computeChecksum(targetPath, 'sha512'), 'hex').toString('base64')}`,
      },
      ...metadata,
    };
    fs.writeFileSync(metaPath, JSON.stringify(pkgMeta, null, 2));

    const published: PublishedArtifact = {
      type: 'npm',
      name: artifact.name,
      version: artifact.version,
      filePath: targetPath,
      checksum: pkgMeta.dist.shasum,
      publishedAt: new Date().toISOString(),
      size: fs.statSync(targetPath).size,
    };

    logger.info(
      { name: published.name, version: published.version },
      'npm package published'
    );

    return published;
  }

  /**
   * 发布 Helm Chart
   */
  async publishHelm(
    artifact: HelmArtifact,
    chartPath: string,
    repoIndex?: Record<string, unknown>
  ): Promise<PublishedArtifact> {
    const chartDir = path.join(this.repos.helm.path, artifact.chartName);
    this.ensureDir(chartDir);

    const targetPath = path.join(chartDir, `${artifact.chartName}-${artifact.version}.tgz`);
    fs.copyFileSync(chartPath, targetPath);

    // 更新 index.yaml
    const indexPath = path.join(this.repos.helm.path, 'index.yaml');
    const index = this.loadOrCreateHelmIndex(indexPath);
    if (!index.entries) index.entries = {};
    index.entries[artifact.chartName] = index.entries[artifact.chartName] || [];
    index.entries[artifact.chartName].push({
      name: artifact.chartName,
      version: artifact.version,
      created: new Date().toISOString(),
      digest: this.computeChecksum(targetPath),
      urls: [targetPath],
      ...repoIndex,
    });

    // 简化：以 JSON 存储 index (生产环境应转换为 YAML)
    fs.writeFileSync(`${indexPath}.json`, JSON.stringify(index, null, 2));

    const published: PublishedArtifact = {
      type: 'helm',
      name: artifact.chartName,
      version: artifact.version,
      filePath: targetPath,
      checksum: this.computeChecksum(targetPath),
      publishedAt: new Date().toISOString(),
      size: fs.statSync(targetPath).size,
    };

    logger.info(
      { name: published.name, version: published.version },
      'Helm chart published'
    );

    return published;
  }

  /**
   * 列出指定类型的制品
   */
  listByType(
    type: ArtifactType,
    page = 1,
    pageSize = 20
  ): ArtifactListResult {
    const repoPath = this.getRepoPath(type);
    const items = this.scanRepoForArtifacts(repoPath, type);

    const total = items.length;
    const start = (page - 1) * pageSize;
    const paginatedItems = items.slice(start, start + pageSize);

    return {
      items: paginatedItems,
      total,
      page,
      pageSize,
    };
  }

  /**
   * 搜索制品
   */
  search(query: string): PublishedArtifact[] {
    const results: PublishedArtifact[] = [];
    const lowerQuery = query.toLowerCase();

    for (const type of ['maven', 'npm', 'helm', 'generic'] as ArtifactType[]) {
      const repoPath = this.getRepoPath(type);
      const items = this.scanRepoForArtifacts(repoPath, type);
      const filtered = items.filter(item =>
        item.name.toLowerCase().includes(lowerQuery) ||
        item.version.toLowerCase().includes(lowerQuery)
      );
      results.push(...filtered);
    }

    return results;
  }

  /**
   * 删除制品
   */
  async delete(type: ArtifactType, name: string, version: string): Promise<boolean> {
    const repoPath = this.getRepoPath(type);
    const itemPath = this.findArtifactPath(repoPath, type, name, version);

    if (!itemPath || !fs.existsSync(itemPath)) {
      return false;
    }

    fs.unlinkSync(itemPath);
    logger.info({ type, name, version }, 'Artifact deleted');
    return true;
  }

  // ==================== 内部辅助方法 ====================

  private ensureDirs(): void {
    Object.values(this.repos).forEach(repo => {
      if (typeof repo === 'string') {
        this.ensureDir(repo);
      } else {
        Object.values(repo).forEach(dir => this.ensureDir(dir));
      }
    });
  }

  private ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  private getRepoPath(type: ArtifactType): string {
    switch (type) {
      case 'maven': return this.repos.maven.releases;
      case 'npm': return this.repos.npm.path;
      case 'helm': return this.repos.helm.path;
      case 'docker': return this.repos.docker.path;
      case 'generic': return this.repos.generic.path;
    }
  }

  private mavenFileName(artifact: MavenArtifact): string {
    const ext = artifact.packaging || 'jar';
    const base = `${artifact.artifactId}-${artifact.version}`;
    return artifact.classifier
      ? `${base}-${artifact.classifier}.${ext}`
      : `${base}.${ext}`;
  }

  private computeChecksum(filePath: string, _algorithm: string = 'sha256'): string {
    // 使用顶层导入的 crypto 模块
    try {
      const hash = crypto.createHash('sha256');
      const data = fs.readFileSync(filePath);
      hash.update(data);
      return hash.digest('hex');
    } catch {
      return '';
    }
  }

  private loadOrCreateHelmIndex(indexPath: string): { entries?: Record<string, Array<Record<string, unknown>>>; apiVersion?: string } {
    if (fs.existsSync(indexPath)) {
      try {
        return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
      } catch {
        return {};
      }
    }
    return { apiVersion: 'v1', entries: {} };
  }

  private scanRepoForArtifacts(repoPath: string, type: ArtifactType): PublishedArtifact[] {
    const items: PublishedArtifact[] = [];

    if (!fs.existsSync(repoPath)) return items;

    const scanDir = (dirPath: string) => {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          scanDir(path.join(dirPath, entry.name));
        } else if (!entry.name.startsWith('.') && !entry.name.endsWith('.sha256')) {
          const fullPath = path.join(dirPath, entry.name);
          const stat = fs.statSync(fullPath);
          items.push({
            type,
            name: this.extractArtifactName(entry.name, type),
            version: this.extractArtifactVersion(entry.name, type),
            filePath: fullPath,
            checksum: this.computeChecksumSafe(fullPath),
            publishedAt: stat.mtime.toISOString(),
            size: stat.size,
          });
        }
      }
    };

    scanDir(repoPath);
    return items;
  }

  private extractArtifactName(fileName: string, type: ArtifactType): string {
    const name = fileName.replace(/\.(tgz|jar|war|pom|zip|tar\.gz)$/i, '');
    switch (type) {
      case 'maven':
        return name.split('-').slice(0, -1).join('-') || name;
      case 'npm':
        return name.split('-').slice(0, -1).join('-') || name;
      case 'helm':
        return name.split('-').slice(0, -1).join('-') || name;
      default:
        return name;
    }
  }

  private extractArtifactVersion(fileName: string, type: ArtifactType): string {
    const name = fileName.replace(/\.(tgz|jar|war|pom|zip|tar\.gz)$/i, '');
    const parts = name.split('-');
    return parts.length > 1 ? parts[parts.length - 1] : 'unknown';
  }

  private computeChecksumSafe(filePath: string): string {
    try {
      return this.computeChecksum(filePath);
    } catch {
      return '';
    }
  }

  private findArtifactPath(
    repoPath: string,
    type: ArtifactType,
    name: string,
    version: string
  ): string | null {
    let result: string | null = null;

    const scanDir = (dirPath: string) => {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          scanDir(path.join(dirPath, entry.name));
        } else if (
          entry.name.includes(name) &&
          entry.name.includes(version) &&
          !entry.name.endsWith('.sha256')
        ) {
          result = path.join(dirPath, entry.name);
        }
      }
    };

    if (fs.existsSync(repoPath)) {
      scanDir(repoPath);
    }

    return result;
  }
}
