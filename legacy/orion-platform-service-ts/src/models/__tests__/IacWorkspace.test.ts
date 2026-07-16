/**
 * IacWorkspace 模型测试
 */
import {
  createIaCWorkspace,
  createIaCPlan,
  createIaCStateVersion,
  createIaCModule,
} from '../IacWorkspace';

describe('IacWorkspace', () => {
  describe('createIaCWorkspace', () => {
    it('should create workspace with defaults', () => {
      const ws = createIaCWorkspace({
        name: 'dev-workspace',
        projectId: 'proj-1',
        environment: 'dev',
      });

      expect(ws.id).toBeDefined();
      expect(ws.name).toBe('dev-workspace');
      expect(ws.projectId).toBe('proj-1');
      expect(ws.environment).toBe('dev');
      expect(ws.statePath).toBe('');
      expect(ws.variables).toEqual({});
      expect(ws.lockedBy).toBeNull();
      expect(ws.status).toBe('active');
      expect(ws.provider).toBe('terraform');
      expect(ws.createdAt).toBeInstanceOf(Date);
    });

    it('should accept custom values', () => {
      const ws = createIaCWorkspace({
        name: 'prod',
        projectId: 'p1',
        environment: 'prod',
        statePath: 's3://state/prod',
        variables: { region: 'us-east-1' },
        provider: 'pulumi',
      });

      expect(ws.statePath).toBe('s3://state/prod');
      expect(ws.variables).toEqual({ region: 'us-east-1' });
      expect(ws.provider).toBe('pulumi');
    });
  });

  describe('createIaCPlan', () => {
    it('should create plan with defaults', () => {
      const plan = createIaCPlan({
        workspaceId: 'ws-1',
        commitSha: 'abc123',
      });

      expect(plan.id).toBeDefined();
      expect(plan.workspaceId).toBe('ws-1');
      expect(plan.commitSha).toBe('abc123');
      expect(plan.status).toBe('pending');
      expect(plan.resourceChanges).toEqual({});
      expect(plan.costEstimate).toEqual({});
      expect(plan.aiReview).toEqual({});
      expect(plan.createdAt).toBeInstanceOf(Date);
      expect(plan.expiresAt).toBeInstanceOf(Date);
    });

    it('should set expiresAt to 7 days after creation', () => {
      const plan = createIaCPlan({
        workspaceId: 'ws-1',
        commitSha: 'abc',
      });
      const diff = plan.expiresAt.getTime() - plan.createdAt.getTime();
      expect(diff).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });

  describe('createIaCStateVersion', () => {
    it('should create state version', () => {
      const sv = createIaCStateVersion({
        workspaceId: 'ws-1',
        version: 3,
        commitSha: 'abc',
        author: 'admin',
        size: 4096,
      });

      expect(sv.id).toBeDefined();
      expect(sv.workspaceId).toBe('ws-1');
      expect(sv.version).toBe(3);
      expect(sv.commitSha).toBe('abc');
      expect(sv.author).toBe('admin');
      expect(sv.size).toBe(4096);
      expect(sv.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('createIaCModule', () => {
    it('should create module with defaults', () => {
      const mod = createIaCModule({
        name: 'vpc-module',
        version: '1.0.0',
        source: 'terraform-aws-modules/vpc/aws',
      });

      expect(mod.id).toBeDefined();
      expect(mod.name).toBe('vpc-module');
      expect(mod.version).toBe('1.0.0');
      expect(mod.source).toBe('terraform-aws-modules/vpc/aws');
      expect(mod.dependencies).toEqual({});
      expect(mod.createdAt).toBeInstanceOf(Date);
    });

    it('should accept custom dependencies', () => {
      const mod = createIaCModule({
        name: 'm1',
        version: '1.0',
        source: 'src',
        dependencies: { module2: '2.0' },
      });

      expect(mod.dependencies).toEqual({ module2: '2.0' });
    });
  });
});
