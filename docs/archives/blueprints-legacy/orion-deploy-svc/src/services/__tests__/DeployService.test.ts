import { DeployService } from '../DeployService';
import { K8sClientService } from '../K8sClientService';
import { DeploymentStatus, DeploymentStrategy } from '../../types/deploy';

jest.mock('../K8sClientService');

const mockK8sClient = K8sClientService as jest.MockedClass<typeof K8sClientService>;

describe('DeployService', () => {
  let service: DeployService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockK8sClient.prototype.apply = jest.fn();
    mockK8sClient.prototype.rolloutStatus = jest.fn();
    mockK8sClient.prototype.rolloutUndo = jest.fn();
    mockK8sClient.prototype.getDeployments = jest.fn();
    mockK8sClient.prototype.getDeployment = jest.fn();
    service = new DeployService();
  });

  describe('createDeployment', () => {
    it('creates a deployment with pending then deploying status', async () => {
      const result = await service.createDeployment('tenant-1', 'user-1', {
        projectId: 'proj-1',
        environmentId: 'env-1',
        imageTag: 'myapp:v1',
      });

      expect(result.id).toMatch(/^deploy-/);
      expect(result.tenantId).toBe('tenant-1');
      expect(result.status).toBe(DeploymentStatus.DEPLOYING);
      expect(result.strategy).toBe(DeploymentStrategy.ROLLING);
    });

    it('uses provided strategy', async () => {
      const result = await service.createDeployment('tenant-1', 'user-1', {
        projectId: 'proj-1',
        environmentId: 'env-1',
        imageTag: 'myapp:v1',
        strategy: DeploymentStrategy.CANARY,
      });

      expect(result.strategy).toBe(DeploymentStrategy.CANARY);
    });
  });

  describe('listDeployments', () => {
    it('returns paginated filtered results', async () => {
      await service.createDeployment('tenant-1', 'user-1', {
        projectId: 'proj-1',
        environmentId: 'env-1',
        imageTag: 'myapp:v1',
      });

      const { data, total } = await service.listDeployments({
        tenantId: 'tenant-1',
        limit: 10,
        offset: 0,
      });

      expect(total).toBe(1);
      expect(data).toHaveLength(1);
      expect(data[0].tenantId).toBe('tenant-1');
    });
  });

  describe('getDeployment', () => {
    it('returns null for unknown id', async () => {
      const result = await service.getDeployment('nonexistent');
      expect(result).toBeNull();
    });

    it('returns deployment for known id', async () => {
      const created = await service.createDeployment('tenant-1', 'user-1', {
        projectId: 'proj-1',
        environmentId: 'env-1',
        imageTag: 'myapp:v1',
      });

      const result = await service.getDeployment(created.id);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(created.id);
    });
  });

  describe('rollbackDeployment', () => {
    it('throws if deployment not found', async () => {
      await expect(service.rollbackDeployment('nonexistent', 'reason', undefined, 'user-1'))
        .rejects.toThrow('Deployment nonexistent not found');
    });

    it('creates a rollback deployment and marks original as failed', async () => {
      const original = await service.createDeployment('tenant-1', 'user-1', {
        projectId: 'proj-1',
        environmentId: 'env-1',
        imageTag: 'myapp:v1',
      });

      const rollback = await service.rollbackDeployment(
        original.id,
        'bad release',
        undefined,
        'user-1',
      );

      expect(rollback.id).toMatch(/^deploy-rollback-/);
      expect(rollback.metadata?.reason).toBe('bad release');

      // Original should be marked as failed
      const fetched = await service.getDeployment(original.id);
      expect(fetched?.status).toBe(DeploymentStatus.FAILED);
    });
  });

  describe('updateDeploymentStatus', () => {
    it('throws if deployment not found', async () => {
      await expect(service.updateDeploymentStatus('nonexistent', DeploymentStatus.DEPLOYED))
        .rejects.toThrow('Deployment nonexistent not found');
    });

    it('rejects invalid state transitions', async () => {
      const created = await service.createDeployment('tenant-1', 'user-1', {
        projectId: 'proj-1',
        environmentId: 'env-1',
        imageTag: 'myapp:v1',
      });

      // DEPLOYING -> PENDING is not valid
      await expect(service.updateDeploymentStatus(created.id, DeploymentStatus.PENDING))
        .rejects.toThrow('Invalid state transition');
    });

    it('allows valid transitions and sets completedAt for terminal states', async () => {
      const created = await service.createDeployment('tenant-1', 'user-1', {
        projectId: 'proj-1',
        environmentId: 'env-1',
        imageTag: 'myapp:v1',
      });

      await service.updateDeploymentStatus(created.id, DeploymentStatus.DEPLOYED);
      const updated = await service.getDeployment(created.id);

      expect(updated?.status).toBe(DeploymentStatus.DEPLOYED);
      expect(updated?.completedAt).not.toBeNull();
    });
  });

  describe('deploy (K8s)', () => {
    const sampleManifest = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: production
spec:
  replicas: 2
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
        - name: my-app
          image: myapp:v1
`;

    it('applies manifest and tracks rollout', async () => {
      (mockK8sClient.prototype.apply as jest.Mock).mockResolvedValue({
        success: true,
        output: 'deployment.apps/my-app configured',
      });
      (mockK8sClient.prototype.rolloutStatus as jest.Mock).mockResolvedValue(true);

      const result = await service.deploy(sampleManifest, 'production');

      expect(mockK8sClient.prototype.apply).toHaveBeenCalledWith(sampleManifest);
      expect(mockK8sClient.prototype.rolloutStatus).toHaveBeenCalledWith('my-app', 'production');
      expect(result.success).toBe(true);
      expect(result.output).toContain('Rollout completed successfully');
    });

    it('returns failure when apply fails', async () => {
      (mockK8sClient.prototype.apply as jest.Mock).mockResolvedValue({
        success: false,
        output: 'kubectl failed: unauthorized',
      });

      const result = await service.deploy(sampleManifest);

      expect(result.success).toBe(false);
      expect(result.output).toContain('unauthorized');
    });

    it('succeeds without rollout tracking if manifest lacks Deployment kind', async () => {
      const configMap = `
apiVersion: v1
kind: ConfigMap
metadata:
  name: my-config
data:
  key: value
`;
      (mockK8sClient.prototype.apply as jest.Mock).mockResolvedValue({
        success: true,
        output: 'configmap/my-config configured',
      });

      const result = await service.deploy(configMap);

      expect(result.success).toBe(true);
      expect(result.output).toBe('configmap/my-config configured');
      expect(mockK8sClient.prototype.rolloutStatus).not.toHaveBeenCalled();
    });
  });

  describe('rollback (K8s)', () => {
    it('succeeds when kubectl rollout undo succeeds', async () => {
      (mockK8sClient.prototype.rolloutUndo as jest.Mock).mockResolvedValue(undefined);

      const result = await service.rollback('my-app', 'production');

      expect(result.success).toBe(true);
      expect(mockK8sClient.prototype.rolloutUndo).toHaveBeenCalledWith('my-app', 'production');
    });

    it('returns error when kubectl fails', async () => {
      (mockK8sClient.prototype.rolloutUndo as jest.Mock).mockRejectedValue(
        new Error('deployment.apps/my-app not found'),
      );

      const result = await service.rollback('my-app', 'production');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('getStatus (K8s)', () => {
    it('returns list of deployments from K8s', async () => {
      const fakeDeployments = [
        { metadata: { name: 'app-1' }, status: { readyReplicas: 2 } },
        { metadata: { name: 'app-2' }, status: { readyReplicas: 0 } },
      ];
      (mockK8sClient.prototype.getDeployments as jest.Mock).mockResolvedValue(fakeDeployments);

      const result = await service.getStatus('production');

      expect(result).toEqual(fakeDeployments);
      expect(mockK8sClient.prototype.getDeployments).toHaveBeenCalledWith('production');
    });
  });

  describe('getK8sDeployment', () => {
    it('returns null when deployment not found in K8s', async () => {
      (mockK8sClient.prototype.getDeployment as jest.Mock).mockResolvedValue(null);

      const result = await service.getK8sDeployment('missing', 'production');

      expect(result).toBeNull();
    });

    it('returns deployment when found', async () => {
      const fakeDeployment = { metadata: { name: 'my-app' }, status: { readyReplicas: 2 } };
      (mockK8sClient.prototype.getDeployment as jest.Mock).mockResolvedValue(fakeDeployment);

      const result = await service.getK8sDeployment('my-app', 'production');

      expect(result).toEqual(fakeDeployment);
    });
  });
});
