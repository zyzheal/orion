/**
 * DependencyGraphService - 依赖关系图服务
 */

import { DatabasePool } from '../database';

export class DependencyGraphService {
  constructor(private pool: DatabasePool) {}

  async buildDependencyGraph(packages: Array<{ name: string; version: string }>): Promise<{ nodes: any[]; edges: any[] }> {
    const nodes: any[] = [];
    const edges: any[] = [];
    const seenNodes = new Set<string>();

    for (const pkg of packages) {
      const nodeId = `${pkg.name}@${pkg.version}`;
      nodes.push({ id: nodeId, name: pkg.name, version: pkg.version });
      seenNodes.add(nodeId);
    }

    // 查询每个包的直接依赖并存为节点和边
    for (const pkg of packages) {
      const directDepJson = await this.pool.query(
        `SELECT direct_deps FROM dependency_graphs WHERE package_name = $1 AND package_version = $2 ORDER BY analyzed_at DESC LIMIT 1`,
        [pkg.name, pkg.version],
      );
      if (directDepJson.rows.length > 0) {
        const nodeId = `${pkg.name}@${pkg.version}`;
        const directDeps: any[] = Array.isArray(directDepJson.rows[0]?.direct_deps)
          ? directDepJson.rows[0].direct_deps
          : [];
        for (const dep of directDeps) {
          const depId = `${dep.name}@${dep.version}`;
          if (!seenNodes.has(depId)) {
            nodes.push({ id: depId, name: dep.name, version: dep.version });
            seenNodes.add(depId);
          }
          edges.push({ source: nodeId, target: depId, type: 'depends_on' });
        }
      }
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

  async getTransitiveDependencies(packageName: string, packageVersion?: string, depth = 3): Promise<any[]> {
    const result = packageVersion
      ? await this.pool.query(
          `SELECT transitive_deps FROM dependency_graphs WHERE package_name = $1 AND package_version = $2 ORDER BY analyzed_at DESC LIMIT 1`,
          [packageName, packageVersion],
        )
      : await this.pool.query(
          `SELECT transitive_deps FROM dependency_graphs WHERE package_name = $1 ORDER BY analyzed_at DESC LIMIT 1`,
          [packageName],
        );
    if (result.rows.length > 0) {
      const raw = result.rows[0].transitive_deps;
      return Array.isArray(raw) ? raw : [];
    }
    return [];
  }
}
