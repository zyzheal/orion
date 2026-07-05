import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AlertSilenceService,
  type CreateSilenceInput,
  type AlertSilenceMatcher,
  type AlertSilence,
} from '../AlertSilenceService.js';
import { AlertSilenceRepository } from '../../repositories/AlertSilenceRepository.js';

// -- Mock repository -------------------------------------------------------

function makeRepo() {
  const store = new Map<string, AlertSilence>();
  let matchedSilence: AlertSilence | null = null;

  const repo = {
    create: vi.fn(async (input: {
      id: string;
      createdBy: string;
      matchers: AlertSilenceMatcher[];
      startsAt: Date;
      endsAt: Date | null;
      comment: string;
    }) => {
      const silence: AlertSilence = {
        id: input.id,
        createdBy: input.createdBy,
        matchers: input.matchers,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        comment: input.comment,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.set(silence.id, silence);
      return silence;
    }),
    findById: vi.fn(async (id: string) => store.get(id) ?? null),
    findAll: vi.fn(async () => Array.from(store.values())),
    findActive: vi.fn(async () =>
      Array.from(store.values()).filter((s) => s.isActive),
    ),
    deactivate: vi.fn(async (id: string) => {
      const s = store.get(id);
      if (!s) return false;
      s.isActive = false;
      return true;
    }),
    matchSilence: vi.fn(async (_labels: Record<string, string>) => matchedSilence),
    // helper to set what matchSilence returns
    _setMatchSilence: (s: AlertSilence | null) => { matchedSilence = s; },
  };
  return repo;
}

type MockRepo = ReturnType<typeof makeRepo>;

// We inject a mock repo by extending the service to accept it.
// The service constructor accepts an optional repository parameter.

function makeService(repo: MockRepo) {
  // Cast the mock repo to the real repo type for injection
  return new AlertSilenceService(repo as unknown as AlertSilenceRepository);
}

// -- Helpers ----------------------------------------------------------------

function makeInput(overrides: Partial<CreateSilenceInput> = {}): CreateSilenceInput {
  return {
    createdBy: 'user-1',
    matchers: overrides.matchers ?? [{ name: 'service', pattern: 'web-api', isRegex: false }],
    startsAt: overrides.startsAt ?? new Date(Date.now() - 60_000), // 1 min ago
    endsAt: overrides.endsAt ?? new Date(Date.now() + 3_600_000),   // 1 hour from now
    comment: overrides.comment ?? 'maintenance window',
  };
}

// -- Tests ------------------------------------------------------------------

describe('AlertSilenceService', () => {
  let repo: MockRepo;
  let svc: AlertSilenceService;

  beforeEach(() => {
    repo = makeRepo();
    svc = makeService(repo);
  });

  describe('create', () => {
    it('creates a silence rule and returns it', async () => {
      const input = makeInput();
      const result = await svc.create(input);

      expect(result.id).toBeDefined();
      expect(result.createdBy).toBe('user-1');
      expect(result.matchers).toHaveLength(1);
      expect(result.comment).toBe('maintenance window');
      expect(result.isActive).toBe(true);
      expect(repo.create).toHaveBeenCalledTimes(1);
    });

    it('uses a UUID when no id is provided', async () => {
      const input = makeInput();
      const result = await svc.create(input);
      expect(result.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('supports multiple matchers', async () => {
      const input = makeInput({
        matchers: [
          { name: 'service', pattern: 'web-api', isRegex: false },
          { name: 'env', pattern: 'prod|staging', isRegex: true },
        ],
      });
      const result = await svc.create(input);
      expect(result.matchers).toHaveLength(2);
      expect(result.matchers[1].isRegex).toBe(true);
    });
  });

  describe('listActive / listAll', () => {
    it('listActive returns only active silences', async () => {
      await svc.create(makeInput({ comment: 'active-1' }));
      await svc.create(makeInput({ comment: 'active-2' }));
      const active = await svc.listActive();
      expect(active).toHaveLength(2);
    });

    it('listAll returns all silences', async () => {
      await svc.create(makeInput({ comment: 's1' }));
      await svc.create(makeInput({ comment: 's2' }));
      const all = await svc.listAll();
      expect(all).toHaveLength(2);
    });
  });

  describe('delete', () => {
    it('deactivates an existing silence', async () => {
      const created = await svc.create(makeInput());
      const result = await svc.delete(created.id);
      expect(result).toBe(true);
      expect(repo.deactivate).toHaveBeenCalledWith(created.id);
    });

    it('returns false for non-existent silence', async () => {
      const result = await svc.delete('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('shouldSuppress', () => {
    it('returns suppressed:true when a matching silence exists', async () => {
      const silence = await svc.create(makeInput({
        matchers: [{ name: 'service', pattern: 'web-api', isRegex: false }],
      }));
      repo._setMatchSilence(silence);

      const result = await svc.shouldSuppress({ service: 'web-api', env: 'prod' });
      expect(result.suppressed).toBe(true);
      expect(result.silence).toBeDefined();
      expect(result.silence!.id).toBe(silence.id);
    });

    it('returns suppressed:false when no matching silence exists', async () => {
      repo._setMatchSilence(null);

      const result = await svc.shouldSuppress({ service: 'other-api' });
      expect(result.suppressed).toBe(false);
      expect(result.silence).toBeUndefined();
    });

    it('matches using regex pattern', async () => {
      const silence = await svc.create(makeInput({
        matchers: [{ name: 'env', pattern: 'prod|staging', isRegex: true }],
      }));
      repo._setMatchSilence(silence);

      const result = await svc.shouldSuppress({ env: 'staging' });
      expect(result.suppressed).toBe(true);
    });

    it('does not suppress when a required matcher is missing', async () => {
      // Simulates repo.matchSilence returning null because labels don't satisfy all matchers
      repo._setMatchSilence(null);

      const result = await svc.shouldSuppress({ service: 'web-api' });
      expect(result.suppressed).toBe(false);
    });
  });
});
