# Platform Visual Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify visual consistency across all 72 frontend pages via ConfigProvider theme tokens, global CSS enhancements, DataState component, and CardPanel deprecation

**Architecture:** Extend existing Ant Design ConfigProvider (already in App.tsx) with complete Design Token mapping, add global CSS for layout-level consistency, create unified DataState loading/error/empty component, deprecate CardPanel

**Tech Stack:** Ant Design v5 ConfigProvider, React 18, TypeScript, CSS-in-JS, Vitest

---

## Pre-requisites

- Working directory: `/Users/heal/orion-design/orion-frontend`
- Branch: `feat/frontend-gap-implementation`
- All tasks run from this branch
- ConfigProvider already wraps app in both `App.tsx` and `main.tsx`
- Global CSS already exists at `src/assets/styles/global.css`
- CardPanel already wraps Ant Card at `src/components/CardPanel/index.tsx`
- Design Tokens defined at `src/tokens/` (colors, spacing, radius, shadows, typography, animation)

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| **Modify** | `src/tokens/theme.ts` | Extend `lightTheme`/`darkTheme` with all Design Token mappings (spacing, motion, component configs) |
| **Modify** | `src/App.tsx` | Use extended theme from `theme.ts` instead of inline `antdToken` |
| **Modify** | `src/main.tsx` | Same: use extended theme from `theme.ts` |
| **Modify** | `src/assets/styles/global.css` | Add page background, card hover, button hover, dashboard header, scrollbar CSS |
| **Create** | `src/components/DataState/index.tsx` | Unified loading/error/empty overlay component |
| **Create** | `src/components/DataState/__tests__/index.test.tsx` | DataState component tests |
| **Modify** | `src/components/CardPanel/index.tsx` | Add deprecation warning in dev mode |
| **Verify** | `npx tsc --noEmit` | No new TypeScript errors |
| **Verify** | `npx vitest run` | All tests passing |

---

### Task 1: Extend Design Token Theme Mapping

**Files:**
- Modify: `src/tokens/theme.ts:1-104` (extend existing theme config)

- [ ] **Step 1: Extend theme.ts with complete token mapping**

Read current `src/tokens/theme.ts`. Extend `lightTheme.token` with all missing Design Token mappings:

```typescript
// Add these imports at the top if not already present:
import { spacing } from './spacing';
import { zIndex } from './zIndex';

// Extend lightTheme.token with these additional fields (ADD after existing token fields):
// In the `lightTheme` object's `token` property, add after `motionEaseInOut`:

    // Spacing tokens (add to token)
    paddingXXS: spacing.xs,    // 4px
    paddingXS: spacing.sm,     // 8px
    paddingSM: spacing.md,     // 16px
    padding: spacing.lg,       // 24px
    paddingLG: spacing.xl,     // 32px
    paddingXL: spacing.xxl,    // 48px

    // Font size tokens
    fontSizeSM: typography.fontSize.sm,   // 12px
    fontSizeLG: typography.fontSize.lg,   // 16px
    fontSizeXL: typography.fontSize.xl,   // 20px
    fontSizeHeading1: typography.fontSize.xxl,   // 24px
    fontSizeHeading2: typography.fontSize.xxxl,  // 32px
    fontSizeHeading3: typography.fontSize.xl,    // 20px
    fontSizeHeading4: typography.fontSize.lg,    // 16px
    fontSizeHeading5: typography.fontSize.md,    // 14px

    // Line height
    lineHeight: typography.lineHeight.normal,     // 1.5
    lineHeightLG: typography.lineHeight.relaxed,  // 1.625
    lineHeightSM: typography.lineHeight.tight,    // 1.25

    // Motion tokens
    motionDurationFast: `${animation.duration.fastest}ms`,  // 100ms
    motionDurationMid: `${animation.duration.normal}ms`,    // 300ms
    motionDurationSlow: `${animation.duration.slowest}ms`,  // 1000ms
    motionEaseOut: animation.easing.easeOut,
    motionEaseInOut: animation.easing.easeInOut,

    // Component size
    sizeStep: 4,
    sizeUnit: 4,
    componentSize: 'middle',
    wireframe: false,

    // Opacity
    opacityImage: 1,

    // Z-index
    zIndexPopupBase: zIndex.dropdown,
    zIndexPopup: zIndex.notification,
```

