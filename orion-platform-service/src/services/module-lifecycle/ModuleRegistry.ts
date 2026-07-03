import { createLogger } from '../utils/logger';
import {
  ModuleDescriptor,
  ModuleState,
  DependencyValidationResult,
} from './types';
import { OrionError, ErrorCode } from '../../errors';
import { ModuleRegistryRepository } from '../../repositories/ModuleRegistryRepository';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export { ModuleDescriptor, ModuleState, DependencyValidationResult } from './types';

export class ModuleRegistry {
  private repo: ModuleRegistryRepository;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      this.repo = new ModuleRegistryRepository(db);
    } else {
      throw new OrionError('Database connection required for ModuleRegistry', ErrorCode.SERVICE_UNAVAILABLE);
    }
  }

  async register(descriptor: ModuleDescriptor): Promise<void> {
    const existing = await this.repo.findById(descriptor.id);
    if (existing) {
      throw new OrionError(`Module ${descriptor.id} is already registered`, ErrorCode.NOT_FOUND);
    }
    await this.repo.upsertModule(descriptor.id, {
      name: descriptor.name,
      description: descriptor.description,
      level: descriptor.level,
      domain: descriptor.domain,
      state: descriptor.state,
      enabled: descriptor.config.enabled,
      autoStart: descriptor.config.autoStart,
      dependencies: descriptor.config.dependencies,
      priority: descriptor.config.priority,
      routePrefix: descriptor.routePrefix,
    });
    logger.debug(`[ModuleRegistry] Registered module: ${descriptor.id}`);
  }

  async get(id: string): Promise<ModuleDescriptor | undefined> {
    const entity = await this.repo.findById(id);
    if (!entity) return undefined;
    return this.entityToDescriptor(entity);
  }

  async getAll(): Promise<ModuleDescriptor[]> {
    const entities = await this.repo.findAllModules();
    return entities.map(e => this.entityToDescriptor(e));
  }

  async setState(id: string, state: ModuleState): Promise<void> {
    const entity = await this.repo.findById(id);
    if (!entity) {
      throw new OrionError(`Module ${id} not found`, ErrorCode.NOT_FOUND);
    }
    await this.repo.updateState(id, state);
    logger.debug(`[ModuleRegistry] ${id} -> ${state}`);
  }

  async setFailed(id: string, error: Error): Promise<void> {
    const entity = await this.repo.findById(id);
    if (!entity) {
      throw new OrionError(`Module ${id} not found`, ErrorCode.NOT_FOUND);
    }
    await this.repo.updateState(id, 'failed', error.message);
    logger.error(`[ModuleRegistry] ${id} failed: ${error.message}`);
  }

  async validateDependencies(): Promise<DependencyValidationResult> {
    const missingDependencies: string[] = [];
    const circularDependencies: string[][] = [];

    const allModules = await this.getAll();

    for (const mod of allModules) {
      const deps = mod.config.dependencies || [];
      for (const dep of deps) {
        const depExists = await this.repo.findById(dep);
        if (!depExists) {
          missingDependencies.push(dep);
        }
      }
    }

    const visited = new Set<string>();
    const visiting = new Set<string>();

    const detectCycle = async (id: string, path: string[]): Promise<void> => {
      if (visiting.has(id)) {
        const cycleStart = path.indexOf(id);
        if (cycleStart !== -1) {
          circularDependencies.push([...path.slice(cycleStart), id]);
        }
        return;
      }
      if (visited.has(id)) return;

      visiting.add(id);
      const mod = await this.get(id);
      if (mod?.config.dependencies) {
        for (const dep of mod.config.dependencies) {
          await detectCycle(dep, [...path, id]);
        }
      }
      visiting.delete(id);
      visited.add(id);
    };

    for (const mod of allModules) {
      await detectCycle(mod.id, []);
    }

    return {
      valid: missingDependencies.length === 0 && circularDependencies.length === 0,
      missingDependencies,
      circularDependencies: circularDependencies.length > 0 ? circularDependencies : undefined,
    };
  }

  async getStartupOrder(): Promise<string[]> {
    const result: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = async (id: string): Promise<void> => {
      if (visiting.has(id)) {
        logger.warn(`[ModuleRegistry] Circular dependency detected involving ${id} — skipping`);
        return;
      }
      if (visited.has(id)) return;

      visiting.add(id);
      const mod = await this.get(id);
      if (mod?.config.dependencies) {
        for (const dep of mod.config.dependencies) {
          await visit(dep);
        }
      }
      visiting.delete(id);
      visited.add(id);
      result.push(id);
    };

    const allModules = await this.getAll();
    const sorted = allModules.sort((a, b) =>
      (a.config.priority ?? 100) - (b.config.priority ?? 100)
    );

    for (const mod of sorted) {
      await visit(mod.id);
    }

    return result;
  }

  async listByLevel(level: ModuleDescriptor['level']): Promise<ModuleDescriptor[]> {
    const all = await this.getAll();
    return all.filter(m => m.level === level);
  }

  async getActiveModules(): Promise<ModuleDescriptor[]> {
    const all = await this.getAll();
    return all.filter(m => m.state === 'active');
  }

  async getEnabledModules(): Promise<ModuleDescriptor[]> {
    const all = await this.getAll();
    return all.filter(m => m.config.enabled);
  }

  async getSize(): Promise<number> {
    const entities = await this.repo.findAllModules();
    return entities.length;
  }

  private entityToDescriptor(entity: import('../../repositories/ModuleRegistryRepository').ModuleRegistryEntity): ModuleDescriptor {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description || '',
      level: entity.level as ModuleDescriptor['level'],
      domain: entity.domain || undefined,
      state: entity.state as ModuleState,
      config: {
        enabled: entity.enabled,
        autoStart: entity.autoStart,
        dependencies: entity.dependencies,
        priority: entity.priority,
      },
      routePrefix: entity.routePrefix || undefined,
      error: entity.error || undefined,
    };
  }
}
