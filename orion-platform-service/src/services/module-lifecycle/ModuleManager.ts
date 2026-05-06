import pino from 'pino';
import { ModuleRegistry } from './ModuleRegistry';
import {
  ModuleDescriptor,
  ModuleLevel,
  ModuleConfig,
  ModuleLifecycle,
  ModuleRegistration,
  ModuleManagerConfig,
} from './types';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export { ModuleLifecycle } from './types';
export { ModuleDescriptor } from './types';

export class ModuleManager {
  private registry: ModuleRegistry;
  private registrations: Map<string, ModuleRegistration> = new Map();
  private configGetter: () => ModuleManagerConfig;

  constructor(configGetter: () => ModuleManagerConfig) {
    this.registry = new ModuleRegistry();
    this.configGetter = configGetter;
  }

  loadFromConfig(): void {
    const config = this.configGetter();

    if (config.core) {
      for (const [id, cfg] of Object.entries(config.core)) {
        this.registerModule({
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
      for (const [domainId, domainConfig] of Object.entries(config.domains)) {
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
        this.registry.register(domainModule);

        if (domainConfig.services) {
          for (const [serviceId, serviceConfig] of Object.entries(domainConfig.services)) {
            this.registerModule({
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
      for (const [serviceId, serviceConfig] of Object.entries(config.services)) {
        this.registerModule({
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
        this.registerModule({
          id: `feature:${featureId}`,
          name: featureId,
          description: `Feature: ${featureId}`,
          level: 'feature',
          state: 'registered',
          config: { enabled: featureConfig.enabled ?? true, priority: 80 },
        });
      }
    }

    logger.info(`[ModuleManager] Loaded ${this.registry.size} modules from configuration`);
  }

  registerModule(descriptor: ModuleDescriptor, lifecycle?: ModuleLifecycle, routeRegistrar?: ModuleRegistration['routeRegistrar']): void {
    const existing = this.registry.get(descriptor.id);
    if (existing) {
      this.registrations.set(descriptor.id, { descriptor, lifecycle, routeRegistrar });
      return;
    }

    this.registry.register(descriptor);
    this.registrations.set(descriptor.id, { descriptor, lifecycle, routeRegistrar });
  }

  async startAll(): Promise<void> {
    const validation = this.registry.validateDependencies();
    if (!validation.valid) {
      const issues = [
        ...validation.missingDependencies.map(d => `Missing dependency: ${d}`),
        ...(validation.circularDependencies || []).map(c => `Circular dependency: ${c.join(' -> ')}`),
      ];
      logger.warn(`[ModuleManager] Dependency issues: ${issues.join(', ')}`);
    }

    const startupOrder = this.registry.getStartupOrder();

    for (const moduleId of startupOrder) {
      const mod = this.registry.get(moduleId);
      if (!mod || !mod.config.enabled) {
        continue;
      }
      try {
        await this.startModule(moduleId);
      } catch (error: any) {
        logger.error(`[ModuleManager] Failed to start ${moduleId}: ${error.message}`);
        this.registry.setFailed(moduleId, error);
      }
    }

    const active = this.registry.getActiveModules();
    logger.info(`[ModuleManager] Started ${active.length}/${this.registry.size} modules`);
  }

  async startModule(id: string): Promise<void> {
    const mod = this.registry.get(id);
    if (!mod) {
      throw new Error(`Module ${id} not found`);
    }

    if (!mod.config.enabled) {
      logger.debug(`[ModuleManager] ${id} is disabled, skipping`);
      return;
    }

    const deps = mod.config.dependencies || [];
    for (const dep of deps) {
      const depMod = this.registry.get(dep);
      if (!depMod || depMod.state !== 'active') {
        throw new Error(`Dependency ${dep} is not active for module ${id}`);
      }
    }

    this.registry.setState(id, 'starting');

    const registration = this.registrations.get(id);
    if (registration?.lifecycle) {
      await registration.lifecycle.initialize?.();
      await registration.lifecycle.start?.();
    }

    this.registry.setState(id, 'active');
    logger.info(`[ModuleManager] Module ${id} started`);
  }

  async stopModule(id: string): Promise<void> {
    const mod = this.registry.get(id);
    if (!mod) {
      throw new Error(`Module ${id} not found`);
    }

    const dependents = this.registry.getAll().filter(m =>
      m.state === 'active' &&
      m.config.dependencies?.includes(id)
    );
    if (dependents.length > 0) {
      throw new Error(`Cannot stop ${id}: ${dependents.map(d => d.id).join(', ')} depend on it`);
    }

    this.registry.setState(id, 'stopping');

    const registration = this.registrations.get(id);
    if (registration?.lifecycle) {
      await registration.lifecycle.stop?.();
    }

    this.registry.setState(id, 'stopped');
    logger.info(`[ModuleManager] Module ${id} stopped`);
  }

  isModuleEnabled(id: string): boolean {
    const mod = this.registry.get(id);
    return mod?.config.enabled ?? false;
  }

  getModuleStatus(): { modules: ModuleDescriptor[]; total: number; active: number; failed: number } {
    const modules = this.registry.getAll();
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
}
