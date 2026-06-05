/**
 * Plugin Dependency Resolver
 *
 * Handles plugin-to-plugin dependency management:
 * - Build dependency graph from plugin manifests
 * - Resolve install order using topological sort
 * - Detect circular dependencies
 * - Validate dependency availability
 *
 * Uses Kahn's algorithm for topological sorting which naturally
 * detects cycles and produces a valid installation order.
 */

import pino from 'pino';
import { OrionError } from '../../errors';
import {
  PluginManifest,
  DependencyResolutionResult,
} from './types';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * Adjacency list representation of the dependency graph
 */
interface DependencyGraph {
  /** Map of pluginId -> list of plugins it depends on */
  edges: Map<string, string[]>;
  /** All known plugin IDs */
  nodes: Set<string>;
}

/**
 * Plugin Dependency Resolver
 */
export class PluginDependencyResolver {
  /**
   * Resolve dependencies for a set of plugins
   *
   * Returns the resolved install order, missing dependencies, and any cycles.
   */
  resolveDependencies(manifests: PluginManifest[]): DependencyResolutionResult {
    const graph = this.buildDependencyGraph(manifests);
    const missing = this.findMissingDependencies(graph, manifests);
    const cycles = this.detectCycles(graph);

    // Only compute install order if no cycles
    let installOrder: string[] = [];
    if (cycles.length === 0) {
      installOrder = this.topologicalSort(graph);
    }

    const resolved = missing.length === 0 && cycles.length === 0;

    return {
      installOrder,
      missing,
      cycles,
      resolved,
    };
  }

  /**
   * Detect circular dependencies in the plugin graph
   *
   * Returns an array of cycles, where each cycle is an array of plugin IDs.
   */
  detectCycles(manifestsOrGraph: PluginManifest[] | DependencyGraph): string[][] {
    const graph = Array.isArray(manifestsOrGraph)
      ? this.buildDependencyGraph(manifestsOrGraph)
      : manifestsOrGraph;

    const cycles: string[][] = [];
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string): void => {
      if (inStack.has(node)) {
        // Found a cycle - extract it from the path
        const cycleStart = path.indexOf(node);
        if (cycleStart !== -1) {
          const cycle = [...path.slice(cycleStart), node];
          cycles.push(cycle);
        }
        return;
      }

      if (visited.has(node)) {
        return;
      }

      visited.add(node);
      inStack.add(node);
      path.push(node);

      const deps = graph.edges.get(node) || [];
      for (const dep of deps) {
        if (graph.nodes.has(dep)) {
          dfs(dep);
        }
      }

      path.pop();
      inStack.delete(node);
    };

    for (const node of graph.nodes) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return cycles;
  }

  /**
   * Get the installation order for a set of plugins
   *
   * Returns plugins in the order they should be installed (dependencies first).
   */
  getInstallOrder(manifests: PluginManifest[]): string[] {
    const graph = this.buildDependencyGraph(manifests);
    const cycles = this.detectCycles(graph);

    if (cycles.length > 0) {
      throw new OrionError(`Cannot determine install order: circular dependency detected: ${cycles[0].join(' -> ')}`, 'OPERATION_FAILED');
    }

    return this.topologicalSort(graph);
  }

  /**
   * Check if a plugin can be installed (all dependencies satisfied)
   */
  canInstall(manifest: PluginManifest, installedPlugins: string[]): {
    canInstall: boolean;
    missingDeps: string[];
  } {
    const missingDeps: string[] = [];

    if (manifest.dependencies) {
      for (const dep of manifest.dependencies) {
        if (dep.optional) continue;
        if (!installedPlugins.includes(dep.name)) {
          missingDeps.push(dep.name);
        }
      }
    }

    return {
      canInstall: missingDeps.length === 0,
      missingDeps,
    };
  }

  /**
   * Build a dependency graph from plugin manifests
   */
  private buildDependencyGraph(manifests: PluginManifest[]): DependencyGraph {
    const graph: DependencyGraph = {
      edges: new Map(),
      nodes: new Set(),
    };

    // Register all plugin nodes
    for (const manifest of manifests) {
      graph.nodes.add(manifest.name);
      if (!graph.edges.has(manifest.name)) {
        graph.edges.set(manifest.name, []);
      }
    }

    // Build edges (plugin -> its dependencies)
    for (const manifest of manifests) {
      if (manifest.dependencies) {
        const deps = manifest.dependencies
          .filter((d) => !d.optional) // Only non-optional deps
          .map((d) => d.name);
        graph.edges.set(manifest.name, deps);
      }
    }

    return graph;
  }

  /**
   * Find dependencies that are declared but not available
   */
  private findMissingDependencies(
    graph: DependencyGraph,
    manifests: PluginManifest[]
  ): { pluginId: string; missingDependency: string }[] {
    const missing: { pluginId: string; missingDependency: string }[] = [];

    for (const manifest of manifests) {
      if (!manifest.dependencies) continue;

      for (const dep of manifest.dependencies) {
        if (dep.optional) continue;
        if (!graph.nodes.has(dep.name)) {
          missing.push({
            pluginId: manifest.name,
            missingDependency: dep.name,
          });
        }
      }
    }

    return missing;
  }

  /**
   * Topological sort using Kahn's algorithm
   *
   * Produces a valid installation order where dependencies come before
   * the plugins that depend on them.
   */
  private topologicalSort(graph: DependencyGraph): string[] {
    const inDegree = new Map<string, number>();

    // Initialize in-degree for all nodes
    for (const node of graph.nodes) {
      inDegree.set(node, 0);
    }

    // Calculate in-degree for each node
    for (const [node, deps] of graph.edges) {
      for (const dep of deps) {
        if (graph.nodes.has(dep)) {
          // The dependent plugin has an incoming edge
          inDegree.set(node, (inDegree.get(node) || 0) + 1);
        }
      }
    }

    // Actually, in our graph edges[node] = dependencies of node
    // So we need to reverse: for each dependency, increment in-degree of the dependent
    inDegree.clear();
    for (const node of graph.nodes) {
      inDegree.set(node, 0);
    }

    for (const [node, deps] of graph.edges) {
      for (const dep of deps) {
        if (graph.nodes.has(dep)) {
          inDegree.set(node, (inDegree.get(node) || 0) + 1);
        }
      }
    }

    // Start with nodes that have no dependencies (in-degree 0)
    const queue: string[] = [];
    for (const [node, degree] of inDegree) {
      if (degree === 0) {
        queue.push(node);
      }
    }

    const result: string[] = [];

    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);

      // For each plugin that depends on this node, reduce in-degree
      for (const [otherNode, deps] of graph.edges) {
        if (deps.includes(node)) {
          const newDegree = (inDegree.get(otherNode) || 1) - 1;
          inDegree.set(otherNode, newDegree);
          if (newDegree === 0) {
            queue.push(otherNode);
          }
        }
      }
    }

    // If result doesn't include all nodes, there's a cycle
    if (result.length !== graph.nodes.size) {
      logger.warn(
        { expected: graph.nodes.size, got: result.length },
        'Topological sort could not resolve all nodes - cycle detected'
      );
      // Return whatever we could resolve
    }

    return result;
  }
}
