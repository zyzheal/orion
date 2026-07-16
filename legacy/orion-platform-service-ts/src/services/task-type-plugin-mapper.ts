export interface PluginMappingEntry {
  /** Task type prefix or full type, e.g. "git/" or "git/checkout" */
  taskType: string;
  /** Corresponding plugin ID, e.g. "orion/git-clone@v1" */
  pluginId: string;
  /** Priority: exact match 10, prefix match 5 */
  priority: number;
}

/**
 * Maps Pipeline Task type (e.g. "git/checkout") to PluginExecutorService pluginId.
 *
 * Supports two match modes:
 * 1. Exact match: "git/checkout" -> "orion/git-clone@v1"
 * 2. Prefix match: "npm/*" -> "orion/npm-runner@v1"
 *
 * Exact match takes priority over prefix match.
 */
export class TaskTypeToPluginMapper {
  private mappings: PluginMappingEntry[] = [];

  register(entry: PluginMappingEntry): void {
    this.mappings.push(entry);
  }

  registerBatch(entries: PluginMappingEntry[]): void {
    for (const entry of entries) {
      this.register(entry);
    }
  }

  /**
   * Find pluginId for a task type.
   * 1. First check exact match (taskType === type)
   * 2. Then check prefix match (type.startsWith(taskType))
   * 3. Same priority sorted by priority descending
   */
  map(taskType: string): string | undefined {
    const lowerType = taskType.toLowerCase();

    const exactMatch = this.mappings
      .filter(m => m.taskType.toLowerCase() === lowerType)
      .sort((a, b) => b.priority - a.priority)[0];

    if (exactMatch) {
      return exactMatch.pluginId;
    }

    const prefixMatch = this.mappings
      .filter(m => lowerType.startsWith(m.taskType.toLowerCase()))
      .sort((a, b) => b.priority - a.priority)[0];

    return prefixMatch?.pluginId;
  }

  list(): PluginMappingEntry[] {
    return [...this.mappings];
  }
}

/**
 * Register default type -> pluginId mappings (covers all 5 TaskRunner hardcoded types)
 */
export function registerDefaultMappings(mapper: TaskTypeToPluginMapper): void {
  mapper.registerBatch([
    { taskType: 'git/', pluginId: 'orion/git-clone@v1', priority: 5 },
    { taskType: 'npm/', pluginId: 'orion/npm-runner@v1', priority: 5 },
    { taskType: 'yarn/', pluginId: 'orion/npm-runner@v1', priority: 5 },
    { taskType: 'k8s/', pluginId: 'orion/k8s-deploy@v1', priority: 5 },
    { taskType: 'kubernetes/', pluginId: 'orion/k8s-deploy@v1', priority: 5 },
    { taskType: 'shell/', pluginId: 'orion/shell-exec@v1', priority: 5 },
    { taskType: 'script/', pluginId: 'orion/shell-exec@v1', priority: 5 },
  ]);
}
