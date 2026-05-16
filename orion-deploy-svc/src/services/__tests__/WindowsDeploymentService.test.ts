import { WindowsDeploymentService } from '../WindowsDeploymentService';

describe('WindowsDeploymentService', () => {
  let service: WindowsDeploymentService;

  beforeEach(() => {
    service = new WindowsDeploymentService();
  });

  describe('generateDeploymentScript', () => {
    it('generates a basic script with minimal config', async () => {
      const script = await service.generateDeploymentScript({
        serviceName: 'my-service',
        image: 'my-registry/my-image:latest',
        port: 8080,
        envVars: {},
        replicas: 1,
      });

      expect(script).toContain('# Windows Deployment Script for my-service');
      expect(script).toContain('$ServiceName = "my-service"');
      expect(script).toContain('$Image = "my-registry/my-image:latest"');
      expect(script).toContain('$Port = 8080');
      expect(script).toContain('$Replicas = 1');
      expect(script).toContain('Set-StrictMode -Version Latest');
      expect(script).toContain('docker pull $Image');
      expect(script).toContain('docker compose -p $ServiceName down --remove-orphans');
      expect(script).toContain('docker compose -f $tempFile -p $ServiceName up -d');
    });

    it('includes environment variable setup in the script', async () => {
      const script = await service.generateDeploymentScript({
        serviceName: 'test-svc',
        image: 'test:latest',
        port: 3000,
        envVars: {
          NODE_ENV: 'production',
          DB_HOST: 'db.example.com',
          DB_PORT: '5432',
        },
        replicas: 2,
      });

      expect(script).toContain(
        "[Environment]::SetEnvironmentVariable('NODE_ENV', 'production', 'Machine')",
      );
      expect(script).toContain(
        "[Environment]::SetEnvironmentVariable('DB_HOST', 'db.example.com', 'Machine')",
      );
      expect(script).toContain(
        "[Environment]::SetEnvironmentVariable('DB_PORT', '5432', 'Machine')",
      );
    });

    it('includes health check when healthCheckPath is provided', async () => {
      const script = await service.generateDeploymentScript({
        serviceName: 'api-svc',
        image: 'api:v2',
        port: 4000,
        envVars: {},
        replicas: 1,
        healthCheckPath: '/health',
      });

      expect(script).toContain('healthcheck:');
      expect(script).toContain('test: ["CMD", "curl", "-f", "http://localhost:4000/health"]');
      expect(script).toContain('interval: 30s');
      expect(script).toContain('timeout: 10s');
      expect(script).toContain('retries: 3');
    });

    it('does not include health check when healthCheckPath is not provided', async () => {
      const script = await service.generateDeploymentScript({
        serviceName: 'api-svc',
        image: 'api:v2',
        port: 4000,
        envVars: {},
        replicas: 1,
      });

      expect(script).not.toContain('healthcheck:');
    });

    it('uses the specified restartPolicy in docker compose', async () => {
      const scriptAlways = await service.generateDeploymentScript({
        serviceName: 'svc1',
        image: 'img:latest',
        port: 80,
        envVars: {},
        replicas: 1,
        restartPolicy: 'always',
      });
      expect(scriptAlways).toContain('restart: always');

      const scriptOnFailure = await service.generateDeploymentScript({
        serviceName: 'svc2',
        image: 'img:latest',
        port: 80,
        envVars: {},
        replicas: 1,
        restartPolicy: 'on-failure',
      });
      expect(scriptOnFailure).toContain('restart: on-failure');

      const scriptNever = await service.generateDeploymentScript({
        serviceName: 'svc3',
        image: 'img:latest',
        port: 80,
        envVars: {},
        replicas: 1,
        restartPolicy: 'never',
      });
      expect(scriptNever).toContain('restart: never');
    });

    it('defaults restart to always when restartPolicy is not specified', async () => {
      const script = await service.generateDeploymentScript({
        serviceName: 'svc',
        image: 'img:latest',
        port: 80,
        envVars: {},
        replicas: 1,
      });

      expect(script).toContain('restart: always');
    });

    it('contains proper docker compose version and structure', async () => {
      const script = await service.generateDeploymentScript({
        serviceName: 'compose-test',
        image: 'test:1.0',
        port: 9090,
        envVars: { FOO: 'bar' },
        replicas: 1,
      });

      expect(script).toContain("version: '3.8'");
      expect(script).toContain('services:');
      expect(script).toContain('compose-test:');
      expect(script).toContain('image: test:1.0');
      expect(script).toContain('"9090:9090"');
      expect(script).toContain('- FOO=bar');
    });

    it('includes generated timestamp in the script', async () => {
      const script = await service.generateDeploymentScript({
        serviceName: 'timestamp-svc',
        image: 'img:latest',
        port: 80,
        envVars: {},
        replicas: 1,
      });

      expect(script).toMatch(/# Generated at: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('deploy', () => {
    it('generates script and returns result with deploymentId', async () => {
      const result = await service.deploy({
        serviceName: 'deploy-test',
        image: 'deploy:v1',
        port: 5000,
        envVars: { KEY: 'value' },
        replicas: 2,
      });

      expect(result.success).toBe(true);
      expect(result.deploymentId).toMatch(/^win-/);
      expect(result.serviceName).toBe('deploy-test');
      expect(result.scriptPath).toMatch(/\.ps1$/);
      expect(result.commands).toEqual(['docker pull', 'docker compose down', 'docker compose up -d']);
      expect(result.output).toBeDefined();
      expect(result.output).toContain('# Windows Deployment Script for deploy-test');
    });

    it('includes error field in result (undefined on success)', async () => {
      const result = await service.deploy({
        serviceName: 'ok-svc',
        image: 'img:latest',
        port: 80,
        envVars: {},
        replicas: 1,
      });

      expect(result.error).toBeUndefined();
    });
  });

  describe('validateConfig', () => {
    it('returns valid for a correct config', async () => {
      const result = await service.validateConfig({
        serviceName: 'valid-svc',
        image: 'img:v1',
        port: 8080,
        envVars: {},
        replicas: 3,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('reports error when serviceName is missing', async () => {
      const result = await service.validateConfig({
        serviceName: '',
        image: 'img:v1',
        port: 8080,
        envVars: {},
        replicas: 1,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('serviceName is required and must be <= 63 characters');
    });

    it('reports error when serviceName exceeds 63 characters', async () => {
      const result = await service.validateConfig({
        serviceName: 'a'.repeat(64),
        image: 'img:v1',
        port: 8080,
        envVars: {},
        replicas: 1,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('serviceName is required and must be <= 63 characters');
    });

    it('reports error when image is missing', async () => {
      const result = await service.validateConfig({
        serviceName: 'test',
        image: '',
        port: 8080,
        envVars: {},
        replicas: 1,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('image is required');
    });

    it('reports error when port is invalid (too low)', async () => {
      const result = await service.validateConfig({
        serviceName: 'test',
        image: 'img:v1',
        port: 0,
        envVars: {},
        replicas: 1,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('port must be between 1 and 65535');
    });

    it('reports error when port is invalid (too high)', async () => {
      const result = await service.validateConfig({
        serviceName: 'test',
        image: 'img:v1',
        port: 70000,
        envVars: {},
        replicas: 1,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('port must be between 1 and 65535');
    });

    it('reports error when replicas is less than 1', async () => {
      const result = await service.validateConfig({
        serviceName: 'test',
        image: 'img:v1',
        port: 8080,
        envVars: {},
        replicas: 0,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('replicas must be between 1 and 10');
    });

    it('reports error when replicas is greater than 10', async () => {
      const result = await service.validateConfig({
        serviceName: 'test',
        image: 'img:v1',
        port: 8080,
        envVars: {},
        replicas: 11,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('replicas must be between 1 and 10');
    });

    it('accepts replicas at boundary values (1 and 10)', async () => {
      const result1 = await service.validateConfig({
        serviceName: 'test',
        image: 'img:v1',
        port: 8080,
        envVars: {},
        replicas: 1,
      });
      expect(result1.valid).toBe(true);

      const result10 = await service.validateConfig({
        serviceName: 'test',
        image: 'img:v1',
        port: 8080,
        envVars: {},
        replicas: 10,
      });
      expect(result10.valid).toBe(true);
    });

    it('allows replicas to be omitted (undefined)', async () => {
      const result = await service.validateConfig({
        serviceName: 'test',
        image: 'img:v1',
        port: 8080,
        envVars: {},
      });

      expect(result.valid).toBe(true);
    });
  });
});
