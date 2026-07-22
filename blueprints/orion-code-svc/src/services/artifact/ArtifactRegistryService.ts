/**
 * Artifact Registry Service - 制品注册表服务 (stub)
 */

export class ArtifactRegistryServiceImpl {
  async create(data: any): Promise<any> {
    return { id: 'stub', ...data };
  }

  async findById(id: string): Promise<any> {
    return null;
  }
}
