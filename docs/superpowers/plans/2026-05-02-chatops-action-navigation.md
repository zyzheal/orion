# ChatOps Action Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add internal page routing and external link navigation support to ChatOps action buttons in both ChatPanel and SmartRecommend components

**Architecture:** New `useActionHandler` hook encapsulates all navigation logic (internal route mapping, external URL validation, command execution). Components call the hook and use the returned handler for button clicks. Types extended in store to support optional `target` field on actions.

**Tech Stack:** React hooks, Zustand (chatOpsStore), React Router DOM (useNavigate), Ant Design (Button), Vitest

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/ChatOps/types.ts` | Create | Shared types: `ActionTarget`, `ExtendedAction` |
| `src/components/ChatOps/internalRoutes.ts` | Create | Internal resource type → route path mapping |
| `src/components/ChatOps/actionSecurity.ts` | Create | External URL validation + domain whitelist |
| `src/components/ChatOps/useActionHandler.ts` | Create | React hook: unified action handler with navigation |
| `src/stores/chatOpsStore.ts:26-44` | Modify | Extend ChatMessage `actions` type to include `target` |
| `src/components/ChatOps/ActionCard.tsx` | Modify | Use `useActionHandler` for button clicks |
| `src/components/ChatOps/SmartRecommend.tsx` | Modify | Use `useActionHandler` for recommendation action clicks |
| `src/components/ChatOps/ChatMessage.tsx` | Modify | Pass extended actions type to ActionCard |
| `src/components/ChatOps/__tests__/actionSecurity.test.ts` | Create | Security function unit tests |
| `src/components/ChatOps/__tests__/useActionHandler.test.tsx` | Create | Hook unit tests |
| `src/components/ChatOps/__tests__/ActionCard.test.tsx` | Create | Component integration tests |

---

### Task 1: Create Shared Types and Internal Route Map

**Files:**
- Create: `src/components/ChatOps/types.ts`
- Create: `src/components/ChatOps/internalRoutes.ts`

- [ ] **Step 1: Create shared types file**

Create `src/components/ChatOps/types.ts`:

```typescript
/**
 * ChatOps Action Types — shared across components and store
 */

/** Target for action navigation (internal or external) */
export interface ActionTarget {
  /** Internal resource type, e.g. 'deployment', 'alert', 'pipeline' */
  resourceType?: string;
  /** Resource ID for internal routing */
  resourceId?: string;
  /** External full URL (mutually exclusive with resourceType) */
  externalUrl?: string;
  /** Open in new tab/window */
  openInNewTab?: boolean;
}

/** Extended action with optional navigation target */
export interface ExtendedAction {
  label: string;
  command: string;
  params: Record<string, unknown>;
  /** If present, clicking this action navigates instead of executing a command */
  target?: ActionTarget;
}

/** Type guard to check if action has a navigation target */
export function hasTarget(action: ExtendedAction): action is ExtendedAction & { target: ActionTarget } {
  return !!action.target;
}
```

- [ ] **Step 2: Create internal route mapping file**

Create `src/components/ChatOps/internalRoutes.ts`:

```typescript
/**
 * Internal resource type → React Router path mapping.
 * Add new resource types here — no component changes needed.
 */

export interface RoutePattern {
  /** Route template function, e.g. (id) => `/deployments/${id}` */
  buildPath: (params: { id: string; [key: string]: string }) => string;
  /** Human-readable label for debugging */
  label: string;
}

