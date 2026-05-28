/**
 * Artifact Registry Service
 * 制品仓库服务
 */

import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';
import { ArtifactRepository } from '../../repositories/ArtifactRepository';
import { ArtifactStorage } from '../../storage/ArtifactStorage';
import {
  Artifact,
  ArtifactType,
  ArtifactStatus,
  CreateArtifactInput,
  UpdateArtifactInput,
  ArtifactQueryOptions,
  ArtifactDownloadOptions,
  ArtifactRegistryService
} from '../../models/Artifact';
import { OrionError, ErrorCode } from '../../../errors';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export class ArtifactRegistryServiceImpl implements ArtifactRegistryService {
  constructor(
    private artifactRepository: ArtifactRepository,
    private artifactStorage: ArtifactStorage
  ) {}

  /**
   * 创建制品
   */
  async create(input: CreateArtifactInput): Promise<Artifact> {
    try {
      // 检查是否已存在相同的制品
      const existing = await this.artifactRepository.findByNamespaceNameVersion(
        input.namespace,
        input.name,
        input.version
      );

      if (existing) {
        throw new OrionError(ErrorCode.NOT_FOUND, `Artifact already exists: ${input.namespace}/${input.name}:${input.version}`);
      }

      // 创建制品记录
      const artifact: Artifact = {
        id: uuidv4(),
        name: input.name,
        namespace: input.namespace,
        version: input.version,
        type: input.type,
        status: ArtifactStatus.AVAILABLE,
        sizeBytes: input.sizeBytes,
        checksumSha256: input.checksumSha256,
        checksumSha512: input.checksumSha512,
        metadata: input.metadata || {},
        storagePath: input.storagePath,
        createdBy: input.createdBy,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.artifactRepository.create(artifact);
      logger.info({ artifactId: artifact.id, namespace: artifact.namespace, name: artifact.name }, 'Artifact created successfully');
      
      return artifact;
    } catch (error) {
      logger.error({ error, input }, 'Failed to create artifact');
      throw error;
    }
  }

  /**
   * 获取制品详情
   */
  async get(id: string): Promise<Artifact> {
    try {
      const artifact = await this.artifactRepository.findById(id);
      
      if (!artifact) {
        throw new OrionError(ErrorCode.NOT_FOUND, `Artifact not found: ${id}`);
      }

      return artifact;
    } catch (error) {
      logger.error({ error, id }, 'Failed to get artifact');
      throw error;
    }
  }

  /**
   * 获取制品列表
   */
  async list(options: ArtifactQueryOptions): Promise<{ artifacts: Artifact[]; total: number }> {
    try {
      const { artifacts, total } = await this.artifactRepository.find(options);
      return { artifacts, total };
    } catch (error) {
      logger.error({ error, options }, 'Failed to list artifacts');
      throw error;
    }
  }

  /**
   * 更新制品
   */
  async update(input: UpdateArtifactInput): Promise<Artifact> {
    try {
      const existing = await this.artifactRepository.findById(input.id);
      
      if (!existing) {
        throw new OrionError(ErrorCode.NOT_FOUND, `Artifact not found: ${input.id}`);
      }

      // 更新状态
      if (input.status) {
        existing.status = input.status;
      }

      // 更新元数据
      if (input.metadata) {
        existing.metadata = { ...existing.metadata, ...input.metadata };
      }

      existing.updatedAt = new Date();

      await this.artifactRepository.update(existing);
      logger.info({ artifactId: input.id }, 'Artifact updated successfully');
      
      return existing;
    } catch (error) {
      logger.error({ error, input }, 'Failed to update artifact');
      throw error;
    }
  }

  /**
   * 删除制品
   */
  async delete(id: string): Promise<void> {
    try {
      const artifact = await this.artifactRepository.findById(id);
      
      if (!artifact) {
        throw new OrionError(ErrorCode.NOT_FOUND, `Artifact not found: ${id}`);
      }

      // 软删除
      await this.artifactRepository.softDelete(id);
      
      // 删除存储文件
      await this.artifactStorage.delete(id);
      
      logger.info({ artifactId: id }, 'Artifact deleted successfully');
    } catch (error) {
      logger.error({ error, id }, 'Failed to delete artifact');
      throw error;
    }
  }

  /**
   * 添加标签
   */
  async addTags(id: string, tags: string[]): Promise<void> {
    try {
      for (const tag of tags) {
        await this.artifactRepository.addTag(id, tag);
      }
      logger.info({ artifactId: id, tags }, 'Tags added successfully');
    } catch (error) {
      logger.error({ error, id, tags }, 'Failed to add tags');
      throw error;
    }
  }

  /**
   * 移除标签
   */
  async removeTags(id: string, tags: string[]): Promise<void> {
    try {
      for (const tag of tags) {
        await this.artifactRepository.removeTag(id, tag);
      }
      logger.info({ artifactId: id, tags }, 'Tags removed successfully');
    } catch (error) {
      logger.error({ error, id, tags }, 'Failed to remove tags');
      throw error;
    }
  }

  /**
   * 获取标签
   */
  async getTags(id: string): Promise<any[]> {
    try {
      return await this.artifactRepository.getTags(id);
    } catch (error) {
      logger.error({ error, id }, 'Failed to get tags');
      throw error;
    }
  }

  /**
   * 下载制品
   */
  async download(options: ArtifactDownloadOptions): Promise<Artifact> {
    try {
      const artifact = await this.artifactRepository.findById(options.artifactId);
      
      if (!artifact) {
        throw new OrionError(ErrorCode.NOT_FOUND, `Artifact not found: ${options.artifactId}`);
      }

      if (artifact.status !== ArtifactStatus.AVAILABLE) {
        throw new OrionError(ErrorCode.NOT_FOUND, `Artifact not available: ${artifact.status}`);
      }

      // 记录下载
      await this.artifactRepository.recordDownload({
        artifactId: options.artifactId,
        downloadedBy: options.downloadedBy,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent
      });

      logger.info({ 
        artifactId: options.artifactId, 
        downloadedBy: options.downloadedBy 
      }, 'Artifact downloaded successfully');
      
      return artifact;
    } catch (error) {
      logger.error({ error, options }, 'Failed to download artifact');
      throw error;
    }
  }

  /**
   * 获取下载历史
   */
  async getDownloadHistory(id: string): Promise<any[]> {
    try {
      return await this.artifactRepository.getDownloadHistory(id);
    } catch (error) {
      logger.error({ error, id }, 'Failed to get download history');
      throw error;
    }
  }

  /**
   * 搜索制品
   */
  async search(query: string): Promise<Artifact[]> {
    try {
      return await this.artifactRepository.search(query);
    } catch (error) {
      logger.error({ error, query }, 'Failed to search artifacts');
      throw error;
    }
  }

  /**
   * 制品升级
   */
  async promote(id: string, targetNamespace: string): Promise<Artifact> {
    try {
      const artifact = await this.artifactRepository.findById(id);
      
      if (!artifact) {
        throw new OrionError(ErrorCode.NOT_FOUND, `Artifact not found: ${id}`);
      }

      // 创建新的制品记录
      const promotedArtifact: CreateArtifactInput = {
        name: artifact.name,
        namespace: targetNamespace,
        version: artifact.version,
        type: artifact.type,
        sizeBytes: artifact.sizeBytes,
        checksumSha256: artifact.checksumSha256,
        checksumSha512: artifact.checksumSha512,
        metadata: { ...artifact.metadata, promotedFrom: `${artifact.namespace}/${artifact.name}` },
        storagePath: artifact.storagePath,
        createdBy: artifact.createdBy
      };

      const newArtifact = await this.create(promotedArtifact);
      logger.info({ 
        artifactId: id, 
        newArtifactId: newArtifact.id,
        targetNamespace 
      }, 'Artifact promoted successfully');
      
      return newArtifact;
    } catch (error) {
      logger.error({ error, id, targetNamespace }, 'Failed to promote artifact');
      throw error;
    }
  }

  /**
   * 废弃制品
   */
  async deprecate(id: string): Promise<Artifact> {
    try {
      return await this.update({ id, status: ArtifactStatus.DEPRECATED });
    } catch (error) {
      logger.error({ error, id }, 'Failed to deprecate artifact');
      throw error;
    }
  }

  /**
   * 隔离制品
   */
  async quarantine(id: string, reason: string): Promise<Artifact> {
    try {
      const artifact = await this.update({ 
        id, 
        status: ArtifactStatus.QUARANTINED,
        metadata: { ...(await this.artifactRepository.findById(id))?.metadata, quarantineReason: reason }
      });
      
      logger.info({ artifactId: id, reason }, 'Artifact quarantined successfully');
      return artifact;
    } catch (error) {
      logger.error({ error, id, reason }, 'Failed to quarantine artifact');
      throw error;
    }
  }
}