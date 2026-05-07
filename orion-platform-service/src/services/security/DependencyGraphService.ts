/**
 * DependencyGraphService - 依赖关系图服务
 */

import { DatabasePool } from '../database';

export class DependencyGraphService {
  constructor(private pool: DatabasePool) {}

  async buildDependencyGraph(packages: Array<{ name: string; version: string }>): Promise<any> {
    const nodes: any[] = [];
    const edges: any[] = [];

    for (const pkg of packages) {
      nodes.push({ id: `${pkg.name}@${pkg.version}`, name: pkg.name, version: pkg.version });
    }

    // 构建依赖边
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({ source: nodes[i].id, target: nodes[i + 1].id, type: 'depends_on' });
    }

    return { nodes, edges };
  }

  async findVulnerablePaths(
    packages: Array<{ name: string; version: string }>,
    vulnDb: any = {},
  ): Promise<any[]> {
    const vulnerable: any[] = [];
    for (const pkg of packages) {
      const vulns = vulnDb[`${pkg.name}@${pkg.version}`];
      if (vulns) {
        vulnerable.push({ package: pkg.name, version: pkg.version, vulnerabilities: vulns });
      }
    }
    return vulnerable;
  }

  async getTransitiveDependencies(packageName: string, depth = 3): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT transitive_deps FROM dependency_graphs WHERE package_name = $1 ORDER BY analyzed_at DESC LIMIT 1`,
      [packageName],
    );
    if (result.rows.length > 0) {
      return result.rows[0].transitive_deps || [];
    }
    return [];
  }
}