/** Map of resource types to their route builders */
export const internalRouteMap: Record<string, RoutePattern> = {
  deployment: { buildPath: ({ id }) => `/deployments/${id}`, label: 'Deployment Detail' },
  alert: { buildPath: () => '/alerts', label: 'Alert List' },
  pipeline: { buildPath: ({ id }) => `/pipelines/${id}`, label: 'Pipeline Detail' },
  sbom: { buildPath: ({ id }) => `/sbom/${id}`, label: 'SBOM Detail' },
  ticket: { buildPath: ({ id }) => `/tickets/${id}`, label: 'Ticket Detail' },
  'canary-analysis': { buildPath: () => '/canary-analysis', label: 'Canary Analysis' },
  ephemeralEnv: { buildPath: ({ id }) => `/ephemeral-envs/${id}`, label: 'Ephemeral Env Detail' },
  buildEnv: { buildPath: () => '/console/build-env', label: 'Build Environment' },
  codeRepo: { buildPath: () => '/console/code-mgmt/repos', label: 'Code Repositories' },
  selfHealing: { buildPath: ({ id }) => `/console/self-healing/incidents/${id}`, label: 'Self-Healing Incident' },
};

/**
 * Build a route path from resource type and params.
 * Returns null if the resource type is not in the route map.
 */
