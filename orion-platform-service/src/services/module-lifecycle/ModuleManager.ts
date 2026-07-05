import { createLogger } from '../../utils/logger';
import { ModuleRegistry } from './ModuleRegistry';
import {
  ModuleDescriptor,
  ModuleLevel,
  ModuleConfig,
  ModuleLifecycle,
  ModuleRegistration,
  ModuleManagerConfig,
  DomainConfig,
} from './types';
import { OrionError, ErrorCode } from '../../errors';

const logger = createLogger('ModuleManager');

export { ModuleLifecycle } from './types';
export { ModuleDescriptor } from './types';

export class ModuleManager {
  private registry: ModuleRegistry;
  private registrations: Map<string, ModuleRegistration> = new Map();
  private configGetter: () => ModuleManagerConfig;

  constructor(configGetter: () => ModuleManagerConfig, db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.registry = new ModuleRegistry(db);
    this.configGetter = configGetter;
  }

  async loadFromConfig(): Promise<void> {
    const config = this.configGetter();

    if (config.core) {
      for (const [id, cfg] of Object.entries(config.core)) {
        await this.registerModule({
          id: `core:${id}`,
          name: id,
          description: `Core module: ${id}`,
          level: 'core',
          state: 'registered',
          config: { enabled: true, autoStart: true, priority: 1 },
        });
      }
    }

    if (config.domains) {
      for (const [domainId, rawDomainConfig] of Object.entries(config.domains)) {
        const domainConfig = rawDomainConfig as DomainConfig;
        const domainModule: ModuleDescriptor = {
          id: `domain:${domainId}`,
          name: domainId,
          description: `Domain: ${domainId}`,
          level: 'domain',
          state: 'registered',
          config: {
            enabled: domainConfig.enabled ?? true,
            autoStart: domainConfig.autoStart ?? true,
            priority: 50,
          },
        };
        await this.registry.register(domainModule);

        if (domainConfig.services) {
          for (const [serviceId, serviceConfig] of Object.entries(domainConfig.services)) {
            const existing = await this.registry.get(`service:${serviceId}`);
            if (existing) {
              logger.warn(`[ModuleManager] Service ${serviceId} already registered (possibly from another domain), skipping duplicate`);
              continue;
            }
            await this.registerModule({
              id: `service:${serviceId}`,
              name: serviceId,
              description: `Service: ${serviceId} (domain: ${domainId})`,
              level: 'service',
              domain: domainId,
              state: 'registered',
              config: {
                ...serviceConfig,
                dependencies: [
                  ...(serviceConfig.dependencies || []),
                  `domain:${domainId}`,
                ],
                priority: 60,
              },
            });
          }
        }
      }
    }

    if (config.services) {
      for (const [serviceId, rawServiceConfig] of Object.entries(config.services)) {
        const existing = await this.registry.get(`service:${serviceId}`);
        if (existing) {
          logger.warn(`[ModuleManager] Service ${serviceId} already registered (possibly from another domain), skipping duplicate`);
          continue;
        }
        const serviceConfig = rawServiceConfig as ModuleConfig;
        await this.registerModule({
          id: `service:${serviceId}`,
          name: serviceId,
          description: `Service: ${serviceId}`,
          level: 'service',
          state: 'registered',
          config: { ...serviceConfig, priority: 70 },
        });
      }
    }

    if (config.features) {
      for (const [featureId, featureConfig] of Object.entries(config.features)) {
        await this.registerModule({
          id: `feature:${featureId}`,
          name: featureId,
          description: `Feature: ${featureId}`,
          level: 'feature',
          state: 'registered',
          config: { enabled: featureConfig.enabled ?? true, priority: 80 },
        });
      }
    }

    const size = await this.registry.getSize();
    logger.info(`[ModuleManager] Loaded ${size} modules from configuration`);
  }

  async registerModule(descriptor: ModuleDescriptor, lifecycle?: ModuleLifecycle, routeRegistrar?: ModuleRegistration['routeRegistrar']): Promise<void> {
    const existing = await this.registry.get(descriptor.id);
    if (existing) {
      this.registrations.set(descriptor.id, { descriptor, lifecycle, routeRegistrar });
      return;
    }

    await this.registry.register(descriptor);
    this.registrations.set(descriptor.id, { descriptor, lifecycle, routeRegistrar });
  }

