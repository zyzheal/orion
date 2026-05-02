# Platform Visual Unification Design (ConfigProvider + Global CSS)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify visual consistency across all 72 frontend pages via ConfigProvider theme tokens, global CSS reset, and minimal new components

**Architecture:** Ant Design ConfigProvider + Design Tokens integration + 1 new DataState component + delete CardPanel

**Tech Stack:** Ant Design v5 ConfigProvider, React, TypeScript, CSS-in-JS (Ant Design style system)

---

## Problem Statement

Orion frontend has 72 pages and 7 Dashboards with inconsistent visual styles:
- Card components use different border-radius, shadow, padding across pages
- Loading/error/empty states implemented ad-hoc (each page does it differently)
- Section spacing is inconsistent (some use `marginBottom: 16`, others `24`, others `32`)
- Button hover effects vary (some lift, some just color change)
- Dashboard headers are misaligned (title positioning differs)
- 2+ competing card components (`CardPanel`, Ant `Card`, raw `div.section`)

---

## Approach

### Strategy: ConfigProvider + Global CSS + 1 Component

| Layer | What | Scope |
|-------|------|-------|
| **ConfigProvider** | Ant Design theme token mapping from Design Tokens | Global, 1 file |
| **Global CSS** | Page background, section spacing, header alignment | Global, 1 file |
| **DataState** | Unified loading/error/empty overlay component | New, 1 component |
| **CardPanel removal** | Delete wrapper, use Ant `Card` via ConfigProvider | Global effect |

**Why not build PageShell / SectionCard?**
- Ant Design already provides `Card`, `Layout`, `Typography` — ConfigProvider makes them consistent
- Building new wrappers adds indirection and maintenance burden
- 90% of visual unity via ConfigProvider theme tokens; 10% via global CSS

---

## Implementation

### Phase 1: ConfigProvider Theme Mapping

**File:** `orion-frontend/src/tokens/theme.ts` (existing, extend)

Map Design Tokens to Ant Design v5 theme tokens:

```typescript
import { theme } from 'antd';
import { colors, spacing, radius, shadows, typography, animation } from './index';

export const antdTheme = {
  token: {
    // Colors from Design Tokens
    colorPrimary: colors.primary[500],
    colorSuccess: colors.success[500],
    colorWarning: colors.warning[500],
    colorError: colors.error[500],
    colorInfo: colors.primary[500],

    // Spacing from Design Tokens
    paddingXS: spacing.xs,    // 4px
    paddingSM: spacing.sm,    // 8px
    padding: spacing.md,      // 16px
    paddingLG: spacing.lg,    // 24px
    paddingXL: spacing.xl,    // 32px

    // Border radius from Design Tokens
    borderRadiusSM: radius.sm,  // 4px
    borderRadius: radius.md,    // 6px
    borderRadiusLG: radius.lg,  // 10px
    borderRadiusXS: radius.xs,  // 2px

    // Typography from Design Tokens
    fontSizeSM: 12,
    fontSize: 14,
    fontSizeLG: 16,
    fontSizeXL: 20,
    fontFamily: typography.fontFamily,

    // Shadows from Design Tokens
    boxShadow: shadows.sm,
    boxShadowSecondary: shadows.md,
    boxShadowTertiary: shadows.lg,

    // Animation from Design Tokens
    motionDurationFast: `${animation.duration.fast}ms`,
    motionDurationMid: `${animation.duration.normal}ms`,
    motionDurationSlow: `${animation.duration.slow}ms`,
    motionEaseInOut: animation.easing.easeInOut,
    motionEaseOut: animation.easing.easeOut,

    // Component defaults
    componentSize: 'middle',
    wireframe: false,
  },
  components: {
    Card: {
      borderRadiusLG: radius.lg,
      boxShadowTertiary: shadows.md,
      paddingLG: spacing.lg,
    },
    Button: {
      borderRadius: radius.md,
      defaultHoverShadow: `0 ${shadows.sm}`,
    },
    Table: {
      borderRadiusLG: radius.sm,
      headerBg: '#fafafa',
      rowHoverBg: colors.primary[50],
    },
    Input: {
      borderRadius: radius.md,
      hoverBorderColor: colors.primary[400],
      activeBorderColor: colors.primary[500],
    },
    Statistic: {
      contentFontSize: 24,
    },
  },
};
```