export function buildInternalRoute(resourceType: string, resourceId: string): string | null {
  const pattern = internalRouteMap[resourceType];
  if (!pattern) return null;
  return pattern.buildPath({ id: resourceId });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -c "error"`
Expected: 0 new errors (existing errors unchanged)

- [ ] **Step 4: Commit**

```bash
git add src/components/ChatOps/types.ts src/components/ChatOps/internalRoutes.ts
git commit -m "feat(chatops): add shared action types and internal route map"
```

---

### Task 2: Create External URL Security Validation

**Files:**
- Create: `src/components/ChatOps/actionSecurity.ts`
- Create: `src/components/ChatOps/__tests__/actionSecurity.test.ts`

- [ ] **Step 1: Write failing tests for security functions**

Create `src/components/ChatOps/__tests__/actionSecurity.test.ts`:

```typescript
import { isSafeExternalUrl, sanitizeExternalUrl } from '../actionSecurity';

describe('actionSecurity', () => {
  describe('isSafeExternalUrl', () => {
    // Valid URLs
    it('allows whitelisted HTTPS URLs', () => {
      expect(isSafeExternalUrl('https://github.com/orion-design/repo')).toBe(true);
      expect(isSafeExternalUrl('https://gitlab.com/group/project')).toBe(true);
    });

    it('allows subdomains of whitelisted domains', () => {
      expect(isSafeExternalUrl('https://grafana.internal/dashboard')).toBe(true);
    });

    // Invalid protocols
    it('rejects javascript: protocol', () => {
      expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
    });

    it('rejects data: protocol', () => {
      expect(isSafeExternalUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    });

    it('rejects vbscript: protocol', () => {
      expect(isSafeExternalUrl('vbscript:msgbox(1)')).toBe(false);
    });

    // Protocol-relative URLs
    it('rejects protocol-relative URLs', () => {
      expect(isSafeExternalUrl('//evil.com')).toBe(false);
    });

    // Non-whitelisted domains
    it('rejects non-whitelisted domains', () => {
      expect(isSafeExternalUrl('https://evil.com')).toBe(false);
      expect(isSafeExternalUrl('https://evil.github.com')).toBe(false);
    });

    // Invalid URLs
    it('rejects malformed URLs', () => {
      expect(isSafeExternalUrl('not-a-url')).toBe(false);
      expect(isSafeExternalUrl('')).toBe(false);
    });
  });

  describe('sanitizeExternalUrl', () => {
    it('returns the original URL if safe', () => {
      expect(sanitizeExternalUrl('https://github.com/test')).toBe('https://github.com/test');
    });

    it('returns null if unsafe', () => {
      expect(sanitizeExternalUrl('javascript:alert(1)')).toBe(null);
    });

    it('adds https:// protocol to bare domains', () => {
      const result = sanitizeExternalUrl('https://github.com/test');
      expect(result).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/ChatOps/__tests__/actionSecurity.test.ts`
Expected: FAIL with "Cannot find module '../actionSecurity'"

- [ ] **Step 3: Write the security module**

Create `src/components/ChatOps/actionSecurity.ts`:

```typescript
/**
 * External URL security validation for ChatOps action navigation.
 * Prevents XSS, open redirect, and phishing attacks.
 */

/** Allowed external domain whitelist — add domains that are safe to navigate to */
const ALLOWED_EXTERNAL_DOMAINS = [
  'github.com',
  'gitlab.com',
  'grafana.com',
  'prometheus.io',
] as const;

/**
 * Check if a URL is safe to navigate to externally.
 *
 * Security rules:
 * 1. Only http: and https: protocols allowed
 * 2. Domain must be in the whitelist (or subdomain of whitelisted domain)
 * 3. No javascript:, data:, vbscript: protocols
 * 4. No protocol-relative URLs (//evil.com)
 */
export function isSafeExternalUrl(url: string): boolean {
  try {
    // Reject empty or whitespace-only strings
    if (!url || url.trim() === '') return false;

    // Reject protocol-relative URLs
    if (url.startsWith('//')) return false;

    const parsed = new URL(url);

    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;

    // Domain whitelist check (exact match or subdomain)
    const hostname = parsed.hostname.toLowerCase();
    return ALLOWED_EXTERNAL_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    // Invalid URL — reject
    return false;
  }
}

/**
 * Sanitize and return a URL if safe, or null if unsafe.
 * Usage: const safeUrl = sanitizeExternalUrl(userInput); if (safeUrl) window.open(safeUrl);
 */
export function sanitizeExternalUrl(url: string): string | null {
  return isSafeExternalUrl(url) ? url : null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/ChatOps/__tests__/actionSecurity.test.ts`
Expected: 10 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ChatOps/actionSecurity.ts src/components/ChatOps/__tests__/actionSecurity.test.ts
git commit -m "feat(chatops): add external URL security validation with domain whitelist"
```

---

### Task 3: Create useActionHandler Hook

**Files:**
- Create: `src/components/ChatOps/useActionHandler.ts`
- Create: `src/components/ChatOps/__tests__/useActionHandler.test.tsx`

- [ ] **Step 1: Write failing test for the hook**

Create `src/components/ChatOps/__tests__/useActionHandler.test.tsx`:

```typescript
import { renderHook, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { useActionHandler } from '../useActionHandler';
import { useChatOpsStore } from '@/stores/chatOpsStore';
import * as security from '../actionSecurity';

// Mock the store
vi.mock('@/stores/chatOpsStore', () => ({
  useChatOpsStore: vi.fn(),
}));

// Mock security module
vi.mock('../actionSecurity', () => ({
  isSafeExternalUrl: vi.fn(),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('useActionHandler', () => {
  const mockExecuteAction = vi.fn();
  const mockWindowOpen = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useChatOpsStore as any).mockReturnValue({ executeAction: mockExecuteAction });
    global.window.open = mockWindowOpen;
  });

  it('executes command when action has no target', () => {
    const { result } = renderHook(() => useActionHandler(), { wrapper });
    const action = { label: 'Run', command: 'deploy', params: { env: 'prod' } };

    act(() => {
      result.current(action);
    });

    expect(mockExecuteAction).toHaveBeenCalledWith('deploy', { env: 'prod' });
    expect(mockWindowOpen).not.toHaveBeenCalled();
  });

  it('navigates internally when action has resourceType and resourceId', () => {
    const { result } = renderHook(() => useActionHandler(), { wrapper });
    const action = {
      label: 'View',
      command: 'status',
      params: {},
      target: { resourceType: 'deployment', resourceId: 'dep-123' },
    };

    act(() => {
      result.current(action);
    });

    // Verify navigation happened (check window.location.pathname)
    expect(window.location.pathname).toBe('/deployments/dep-123');
    expect(mockExecuteAction).not.toHaveBeenCalled();
  });

  it('opens external URL in new tab when safe', () => {
    (security.isSafeExternalUrl as any).mockReturnValue(true);
    const { result } = renderHook(() => useActionHandler(), { wrapper });
    const action = {
      label: 'Open PR',
      command: 'status',
      params: {},
      target: { externalUrl: 'https://github.com/repo/pull/1', openInNewTab: true },
    };

    act(() => {
      result.current(action);
    });

    expect(mockWindowOpen).toHaveBeenCalledWith(
      'https://github.com/repo/pull/1',
      '_blank',
      'noopener,noreferrer'
    );
    expect(mockExecuteAction).not.toHaveBeenCalled();
  });

  it('blocks unsafe external URLs and executes command instead', () => {
    (security.isSafeExternalUrl as any).mockReturnValue(false);
    const { result } = renderHook(() => useActionHandler(), { wrapper });
    const action = {
      label: 'View',
      command: 'status',
      params: {},
      target: { externalUrl: 'javascript:alert(1)', openInNewTab: true },
    };

    act(() => {
      result.current(action);
    });

    expect(mockWindowOpen).not.toHaveBeenCalled();
    expect(mockExecuteAction).toHaveBeenCalledWith('status', {});
  });

  it('ignores actions with unknown resourceType', () => {
    const { result } = renderHook(() => useActionHandler(), { wrapper });
    const action = {
      label: 'View',
      command: 'status',
      params: {},
      target: { resourceType: 'unknown_type', resourceId: '123' },
    };

    act(() => {
      result.current(action);
    });

    // Falls back to command execution
    expect(mockExecuteAction).toHaveBeenCalledWith('status', {});
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/ChatOps/__tests__/useActionHandler.test.tsx`
Expected: FAIL with "Cannot find module '../useActionHandler'"

- [ ] **Step 3: Write the hook implementation**

Create `src/components/ChatOps/useActionHandler.ts`:

```typescript
/**
 * useActionHandler — unified action handler for ChatOps components.
 *
 * Handles three cases:
 * 1. Action has externalUrl → opens in new tab (with security validation)
 * 2. Action has resourceType + resourceId → navigates via React Router
 * 3. Action has no target → executes command via chatOpsStore
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatOpsStore } from '@/stores/chatOpsStore';
import type { ExtendedAction } from './types';
import { hasTarget } from './types';
import { isSafeExternalUrl } from './actionSecurity';
import { buildInternalRoute } from './internalRoutes';

export function useActionHandler() {
  const navigate = useNavigate();
  const { executeAction } = useChatOpsStore();

  return useCallback(
    (action: ExtendedAction) => {
      // Case: action has a navigation target
      if (hasTarget(action)) {
        const { target } = action;

        // External URL
        if (target.externalUrl) {
          if (isSafeExternalUrl(target.externalUrl)) {
            if (target.openInNewTab) {
              window.open(target.externalUrl, '_blank', 'noopener,noreferrer');
            } else {
              window.location.href = target.externalUrl;
            }
            return;
          }
          // Unsafe URL — log warning and fall through to command execution
          console.warn(`[ChatOps] Blocked unsafe external URL: ${target.externalUrl}`);
        }

        // Internal resource route
        if (target.resourceType && target.resourceId) {
          const route = buildInternalRoute(target.resourceType, target.resourceId);
          if (route) {
            navigate(route);
            return;
          }
          // Unknown resource type — fall through to command execution
        }
      }

      // Default: execute command
      executeAction(action.command, action.params);
    },
    [navigate, executeAction]
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/ChatOps/__tests__/useActionHandler.test.tsx`
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ChatOps/useActionHandler.ts src/components/ChatOps/__tests__/useActionHandler.test.tsx
git commit -m "feat(chatops): add useActionHandler hook for unified action navigation"
```

---

### Task 4: Wire useActionHandler into ActionCard and ChatMessage

**Files:**
- Modify: `src/components/ChatOps/ActionCard.tsx`
- Modify: `src/components/ChatOps/ChatMessage.tsx`

- [ ] **Step 1: Update ChatMessage to use ExtendedAction type**

Modify `src/components/ChatOps/ChatMessage.tsx` — change the `ChatMessageData` interface `actions` type:

Replace the `ChatMessageData` interface (lines 5-12):

```typescript
import type { ExtendedAction } from '@/components/ChatOps/types';

export interface ChatMessageData {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  actions?: ExtendedAction[];
  status?: 'success' | 'failed' | 'running';
}
```

- [ ] **Step 2: Update ActionCard to use useActionHandler**

Modify `src/components/ChatOps/ActionCard.tsx` — replace the entire file content:

```typescript
import React from 'react';
import { Button, Space } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, ArrowRightOutlined, ExportOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { useChatOpsStore } from '@/stores/chatOpsStore';
import { useActionHandler } from './useActionHandler';
import type { ExtendedAction } from './types';
import { hasTarget } from './types';

const statusIcons = {
  success: <CheckCircleOutlined style={{ color: colors.success[500] }} />,
  failed: <CloseCircleOutlined style={{ color: colors.error[400] }} />,
  running: <LoadingOutlined style={{ color: colors.warning[500] }} />,
};

/** Get a small icon for the action type */
function getActionIcon(action: ExtendedAction): React.ReactNode {
  if (hasTarget(action)) {
    if (action.target?.externalUrl) {
      return <ExportOutlined style={{ fontSize: 10, marginLeft: 4, opacity: 0.5 }} />;
    }
    return <ArrowRightOutlined style={{ fontSize: 10, marginLeft: 4, opacity: 0.5 }} />;
  }
  return null;
}

export const ActionCard: React.FC<{
  actions: ExtendedAction[];
  status?: 'success' | 'failed' | 'running';
}> = ({ actions, status }) => {
  const { executeAction } = useChatOpsStore();
  const handleAction = useActionHandler();

  return (
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {status && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
          {statusIcons[status]} {status}
        </div>
      )}
      <Space wrap>
        {actions.map((action) => (
          <Button
            key={action.label}
            size="small"
            type="default"
            onClick={() => handleAction(action)}
          >
            {action.label}
            {getActionIcon(action)}
          </Button>
        ))}
      </Space>
    </div>
  );
};
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -c "error"`
Expected: same count as before (no new errors introduced)

- [ ] **Step 4: Commit**

```bash
git add src/components/ChatOps/ActionCard.tsx src/components/ChatOps/ChatMessage.tsx
git commit -m "feat(chatops): wire useActionHandler into ActionCard with visual indicators"
```

---

### Task 5: Wire useActionHandler into SmartRecommend

**Files:**
- Modify: `src/components/ChatOps/SmartRecommend.tsx`

- [ ] **Step 1: Update SmartRecommend to use useActionHandler**

Modify `src/components/ChatOps/SmartRecommend.tsx`:

Add imports at the top (after line 11):
```typescript
import { useActionHandler } from './useActionHandler';
import type { ExtendedAction } from './types';
import { hasTarget } from './types';
import { ArrowRightOutlined, ExportOutlined } from '@ant-design/icons';
```

Change the `executeAction` destructuring on line 39 to also include `handleAction`:
```typescript
  const { recommendations, dismissRecommendation } = useChatOpsStore();
  const handleAction = useActionHandler();
  const maxPanelHeight = usePanelHeight();
```

Add icon helper before the map function (around line 69):
```typescript
/** Get action button icon based on target type */
function getRecActionIcon(action: ExtendedAction): React.ReactNode {
  if (hasTarget(action)) {
    if (action.target?.externalUrl) {
      return <ExportOutlined style={{ fontSize: 10, marginLeft: 4, opacity: 0.5 }} />;
    }
    return <ArrowRightOutlined style={{ fontSize: 10, marginLeft: 4, opacity: 0.5 }} />;
  }
  return null;
}
```

Change the action button rendering (lines 92-100) from:
```typescript
{rec.actions.map((action) => (
  <Button
    key={action.label}
    size="small"
    onClick={() => executeAction(action.command, action.params)}
  >
    {action.label}
  </Button>
))}
```

To:
```typescript
{rec.actions.map((action) => (
  <Button
    key={action.label}
    size="small"
    onClick={() => handleAction(action)}
  >
    {action.label}
    {getRecActionIcon(action)}
  </Button>
))}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -c "error"`
Expected: same count as before (no new errors)

- [ ] **Step 3: Commit**

```bash
git add src/components/ChatOps/SmartRecommend.tsx
git commit -m "feat(chatops): wire useActionHandler into SmartRecommend with visual indicators"
```

---

### Task 6: Component Integration Tests

**Files:**
- Create: `src/components/ChatOps/__tests__/ActionCard.test.tsx`

- [ ] **Step 1: Write ActionCard integration tests**

Create `src/components/ChatOps/__tests__/ActionCard.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ActionCard } from '../ActionCard';
import { useChatOpsStore } from '@/stores/chatOpsStore';

vi.mock('@/stores/chatOpsStore', () => ({
  useChatOpsStore: vi.fn(),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('ActionCard', () => {
  const mockExecuteAction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useChatOpsStore as any).mockReturnValue({ executeAction: mockExecuteAction });
  });

  it('renders action buttons with labels', () => {
    const actions = [
      { label: 'Deploy', command: 'deploy', params: {} },
      { label: 'Rollback', command: 'rollback', params: {} },
    ];
    render(<ActionCard actions={actions} />, { wrapper });

    expect(screen.getByText('Deploy')).toBeInTheDocument();
    expect(screen.getByText('Rollback')).toBeInTheDocument();
  });

  it('executes command when action has no target', () => {
    const actions = [{ label: 'Deploy', command: 'deploy', params: { env: 'prod' } }];
    render(<ActionCard actions={actions} />, { wrapper });

    fireEvent.click(screen.getByText('Deploy'));
    expect(mockExecuteAction).toHaveBeenCalledWith('deploy', { env: 'prod' });
  });

  it('shows arrow icon for internal navigation actions', () => {
    const actions = [
      { label: 'View Details', command: 'status', params: {}, target: { resourceType: 'deployment', resourceId: 'dep-123' } },
    ];
    render(<ActionCard actions={actions} />, { wrapper });

    expect(screen.getByText('View Details')).toBeInTheDocument();
  });

  it('shows export icon for external link actions', () => {
    const actions = [
      { label: 'View PR', command: 'status', params: {}, target: { externalUrl: 'https://github.com/test/pull/1', openInNewTab: true } },
    ];
    render(<ActionCard actions={actions} />, { wrapper });

    expect(screen.getByText('View PR')).toBeInTheDocument();
  });

  it('renders status icon when provided', () => {
    const actions = [{ label: 'Done', command: 'noop', params: {} }];
    render(<ActionCard actions={actions} status="success" />, { wrapper });

    expect(screen.getByText('success')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/components/ChatOps/__tests__/ActionCard.test.tsx`
Expected: 5 tests PASS

- [ ] **Step 3: Run all ChatOps tests together**

Run: `npx vitest run src/components/ChatOps/`
Expected: All tests PASS (actionSecurity + useActionHandler + ActionCard)

- [ ] **Step 4: Commit**

```bash
git add src/components/ChatOps/__tests__/ActionCard.test.tsx
git commit -m "test(chatops): add ActionCard integration tests"
```

---

### Task 7: Full Verification

- [ ] **Step 1: TypeScript check**

Run: `npx tsc --noEmit`
Expected: No new errors (existing pre-existing errors unchanged)

- [ ] **Step 2: Full test suite**

Run: `npx vitest run`
Expected: All tests pass (540+ existing + 15 new = 555+)

- [ ] **Step 3: Build check**

Run: `npx vite build`
Expected: Build succeeds with no errors

- [ ] **Step 4: Commit all changes**

If any fixes are needed in the verification step, commit them:

```bash
git add -A
git commit -m "fix(chatops): address verification findings"
```