Also add the `components` section to both `lightTheme` and `darkTheme` (add after `token` section in each):

```typescript
// Add components section to lightTheme (after the token block, before closing brace):
  components: {
    Card: {
      borderRadiusLG: radius.lg,
      headerBg: 'transparent',
      paddingLG: spacing.lg,
    },
    Button: {
      borderRadius: radius.md,
      borderRadiusSM: radius.sm,
      borderRadiusLG: radius.lg,
      defaultHoverShadow: '0 2px 4px rgba(0,0,0,0.08)',
    },
    Table: {
      borderRadiusLG: radius.sm,
      headerBg: colors.light.bg.secondary,
      rowHoverBg: colors.primary[50],
    },
    Input: {
      borderRadius: radius.md,
      hoverBorderColor: colors.primary[400],
      activeBorderColor: colors.primary[500],
      activeShadow: `0 0 0 2px ${colors.primary[100]}`,
    },
    Select: {
      borderRadius: radius.md,
    },
    Statistic: {
      contentFontSize: typography.fontSize.xxl,
    },
    Tabs: {
      borderRadiusLG: radius.sm,
    },
    Modal: {
      borderRadiusLG: radius.lg,
    },
    Popover: {
      borderRadiusLG: radius.md,
    },
  },
```

For `darkTheme`, the same `components` section should be added (identical structure).

- [ ] **Step 2: Export getAntdTheme helper function**

Add this function at the end of `theme.ts` (after `getThemeConfig`):

```typescript
import { theme as antdTheme } from 'antd';

/**
 * Get complete Ant Design theme config with component-level tokens.
 */
export function getAntdThemeConfig(themeName: 'light' | 'dark') {
  const base = themeName === 'dark' ? darkTheme : lightTheme;
  return {
    algorithm: themeName === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: base.token,
    components: base.components,
  };
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd orion-frontend && npx tsc --noEmit 2>&1 | grep "theme.ts" | head -5`
Expected: No output (no new errors in theme.ts)

- [ ] **Step 4: Commit**

```bash
cd /Users/heal/orion-design
git add orion-frontend/src/tokens/theme.ts
git commit -m "feat(tokens): extend Design Token mapping to Ant ConfigProvider

- Add spacing, motion, font size, line height, z-index tokens
- Add component-level theme overrides for Card, Button, Table, Input, etc.
- Add getAntdThemeConfig helper for complete theme generation"
```

---

### Task 2: Wire Extended Theme to ConfigProvider

**Files:**
- Modify: `src/App.tsx:1-63`
- Modify: `src/main.tsx:1-38`

- [ ] **Step 1: Update App.tsx to use getAntdThemeConfig**

Replace the entire `AppContent` component in `src/App.tsx`:

```typescript
// BEFORE (lines 23-57):
const AppContent: React.FC = () => {
  const { theme: appTheme } = useAppStore();
  const isDark = appTheme === 'dark';
  const c = isDark ? colors.dark : colors.light;

  const antdToken = {
    colorPrimary: colors.primary[500],
    colorSuccess: colors.success[500],
    colorWarning: colors.warning[500],
    colorError: colors.error[500],
    colorInfo: colors.info[500],
    colorText: c.text.primary,
    colorTextSecondary: c.text.secondary,
    colorBgContainer: c.bg.primary,
    colorBgLayout: c.bg.secondary,
    colorBorder: c.border.default,
    borderRadius: radius.md,
    borderRadiusLG: radius.lg,
    boxShadow: isDark ? shadows.dark.card : shadows.card,
    fontFamily: typography.fontFamily.base,
    fontSize: typography.fontSize.md,
  };

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: appTheme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: antdToken,
      }}
    >
      <AppRouter />
    </ConfigProvider>
  );
};

// AFTER:
import { getAntdThemeConfig } from './tokens/theme';

const AppContent: React.FC = () => {
  const { theme: appTheme } = useAppStore();
  const antdTheme = getAntdThemeConfig(appTheme === 'dark' ? 'dark' : 'light');

  return (
    <ConfigProvider
      locale={zhCN}
      theme={antdTheme}
    >
      <AppRouter />
    </ConfigProvider>
  );
};
```

