/**
 * Pipeline Service - Pipeline CRUD 操作
 */

import {
  Pipeline,
  PipelineStatus,
  PipelineCreateInput,
  PipelineUpdateInput,
  createPipeline,
  parsePipelineYaml,
} from '../../models/Pipeline';

/**
 * 内存存储（生产环境应使用数据库）
 */
const pipelines = new Map<string, Pipeline>();
const pipelineVersions = new Map<string, Pipeline[]>(); // name -> [pipelines]

export class PipelineService {
  /**
   * 创建 Pipeline
   */
  async create(input: PipelineCreateInput): Promise<Pipeline> {
    // 验证 YAML
    try {
      const { metadata, spec } = parsePipelineYaml(input.yamlDefinition);

      // 验证 metadata 与输入是否一致
      if (metadata.name !== input.name) {
        throw new Error(`Pipeline name mismatch: YAML has '${metadata.name}', expected '${input.name}'`);
      }
      if (metadata.version !== input.version) {
        throw new Error(`Pipeline version mismatch: YAML has '${metadata.version}', expected '${input.version}'`);
      }

      // 验证 stages
      if (!spec.stages || spec.stages.length === 0) {
        throw new Error('Pipeline must have at least one stage');
      }

      // 验证 stage 依赖关系
      const stageNames = new Set(spec.stages.map((s: { name: string }) => s.name));
      for (const stage of spec.stages) {
        if (stage.dependsOn) {
          for (const dep of stage.dependsOn) {
            if (!stageNames.has(dep)) {
              throw new Error(`Stage '${stage.name}' depends on unknown stage '${dep}'`);
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Pipeline validation failed: ${error.message}`);
      }
      throw error;
    }

    // 检查同名同版本是否已存在
    const key = `${input.name}@${input.version}`;
    const existing = Array.from(pipelines.values()).find(
      p => p.name === input.name && p.version === input.version && p.status !== PipelineStatus.DELETED
    );
    if (existing) {
      throw new Error(`Pipeline '${key}' already exists`);
    }

    const pipeline = createPipeline(input);
    pipelines.set(pipeline.id, pipeline);

    // 维护版本列表
    const versions = pipelineVersions.get(input.name) || [];
    versions.push(pipeline);
    pipelineVersions.set(input.name, versions);

    return pipeline;
  }

  /**
   * 获取 Pipeline 详情
   */
  async getById(id: string): Promise<Pipeline | null> {
    const pipeline = pipelines.get(id);
    if (!pipeline || pipeline.status === PipelineStatus.DELETED) {
      return null;
    }

    // 返回时解析 spec
    try {
      const { spec } = parsePipelineYaml(pipeline.yamlDefinition);
      return { ...pipeline, spec };
    } catch {
      return pipeline;
    }
  }

  /**
   * 获取 Pipeline 列表
   */
  async list(options?: {
    name?: string;
    status?: PipelineStatus;
    limit?: number;
    offset?: number;
  }): Promise<Pipeline[]> {
    let result = Array.from(pipelines.values());

    // 过滤已删除的
    result = result.filter(p => p.status !== PipelineStatus.DELETED);

    // 按名称过滤
    if (options?.name) {
      result = result.filter(p => p.name === options.name);
    }

    // 按状态过滤
    if (options?.status) {
      result = result.filter(p => p.status === options.status);
    }

    // 排序（最新的在前）
    result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // 分页
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;
    return result.slice(offset, offset + limit);
  }

  /**
   * 获取 Pipeline 所有版本
   */
  async getVersions(name: string): Promise<Pipeline[]> {
    const versions = pipelineVersions.get(name) || [];
    return versions
      .filter(p => p.status !== PipelineStatus.DELETED)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * 更新 Pipeline
   */
  async update(id: string, input: PipelineUpdateInput): Promise<Pipeline | null> {
    const pipeline = pipelines.get(id);
    if (!pipeline || pipeline.status === PipelineStatus.DELETED) {
      return null;
    }

    // 更新 YAML 定义时需要验证
    if (input.yamlDefinition) {
      try {
        const { metadata } = parsePipelineYaml(input.yamlDefinition);
        if (metadata.name !== pipeline.name || metadata.version !== pipeline.version) {
          throw new Error('Cannot change pipeline name or version in update');
        }
        pipeline.yamlDefinition = input.yamlDefinition;
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Pipeline validation failed: ${error.message}`);
        }
        throw error;
      }
    }

    if (input.description !== undefined) {
      pipeline.description = input.description;
    }

    if (input.status !== undefined) {
      pipeline.status = input.status;
    }

    pipeline.updatedAt = new Date();
    pipelines.set(id, pipeline);

    return pipeline;
  }

  /**
   * 删除 Pipeline
   */
  async delete(id: string): Promise<boolean> {
    const pipeline = pipelines.get(id);
    if (!pipeline || pipeline.status === PipelineStatus.DELETED) {
      return false;
    }

    pipeline.status = PipelineStatus.DELETED;
    pipeline.updatedAt = new Date();
    pipelines.set(id, pipeline);

    return true;
  }

  /**
   * 验证 Pipeline YAML
   */
  async validate(yamlDefinition: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      const { metadata, spec } = parsePipelineYaml(yamlDefinition);

      // 验证 stages
      if (!spec.stages || spec.stages.length === 0) {
        errors.push('Pipeline must have at least one stage');
      } else {
        // 验证 stage 依赖关系
        const stageNames = new Set(spec.stages.map((s: { name: string }) => s.name));
        for (const stage of spec.stages) {
          if (stage.dependsOn) {
            for (const dep of stage.dependsOn) {
              if (!stageNames.has(dep)) {
                errors.push(`Stage '${stage.name}' depends on unknown stage '${dep}'`);
              }
            }
          }
        }

        // 验证循环依赖
        const visited = new Set<string>();
        const recStack = new Set<string>();

        const hasCycle = (stageName: string): boolean => {
          if (recStack.has(stageName)) {
            return true;
          }
          if (visited.has(stageName)) {
            return false;
          }

          visited.add(stageName);
          recStack.add(stageName);

          const stage = spec.stages?.find((s: { name: string }) => s.name === stageName);
          if (stage?.dependsOn) {
            for (const dep of stage.dependsOn) {
              if (hasCycle(dep)) {
                return true;
              }
            }
          }

          recStack.delete(stageName);
          return false;
        };

        for (const stage of spec.stages) {
          if (hasCycle(stage.name)) {
            errors.push('Circular dependency detected in stages');
            break;
          }
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        errors.push(error.message);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// 导出单例
export const pipelineService = new PipelineService();
