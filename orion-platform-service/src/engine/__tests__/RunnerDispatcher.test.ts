import { RunnerDispatcher, RunnerProtocol } from '../RunnerDispatcher';
import { RunnerProfile } from '../../models/RunnerProfile';
import { Task, TaskStatus } from '../../models/Task';

describe('RunnerDispatcher', () => {
  let dispatcher: RunnerDispatcher;

  beforeEach(() => {
    dispatcher = new RunnerDispatcher();
  });

  describe('protocol detection', () => {
    it('应该识别 k8s 为默认协议', () => {
      const profile = createRunnerProfile({ protocol: 'k8s' });
      expect(dispatcher.getProtocol(profile)).toBe('k8s');
    });

    it('应该识别 ssh 协议', () => {
      const profile = createRunnerProfile({ protocol: 'ssh' });
      expect(dispatcher.getProtocol(profile)).toBe('ssh');
    });

    it('应该识别 winrm 协议', () => {
      const profile = createRunnerProfile({ protocol: 'winrm' });
      expect(dispatcher.getProtocol(profile)).toBe('winrm');
    });
  });

  describe('canExecute', () => {
    it('k8s protocol 应该可以执行容器任务', () => {
      const profile = createRunnerProfile({ protocol: 'k8s', available: true });
      const task = createTask({ type: 'shell' });
      expect(dispatcher.canExecute(task, profile)).toBe(true);
    });

    it('ssh protocol 当前应该返回false（未实现）', () => {
      const profile = createRunnerProfile({ protocol: 'ssh', available: true });
      const task = createTask({ type: 'shell' });
      expect(dispatcher.canExecute(task, profile)).toBe(false);
    });

    it('不可用的Runner应该返回false', () => {
      const profile = createRunnerProfile({ protocol: 'k8s', available: false });
      const task = createTask({ type: 'shell' });
      expect(dispatcher.canExecute(task, profile)).toBe(false);
    });
  });

  describe('getSupportedProtocols', () => {
    it('应该返回已实现的协议列表', () => {
      const protocols = dispatcher.getSupportedProtocols();
      expect(protocols).toContain('k8s');
      expect(protocols).not.toContain('ssh');
      expect(protocols).not.toContain('winrm');
    });
  });
});

function createRunnerProfile(overrides: Partial<RunnerProfile> = {}): RunnerProfile {
  return {
    id: 'runner-1',
    name: 'test-runner',
    protocol: 'k8s',
    labels: ['linux', 'x64'],
    available: true,
    maxConcurrency: 4,
    metadata: {},
    ...overrides,
  };
}

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1', stageId: 'stage-1', name: 'test', type: 'shell',
    sequence: 1, status: TaskStatus.PENDING,
    config: {}, parameters: {}, retryCount: 0, maxRetries: 0,
    timeoutSeconds: 600, createdAt: new Date(), ...overrides,
  };
}
