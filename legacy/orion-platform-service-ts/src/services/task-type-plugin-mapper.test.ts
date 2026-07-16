import { describe, it, expect } from '@jest/globals';
import { TaskTypeToPluginMapper } from './task-type-plugin-mapper';

describe('TaskTypeToPluginMapper', () => {
  it('should match exact type first', () => {
    const mapper = new TaskTypeToPluginMapper();
    mapper.register({ taskType: 'git/checkout', pluginId: 'orion/git-clone@v1', priority: 10 });

    const result = mapper.map('git/checkout');
    expect(result).toBe('orion/git-clone@v1');
  });

  it('should match prefix when no exact match', () => {
    const mapper = new TaskTypeToPluginMapper();
    mapper.register({ taskType: 'npm/', pluginId: 'orion/npm-runner@v1', priority: 5 });

    const result = mapper.map('npm/build');
    expect(result).toBe('orion/npm-runner@v1');
  });

  it('should prefer exact match over prefix', () => {
    const mapper = new TaskTypeToPluginMapper();
    mapper.register({ taskType: 'git/', pluginId: 'orion/git-generic@v1', priority: 5 });
    mapper.register({ taskType: 'git/checkout', pluginId: 'orion/git-clone@v1', priority: 10 });

    const result = mapper.map('git/checkout');
    expect(result).toBe('orion/git-clone@v1');
  });

  it('should return undefined for unknown type', () => {
    const mapper = new TaskTypeToPluginMapper();
    const result = mapper.map('unknown/action');
    expect(result).toBeUndefined();
  });

  it('should return all mappings', () => {
    const mapper = new TaskTypeToPluginMapper();
    mapper.register({ taskType: 'git/', pluginId: 'orion/git-clone@v1', priority: 5 });
    mapper.register({ taskType: 'npm/', pluginId: 'orion/npm-runner@v1', priority: 5 });

    const mappings = mapper.list();
    expect(mappings).toHaveLength(2);
  });
});
