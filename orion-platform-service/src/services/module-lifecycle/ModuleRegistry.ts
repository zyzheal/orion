import pino from 'pino';
import {
  ModuleDescriptor,
  ModuleState,
  DependencyValidationResult,
} from './types';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export { ModuleDescriptor, ModuleState, DependencyValidationResult } from './types';

export class ModuleRegistry {
  private modules: Map<string, ModuleDescriptor> = new Map();

  register(descriptor: ModuleDescriptor): void {
    if (this.modules.has(descriptor.id)) {
      throw new Error(`Module ${descriptor.id} is already registered`);
    }
    this.modules.set(descriptor.id, descriptor);
    logger.debug(`[ModuleRegistry] Registered module: ${descriptor.id}`);
  }

  get(id: string): ModuleDescriptor | undefined {
    return this.modules.get(id);
  }

  getAll(): ModuleDescriptor[] {
    return Array.from(this.modules.values());
  }

  setState(id: string, state: ModuleState): void {
    const mod = this.modules.get(id);
    if (!mod) {
      throw new Error(`Module ${id} not found`);
    }
    mod.state = state;
    logger.debug(`[ModuleRegistry] ${id} -> ${state}`);
  }

  setFailed(id: string, error: Error): void {
    const mod = this.modules.get(id);
    if (!mod) {
      throw new Error(`Module ${id} not found`);
    }
    mod.state = 'failed';
    mod.error = error.message;
    logger.error(`[ModuleRegistry] ${id} failed: ${error.message}`);
  }

  validateDependencies(): DependencyValidationResult {
    const missingDependencies: string[] = [];
    const circularDependencies: string[][] = [];

    for (const mod of this.modules.values()) {
      const deps = mod.config.dependencies || [];
      for (const dep of deps) {
        if (!this.modules.has(dep)) {
          missingDependencies.push(dep);
        }
      }
    }

    const visited = new Set<string>();
    const visiting = new Set<string>();

    const detectCycle = (id: string, path: string[]): void => {
      if (visiting.has(id)) {
        const cycleStart = path.indexOf(id);
        if (cycleStart !== -1) {
          circularDependencies.push([...path.slice(cycleStart), id]);
        }
        return;
      }
      if (visited.has(id)) return;

      visiting.add(id);
      const mod = this.modules.get(id);
      if (mod?.config.dependencies) {
        for (const dep of mod.config.dependencies) {
          detectCycle(dep, [...path, id]);
        }
      }
      visiting.delete(id);
      visited.add(id);
    };

    for (const mod of this.modules.values()) {
      detectCycle(mod.id, []);
    }

    return {
      valid: missingDependencies.length === 0 && circularDependencies.length === 0,
      missingDependencies,
      circularDependencies: circularDependencies.length > 0 ? circularDependencies : undefined,
    };
  }

  getStartupOrder(): string[] {
    const result: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (id: string): void => {
      if (visiting.has(id)) return;
      if (visited.has(id)) return;

      visiting.add(id);
      const mod = this.modules.get(id);
      if (mod?.config.dependencies) {
        for (const dep of mod.config.dependencies) {
          visit(dep);
        }
      }
      visiting.delete(id);
      visited.add(id);
      result.push(id);
    };

    const sorted = this.getAll().sort((a, b) =>
      (a.config.priority ?? 100) - (b.config.priority ?? 100)
    );

    for (const mod of sorted) {
      visit(mod.id);
    }

    return result;
  }

  listByLevel(level: ModuleDescriptor['level']): ModuleDescriptor[] {
    return this.getAll().filter(m => m.level === level);
  }

  getActiveModules(): ModuleDescriptor[] {
    return this.getAll().filter(m => m.state === 'active');
  }

  getEnabledModules(): ModuleDescriptor[] {
    return this.getAll().filter(m => m.config.enabled);
  }

  get size(): number {
    return this.modules.size;
  }
}