Also update the imports at the top of `App.tsx`:
- Remove unused imports: `theme`, `colors`, `radius`, `shadows`, `typography` (keep `zhCN` and `ConfigProvider`)
- Add: `import { getAntdThemeConfig } from './tokens/theme';`

Full new imports for App.tsx:

```typescript
import React from 'react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppRouter from './router';
import { useAppStore } from './stores/appStore';
import { getAntdThemeConfig } from './tokens/theme';
import { injectDesignTokens } from './tokens/injectTokens';
```

- [ ] **Step 2: Update main.tsx to use getAntdThemeConfig**

Replace the entire file content of `src/main.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppRouter from './router';
import { useAppStore } from './stores/appStore';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthInitializer } from './components/AuthInitializer';
import { getAntdThemeConfig } from './tokens/theme';
import '@/assets/styles/global.css';

const AppContent: React.FC = () => {
  const { theme: appTheme } = useAppStore();
  const antdTheme = getAntdThemeConfig(appTheme === 'dark' ? 'dark' : 'light');

  return (
    <ConfigProvider locale={zhCN} theme={antdTheme}>
      <AppRouter />
    </ConfigProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthInitializer>
        <AppContent />
      </AuthInitializer>
    </ErrorBoundary>
  </React.StrictMode>
);
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd orion-frontend && npx tsc --noEmit 2>&1 | grep -v "TS6133" | head -10`
Expected: Only pre-existing errors (same as before), no new errors

- [ ] **Step 4: Run tests to verify no regressions**

Run: `cd orion-frontend && npx vitest run src/pages/__tests__/ExecutiveDashboard.test.tsx src/pages/__tests__/ManagerDashboard.test.tsx 2>&1 | tail -5`
Expected: Both test files pass

- [ ] **Step 5: Commit**

```bash
cd /Users/heal/orion-design
git add orion-frontend/src/App.tsx orion-frontend/src/main.tsx
git commit -m "feat(App): wire extended Design Tokens to ConfigProvider

- Replace inline antdToken with getAntdThemeConfig from theme.ts
- Both App.tsx and main.tsx now use unified theme generation
- Remove unused imports (colors, radius, shadows, typography)"
```

---

### Task 3: Enhance Global CSS

**Files:**
- Modify: `src/assets/styles/global.css` (append to end of file)

- [ ] **Step 1: Add visual unification CSS to global.css**

Append these styles to the end of `src/assets/styles/global.css`:

```css
/* ========================================
   Platform Visual Unification
   ======================================== */

/* Card hover effect (unified) */
.orion-card-panel:hover,
.ant-card.orion-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
  transition: box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Button hover lift (unified) */
.ant-btn:not(.ant-btn-link):not(.ant-btn-text):hover {
  transform: translateY(-1px);
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.ant-btn:not(.ant-btn-link):not(.ant-btn-text):active {
  transform: translateY(0);
}

/* Dashboard header alignment */
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.dashboard-header h1,
.dashboard-header .ant-typography {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  line-height: 1.2;
}

.dashboard-header .subtitle {
  margin-top: 4px;
  font-size: 14px;
  color: var(--text-secondary, #434343);
}

/* Section spacing standard */
.page-section {
  margin-bottom: 24px;
}

.page-section:last-child {
  margin-bottom: 0;
}

/* Chart container consistency */
.chart-container {
  padding: 16px 0;
}

/* Table header style unification */
.ant-table-thead > tr > th {
  font-weight: 600;
}

/* Statistic card alignment */
.ant-statistic {
  text-align: center;
}
```

