/**
 * SharedActionService Tests
 *
 * Tests for action resolution: builtin expansion, security constraints,
 * input substitution, depth limits, circular reference detection.
 */

import { SharedActionService, ActionDefinition } from '../SharedActionService';

describe('SharedActionService', () => {
  let service: SharedActionService;

  beforeEach(() => {
    service = new SharedActionService({ registryWhitelist: ['orion-design'] });
  });

  describe('resolveActionRef - builtin actions', () => {
    it('should expand builtin checkout action', async () => {
      const steps = await service.resolveActionRef('checkout', {}, new Set(), 0);
      expect(steps).toHaveLength(1);
      expect(steps[0].uses).toBe('builtin:git/clone@v1');
    });

    it('should throw for unknown builtin action', async () => {
      await expect(service.resolveActionRef('unknown-action', {}, new Set(), 0))
        .rejects.toThrow('Unknown action');
    });
  });

  describe('resolveActionRef - security constraints', () => {
    it('should reject @main remote action', async () => {
      await expect(service.resolveActionRef('org/repo@main', {}, new Set(), 0))
        .rejects.toThrow('must use SHA or version tag');
    });

    it('should reject @master remote action', async () => {
      await expect(service.resolveActionRef('org/repo@master', {}, new Set(), 0))
        .rejects.toThrow('must use SHA or version tag');
    });

    it('should reject @HEAD remote action', async () => {
      await expect(service.resolveActionRef('org/repo@HEAD', {}, new Set(), 0))
        .rejects.toThrow('must use SHA or version tag');
    });

    it('should reject unwhitelisted org', async () => {
      await expect(service.resolveActionRef('unknown/repo@v1', {}, new Set(), 0))
        .rejects.toThrow('not in whitelist');
    });

    it('should reject invalid repo format', async () => {
      await expect(service.resolveActionRef('org/../../../etc/passwd@v1', {}, new Set(), 0))
        .rejects.toThrow('Invalid repository format');
    });

    it('should allow whitelisted org but fail on git clone', async () => {
      // Whitelist check should pass, then git clone should fail (no network needed)
      // Mock gitClone to avoid network call
      const mockGitClone = jest.fn().mockRejectedValue(new Error('git clone failed: exit 128'));
      (service as any).gitClone = mockGitClone;

      await expect(
        service.resolveActionRef('orion-design/repo@v1', {}, new Set(), 0),
      ).rejects.toThrow(/git clone failed/);
      expect(mockGitClone).toHaveBeenCalledWith(
        'orion-design/repo',
        'v1',
        expect.any(String),
      );
    });
  });

  describe('resolveActionRef - depth and circular', () => {
    it('should reject excessive nesting', async () => {
      await expect(service.resolveActionRef('test@v1', {}, new Set(), 6))
        .rejects.toThrow('exceeds maximum');
    });

    it('should detect circular references', async () => {
      const visited = new Set(['circular-action@v1']);
      await expect(
        service.resolveActionRef('circular-action@v1', {}, visited, 0),
      ).rejects.toThrow('Circular action reference');
    });
  });

  describe('expandAction', () => {
    it('should substitute input variables', () => {
      const action: ActionDefinition = {
        name: 'test',
        description: 'test',
        inputs: { 'node-version': { description: 'Node version', default: '18' } },
        runs: {
          steps: [
            {
              name: 'setup',
              uses: 'npm/setup@v1',
              with: { version: '${inputs.node-version}' },
            },
          ],
        },
      };

      const steps = (service as any).expandAction(action, { 'node-version': '20' });
      expect(steps[0].with?.version).toBe('20');
    });

    it('should use default values for missing inputs', () => {
      const action: ActionDefinition = {
        name: 'test',
        description: 'test',
        inputs: { 'node-version': { description: 'Node version', default: '18' } },
        runs: {
          steps: [
            {
              name: 'setup',
              uses: 'npm/setup@v1',
              with: { version: '${inputs.node-version}' },
            },
          ],
        },
      };

      const steps = (service as any).expandAction(action, {});
      expect(steps[0].with?.version).toBe('18');
    });

    it('should keep placeholder for missing input with no default', () => {
      const action: ActionDefinition = {
        name: 'test',
        description: 'test',
        inputs: { 'no-default': { description: 'No default' } },
        runs: {
          steps: [
            {
              name: 'setup',
              uses: 'test/setup@v1',
              with: { value: '${inputs.no-default}' },
            },
          ],
        },
      };

      const steps = (service as any).expandAction(action, {});
      expect(steps[0].with?.value).toBe('${inputs.no-default}');
    });

    it('should handle non-string values in with', () => {
      const action: ActionDefinition = {
        name: 'test',
        description: 'test',
        runs: {
          steps: [
            {
              name: 'setup',
              uses: 'test/setup@v1',
              with: { count: 42, enabled: true },
            },
          ],
        },
      };

      const steps = (service as any).expandAction(action, {});
      expect(steps[0].with?.count).toBe(42);
      expect(steps[0].with?.enabled).toBe(true);
    });
  });
});