  async startAll(): Promise<void> {
    const validation = await this.registry.validateDependencies();
    if (!validation.valid) {
      const issues = [
        ...validation.missingDependencies.map(d => `Missing dependency: ${d}`),
        ...(validation.circularDependencies || []).map(c => `Circular dependency: ${c.join(' -> ')}`),
      ];
      logger.warn(`[ModuleManager] Dependency issues: ${issues.join(', ')}`);
    }

    const startupOrder = await this.registry.getStartupOrder();

    for (const moduleId of startupOrder) {
      const mod = await this.registry.get(moduleId);
      if (!mod || !mod.config.enabled) {
        continue;
      }
      try {
        await this.startModule(moduleId);
      } catch (error: any) {
        logger.error(`[ModuleManager] Failed to start ${moduleId}: ${error.message}`);
        await this.registry.setFailed(moduleId, error);
      }
    }

    const active = await this.registry.getActiveModules();
    const size = await this.registry.getSize();
    logger.info(`[ModuleManager] Started ${active.length}/${size} modules`);
  }

  async startModule(id: string): Promise<void> {
    const mod = await this.registry.get(id);
    if (!mod) {
      throw new OrionError(`Module ${id} not found`, ErrorCode.NOT_FOUND);
    }

    if (!mod.config.enabled) {
      logger.debug(`[ModuleManager] ${id} is disabled, skipping`);
      return;
    }

    const deps = mod.config.dependencies || [];
    for (const dep of deps) {
      const depMod = await this.registry.get(dep);
      if (!depMod) {
        throw new OrionError(`Dependency ${dep} not found for module ${id}`, ErrorCode.NOT_FOUND);
      }
      // Skip disabled dependencies
      if (!depMod.config.enabled) {
        logger.warn(`[ModuleManager] Dependency ${dep} is disabled, skipping check for ${id}`);
        continue;
      }
      if (depMod.state !== 'active') {
        throw new OrionError(`Dependency ${dep} is not active for module ${id}`, ErrorCode.NOT_FOUND);
      }
    }

    await this.registry.setState(id, 'starting');

    const registration = this.registrations.get(id);
    if (registration?.lifecycle) {
      await registration.lifecycle.initialize?.();
      await registration.lifecycle.start?.();
    }

    await this.registry.setState(id, 'active');
    logger.info(`[ModuleManager] Module ${id} started`);
  }

  async stopModule(id: string): Promise<void> {
    const mod = await this.registry.get(id);
    if (!mod) {
      throw new OrionError(`Module ${id} not found`, ErrorCode.NOT_FOUND);
    }

    const allModules = await this.registry.getAll();
    const dependents = allModules.filter(m =>
      m.state === 'active' &&
      m.config.dependencies?.includes(id)
    );
    if (dependents.length > 0) {
      throw new OrionError(`Cannot stop ${id}: ${dependents.map(d => d.id).join(', ')} depend on it`, ErrorCode.NOT_FOUND);
    }

    await this.registry.setState(id, 'stopping');

    const registration = this.registrations.get(id);
    if (registration?.lifecycle) {
      await registration.lifecycle.stop?.();
    }

    await this.registry.setState(id, 'stopped');
    logger.info(`[ModuleManager] Module ${id} stopped`);
  }

  async isModuleEnabled(id: string): Promise<boolean> {
    const mod = await this.registry.get(id);
    return mod?.config.enabled ?? false;
  }

  async getModuleStatus(): Promise<{ modules: ModuleDescriptor[]; total: number; active: number; failed: number }> {
    const modules = await this.registry.getAll();
    return {
      modules,
      total: modules.length,
      active: modules.filter(m => m.state === 'active').length,
      failed: modules.filter(m => m.state === 'failed').length,
    };
  }

  getRegistry(): ModuleRegistry {
    return this.registry;
  }

  async toggleModule(id: string, enabled: boolean): Promise<void> {
    const mod = await this.registry.get(id);
    if (!mod) {
      throw new OrionError(`Module ${id} not found`, ErrorCode.NOT_FOUND);
    }
    if (mod.level === 'core' && !enabled) {
      throw new OrionError(`Core module ${id} cannot be disabled`, 'VALIDATION_ERROR')
    }
    mod.config.enabled = enabled;
    if (enabled && mod.state !== 'active') {
      await this.startModule(id);
    } else if (!enabled && mod.state === 'active') {
      await this.stopModule(id);
    }
  }
}