- [ ] **Step 2: Verify no CSS syntax issues**

Run: `cd orion-frontend && head -350 src/assets/styles/global.css | tail -60`
Expected: Clean CSS output, no syntax errors

- [ ] **Step 3: Commit**

```bash
cd /Users/heal/orion-design
git add orion-frontend/src/assets/styles/global.css
git commit -m "style(global.css): add platform visual unification CSS

- Unified card hover shadow + translateY effect
- Button hover lift with smooth transition
- Dashboard header alignment (flex, space-between)
- Standard section spacing (24px)
- Chart container padding, table header weight, statistic alignment"
```

---

### Task 4: Create DataState Component

**Files:**
- Create: `src/components/DataState/index.tsx`
- Create: `src/components/DataState/__tests__/index.test.tsx`

- [ ] **Step 1: Write tests first**

Create `src/components/DataState/__tests__/index.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DataState from '../index';

describe('DataState', () => {
  const TestContent = () => <div data-testid="content">Page Content</div>;

  it('renders children when not loading, no error, not empty', () => {
    render(
      <DataState loading={false}>
        <TestContent />
      </DataState>
    );
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('shows loading spinner when loading is true', () => {
    render(
      <DataState loading={true}>
        <TestContent />
      </DataState>
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows error result with retry button', () => {
    const retryFn = vi.fn();
    const err = new Error('Network error');
    render(
      <DataState loading={false} error={err} retry={retryFn}>
        <TestContent />
      </DataState>
    );
    expect(screen.getByText('Network error')).toBeInTheDocument();
    expect(screen.getByText('重试')).toBeInTheDocument();
    fireEvent.click(screen.getByText('重试'));
    expect(retryFn).toHaveBeenCalledTimes(1);
  });

  it('shows empty state with custom text', () => {
    render(
      <DataState loading={false} empty={true} emptyText="No data found">
        <TestContent />
      </DataState>
    );
    expect(screen.getByText('No data found')).toBeInTheDocument();
  });

  it('shows empty state with action button', () => {
    render(
      <DataState
        loading={false}
        empty={true}
        emptyText="No records"
        emptyAction={<button data-testid="create-btn">Create New</button>}
      />
    );
    expect(screen.getByTestId('create-btn')).toBeInTheDocument();
  });

  it('priority: loading > error > empty', () => {
    const err = new Error('test');
    render(
      <DataState loading={true} error={err} empty={true}>
        <TestContent />
      </DataState>
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('test')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd orion-frontend && npx vitest run src/components/DataState 2>&1 | tail -5`
Expected: FAIL — module not found

- [ ] **Step 3: Create DataState component**

Create `src/components/DataState/index.tsx`:

```tsx
/**
 * DataState — Unified loading/error/empty state overlay.
 *
 * Replaces ad-hoc patterns across pages:
 *   - loading → Ant Spin full overlay
 *   - error   → Ant Result with retry
 *   - empty   → Ant Empty with optional action
 *
 * Priority: loading > error > empty > children
 */
import React from 'react';
import { Spin, Result, Empty, Button } from 'antd';
import { colors } from '@/tokens/colors';

export interface DataStateProps {
  loading: boolean;
  error?: Error | null;
  empty?: boolean;
  emptyText?: string;
  emptyAction?: React.ReactNode;
  children?: React.ReactNode;
  retry?: () => void;
}

const DataState: React.FC<DataStateProps> = ({
  loading,
  error,
  empty,
  emptyText = '暂无数据',
  emptyAction,
  children,
  retry,
}) => {
  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '200px',
        }}
        role="status"
        aria-busy="true"
      >
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (error) {
    return (
      <Result
        status="error"
        title="加载失败"
        subTitle={error.message}
        extra={
          retry && (
            <Button
              type="primary"
              onClick={retry}
              style={{
                backgroundColor: colors.primary[500],
                borderColor: colors.primary[500],
              }}
            >
              重试
            </Button>
          )
        }
      />
    );
  }

  if (empty) {
    return (
      <Empty description={emptyText} image={Empty.PRESENTED_IMAGE_SIMPLE}>
        {emptyAction}
      </Empty>
    );
  }

  return <>{children}</>;
};

export default DataState;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd orion-frontend && npx vitest run src/components/DataState 2>&1 | tail -8`
Expected: 6 tests pass

