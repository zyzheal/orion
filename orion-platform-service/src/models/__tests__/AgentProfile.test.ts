/**
 * AgentProfile 模型测试
 */
import {
  createAgentProfile,
  updateAgentProfile,
  AgentRole,
  AgentProfile,
} from '../AgentProfile';

describe('AgentProfile', () => {
  describe('createAgentProfile', () => {
    it('should create profile with required fields only', () => {
      const profile = createAgentProfile({
        name: 'test-agent',
        role: 'bug_fixer',
      });

      expect(profile.id).toBeDefined();
      expect(profile.name).toBe('test-agent');
      expect(profile.role).toBe('bug_fixer');
      expect(profile.description).toBe('');
      expect(profile.enabled).toBe(true);
      expect(profile.createdAt).toBeInstanceOf(Date);
      expect(profile.updatedAt).toBeInstanceOf(Date);
    });

    it('should apply default capabilities', () => {
      const profile = createAgentProfile({
        name: 'agent',
        role: 'code_fixer',
      });

      expect(profile.capabilities.maxSteps).toBe(20);
      expect(profile.capabilities.timeoutSec).toBe(3600);
      expect(profile.capabilities.retryCount).toBe(3);
    });

    it('should apply default constraints', () => {
      const profile = createAgentProfile({
        name: 'agent',
        role: 'test_writer',
      });

      expect(profile.constraints.maxTokens).toBe(8192);
      expect(profile.constraints.allowedBranches).toEqual(['main', 'develop']);
      expect(profile.constraints.forbiddenOperations).toContain('deploy_to_production');
    });

    it('should apply default LLM config', () => {
      const profile = createAgentProfile({
        name: 'agent',
        role: 'pr_submitter',
      });

      expect(profile.llmConfig.model).toBe('gpt-4o-mini');
      expect(profile.llmConfig.temperature).toBe(0.2);
      expect(profile.llmConfig.maxTokens).toBe(4096);
    });

    it('should apply default tools when none provided', () => {
      const profile = createAgentProfile({
        name: 'agent',
        role: 'security_patcher',
      });

      expect(profile.tools).toHaveLength(2);
      expect(profile.tools[0].toolName).toBe('read_file');
      expect(profile.tools[0].permission).toBe('read');
      expect(profile.tools[1].toolName).toBe('run_command');
      expect(profile.tools[1].permission).toBe('execute');
    });

    it('should override defaults with partial capabilities', () => {
      const profile = createAgentProfile({
        name: 'agent',
        role: 'doc_writer',
        capabilities: { maxSteps: 50 },
      });

      expect(profile.capabilities.maxSteps).toBe(50);
      expect(profile.capabilities.timeoutSec).toBe(3600);
    });

    it('should accept custom tools', () => {
      const profile = createAgentProfile({
        name: 'agent',
        role: 'bug_fixer',
        tools: [{ toolName: 'custom_tool', permission: 'write' }],
      });

      expect(profile.tools).toHaveLength(1);
      expect(profile.tools[0].toolName).toBe('custom_tool');
    });

    it('should accept custom description', () => {
      const profile = createAgentProfile({
        name: 'agent',
        role: 'bug_fixer',
        description: 'A helpful agent',
      });

      expect(profile.description).toBe('A helpful agent');
    });
  });

  describe('updateAgentProfile', () => {
    let profile: AgentProfile;

    beforeEach(() => {
      profile = createAgentProfile({
        name: 'agent',
        role: 'bug_fixer',
        description: 'original',
      });
    });

    it('should update description', () => {
      const updated = updateAgentProfile(profile, { description: 'updated' });
      expect(updated.description).toBe('updated');
    });

    it('should update enabled status', () => {
      const updated = updateAgentProfile(profile, { enabled: false });
      expect(updated.enabled).toBe(false);
    });

    it('should update tools', () => {
      const newTools = [{ toolName: 'new_tool', permission: 'read' as const }];
      const updated = updateAgentProfile(profile, { tools: newTools });
      expect(updated.tools).toEqual(newTools);
    });

    it('should merge capabilities partially', () => {
      const updated = updateAgentProfile(profile, {
        capabilities: { maxSteps: 100 },
      });
      expect(updated.capabilities.maxSteps).toBe(100);
      expect(updated.capabilities.timeoutSec).toBe(3600);
    });

    it('should merge constraints partially', () => {
      const updated = updateAgentProfile(profile, {
        constraints: { maxTokens: 16384 },
      });
      expect(updated.constraints.maxTokens).toBe(16384);
      expect(updated.constraints.allowedBranches).toEqual(['main', 'develop']);
    });

    it('should merge llmConfig partially', () => {
      const updated = updateAgentProfile(profile, {
        llmConfig: { temperature: 0.5 },
      });
      expect(updated.llmConfig.temperature).toBe(0.5);
      expect(updated.llmConfig.model).toBe('gpt-4o-mini');
    });

    it('should preserve fields not in update', () => {
      const updated = updateAgentProfile(profile, { description: 'new' });
      expect(updated.name).toBe('agent');
      expect(updated.role).toBe('bug_fixer');
      expect(updated.id).toBe(profile.id);
    });

    it('should update the updatedAt timestamp', () => {
      const updated = updateAgentProfile(profile, { description: 'new' });
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(profile.updatedAt.getTime());
    });
  });
});
