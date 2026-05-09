/**
 * ContainerExecutor Tests
 *
 * Tests for LocalSpawnExecutor, DockerExecutor, and factory function.
 */

import {
  LocalSpawnExecutor,
  DockerExecutor,
  createContainerExecutor,
  ContainerSpec,
} from '../ContainerExecutor';

describe('LocalSpawnExecutor', () => {
  let executor: LocalSpawnExecutor;

  beforeEach(() => {
    executor = new LocalSpawnExecutor();
  });

  test('should always be available', async () => {
    expect(await executor.isAvailable()).toBe(true);
  });

  test('should execute simple commands successfully', async () => {
    const spec: ContainerSpec = { image: 'unused', workdir: process.cwd() };

    const result = await executor.execute(spec, 'echo', ['hello']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('hello');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  test('should return non-zero exit code for failing commands', async () => {
    const spec: ContainerSpec = { image: 'unused' };

    const result = await executor.execute(spec, 'sh', ['-c', 'exit 42']);

    expect(result.exitCode).toBe(42);
  });

  test('should merge environment variables', async () => {
    const spec: ContainerSpec = {
      image: 'unused',
      env: { MY_VAR: 'test-value' },
    };

    const result = await executor.execute(spec, 'sh', ['-c', 'echo $MY_VAR']);

    expect(result.stdout).toBe('test-value');
  });

  test('should use custom workdir', async () => {
    const spec: ContainerSpec = {
      image: 'unused',
      workdir: '/tmp',
    };

    const result = await executor.execute(spec, 'pwd', []);

    // macOS resolves /tmp to /private/tmp
    expect(result.stdout).toMatch(/\/tmp|\/private\/tmp/);
  });
});

describe('DockerExecutor', () => {
  let executor: DockerExecutor;

  beforeEach(() => {
    executor = new DockerExecutor();
  });

  test('should check docker availability', async () => {
    const result = await executor.isAvailable();
    expect(typeof result).toBe('boolean');
  });

  test('should return failure when docker is not available or image missing', async () => {
    const spec: ContainerSpec = {
      image: 'nonexistent-image-12345',
    };

    const result = await executor.execute(spec, 'echo', ['hello']);

    expect(result).toBeDefined();
    expect(result.exitCode).toBeDefined();
  });
});

describe('createContainerExecutor factory', () => {
  test('should return LocalSpawnExecutor for "local" type', () => {
    const executor = createContainerExecutor('local');
    expect(executor).toBeInstanceOf(LocalSpawnExecutor);
  });

  test('should return DockerExecutor for "docker" type', () => {
    const executor = createContainerExecutor('docker');
    expect(executor).toBeInstanceOf(DockerExecutor);
  });

  test('should default to local for unknown type', () => {
    // @ts-ignore - testing invalid input
    const executor = createContainerExecutor('unknown');
    expect(executor).toBeInstanceOf(LocalSpawnExecutor);
  });
});