- [ ] **Step 5: Commit**

```bash
cd /Users/heal/orion-design
git add orion-frontend/src/components/DataState/
git commit -m "feat(DataState): create unified loading/error/empty state component

- loading: Spin with full overlay and aria-busy
- error: Result with error icon and retry button
- empty: Empty with custom text and optional action
- Priority: loading > error > empty > children
- 6 test cases covering all states and priority"
```

---

### Task 5: Deprecate CardPanel

**Files:**
- Modify: `src/components/CardPanel/index.tsx:1-121`

- [ ] **Step 1: Add deprecation warning and orion-card class**

Modify `src/components/CardPanel/index.tsx`. Add the deprecation warning at the top of the component function (after the useState line):

```tsx
// Add this import at the top:
import { useEffect } from 'react';

// Add inside the CardPanel function, after the internalCollapsed useState line:
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.warn(
        '[Orion] CardPanel is deprecated. Use Ant Design <Card> with className="orion-card" instead.'
      );
    }
  }, []);
```

Add `className="orion-card-panel orion-card"` to the Card element (replace the existing className prop):

```tsx
// BEFORE:
      className="orion-card-panel"

// AFTER:
      className="orion-card-panel orion-card"
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd orion-frontend && npx tsc --noEmit 2>&1 | grep "CardPanel" | head -5`
Expected: No output

- [ ] **Step 3: Commit**

```bash
cd /Users/heal/orion-design
git add orion-frontend/src/components/CardPanel/index.tsx
git commit -m "deprecate(CardPanel): add dev-mode warning and orion-card class

- Console warning in dev mode directing users to Ant Card
- Add orion-card class for unified hover effect via global.css
- CardPanel remains functional for backward compatibility"
```

---

### Task 6: End-to-End Verification

- [ ] **Step 1: TypeScript type check**

Run: `cd orion-frontend && npx tsc --noEmit 2>&1 | grep -v "TS6133" | head -15`
Expected: Only pre-existing errors (iac-routes, WorkspaceService, PolicyService, SbomDocumentService). No new errors from our changes.

- [ ] **Step 2: Run full test suite**

Run: `cd orion-frontend && npx vitest run 2>&1 | tail -8`
Expected: All test files pass, no new failures

- [ ] **Step 3: Visual smoke test — build**

Run: `cd orion-frontend && npm run build 2>&1 | tail -10`
Expected: Build succeeds, no errors

- [ ] **Step 4: Commit final verification (if any test fixes needed)**

If tests fail due to ConfigProvider theme changes, fix and commit:
```bash
cd /Users/heal/orion-design
git add orion-frontend/
git commit -m "fix: address ConfigProvider theme test regressions"
```

---

## Self-Review

1. **Spec coverage:** All 5 phases from the design spec have corresponding tasks:
   - Phase 1 (ConfigProvider) → Tasks 1-2
   - Phase 2 (Global CSS) → Task 3
   - Phase 3 (DataState) → Task 4
   - Phase 4 (CardPanel deprecation) → Task 5
   - Verification → Task 6

2. **No placeholders:** Every step has actual code, exact file paths, and exact commands.

3. **Type consistency:** `getAntdThemeConfig` return type matches Ant Design `ConfigProvider['theme']` prop. `DataStateProps` interface is consistent between test and implementation.

4. **Task independence:** Each task produces working, testable code:
   - Task 1-2: Theme works immediately (existing ConfigProvider picks it up)
   - Task 3: CSS effects are global and immediate
   - Task 4: DataState is a standalone importable component
   - Task 5: CardPanel warning is independent