**File:** `orion-frontend/src/App.tsx` (modify)

Wrap entire app with ConfigProvider using mapped theme:

```tsx
import { ConfigProvider } from 'antd';
import { antdTheme } from './tokens/theme';

function App() {
  return (
    <ConfigProvider theme={antdTheme}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ConfigProvider>
  );
}
```

### Phase 2: Global CSS Reset & Spacing

**File:** `orion-frontend/src/styles/global.css` (create)

```css
/* Page background consistency */
body {
  background-color: var(--ant-color-bg-layout, #f0f2f5);
  margin: 0;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Section spacing standard */
.page-section {
  margin-bottom: 24px; /* spacing.lg */
}

.page-section:last-child {
  margin-bottom: 0;
}

/* Card hover effect (unified) */
.orion-card {
  transition: box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.orion-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

/* Button hover lift (unified) */
.ant-btn:hover {
  transform: translateY(-1px);
}

.ant-btn:active {
  transform: translateY(0);
}

/* Dashboard header alignment */
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.dashboard-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.dashboard-header .subtitle {
  margin-top: 4px;
  font-size: 14px;
  color: #666;
}

/* Scrollbar styling (optional, webkit only) */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #d9d9d9;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #bfbfbf;
}
```

**File:** `orion-frontend/src/main.tsx` (modify)

Add import for global CSS:

```tsx
import './styles/global.css';
```

### Phase 3: DataState Component

**File:** `orion-frontend/src/components/DataState/index.tsx` (create)

Unified loading/error/empty overlay component. Replaces ad-hoc patterns across pages.

```typescript
interface DataStateProps {
  loading: boolean;
  error?: Error | null;
  empty?: boolean;
  emptyText?: string;
  emptyAction?: React.ReactNode;
  children: React.ReactNode;
  retry?: () => void;
}
```

Rendering logic:
- `loading` → Ant `Spin` with full overlay
- `error` → Ant `Result` with error icon + retry button
- `empty` → Ant `Empty` with optional action button
- default → render children

### Phase 4: CardPanel Deprecation

**File:** `orion-frontend/src/components/CardPanel/index.tsx` (modify)

Add deprecation warning in dev mode. Update internal implementation to simply wrap Ant `Card` with `className="orion-card"`.

```typescript
if (import.meta.env.DEV) {
  console.warn('[Orion] CardPanel is deprecated. Use Ant Design <Card> with ConfigProvider theme instead.');
}
```

### Phase 5: Migration Guide

Document how existing pages should migrate:

**Before:**
```tsx
<CardPanel title="Section Title" extra={<Button>...</Button>}>
  {loading ? <Spin /> : error ? <Alert /> : <Content />}
</CardPanel>
```

**After:**
```tsx
<DataState loading={loading} error={error} retry={loadData}>
  <Card title="Section Title" extra={<Button>...</Button>} className="orion-card">
    <Content />
  </Card>
</DataState>
```

---

## Acceptance Criteria

1. `ConfigProvider` wraps entire app in `App.tsx` with Design Token mapped theme
2. `global.css` provides consistent page background, section spacing, card hover
3. `DataState` component with tests (loading, error, empty, normal states)
4. All existing Dashboards render correctly with unified theme
5. `CardPanel` shows deprecation warning in dev mode
6. `npx tsc --noEmit` no new errors
7. `npx vitest run` all passing
8. Visual review: all Card components have same border-radius, shadow, padding

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| ConfigProvider breaks existing Card styles | Medium | Test all 7 Dashboards before proceeding |
| Global CSS conflicts with existing inline styles | Low | Use CSS specificity rules, test per page |
| CardPanel deprecation breaks pages that depend on its unique behavior | Medium | Keep CardPanel functional, only warn |

---

## Implementation Order

1. ConfigProvider theme mapping → verify Dashboards
2. Global CSS → verify layout consistency
3. DataState component → tests
4. CardPanel deprecation → verify no breaks
5. Phase 2: Migrate high-traffic pages (Dashboards first)
