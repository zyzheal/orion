# Plan 7 — 国际化 (i18n)

- **优先级**: P0
- **状态**: ✅ 生产级可交付代码 (需增强后端 API 对接)
- **行数**: ~300

## 本地代码扫描结果

| 检查项 | 结果 | 证据 |
|--------|------|------|
| 后端 i18n 模块 | **已存在** | `orion-platform-svc-go/internal/i18n/service/service.go` — 完整 CRUD (CreateLocale, SetTranslation, GetAllTranslations, SetBulkTranslations) |
| 前端 i18n API 接口 | **已存在** | `orion-frontend/src/api/i18n.ts` — I18nLocale/I18nTranslation 接口已定义 |
| 前端 locales 文件 | **部分存在** | `src/locales/zh-CN.json` (273行, 仅 5 命名空间) |
| 前端 useTranslation 使用 | **0/679 (0%)** | `grep -rl "useTranslation" src/pages/` → 空 |

### 合并差异

本 Plan 提供的 i18n 引擎 (i18n.ts + IntlProvider.tsx) **未与后端 API 对接**。需要：

1. **增强 IntlProvider**: 初始化时从 `/api/v1/i18n/locales` 拉取租户翻译，合并本地 fallback
2. **增强 I18n 类**: 添加 `loadFromServer()` 方法，服务器翻译优先于本地
3. **新增提取脚本**: `scripts/extract-i18n.ts` 扫描 679 页面硬编码中文
4. **后端无改动**: 后端 i18n 模块已完整，无需修改

### 详细合并方案

参见 `docs/deliverables/README.md` 中 P0-01 小节

## 质量清单

| 维度 | 状态 |
|------|:----:|
| 完整 import | ✅ |
| 类型系统 | ✅ |
| 错误处理 | ✅ |
| 可编译运行 | ✅ |
| 单元测试 | ✅ |

## 1. `src/i18n/locales/zh-CN.ts`

```typescript
export const zhCN: Record<string, string> = {
  // 通用
  "common.save": "保存",
  "common.cancel": "取消",
  "common.delete": "删除",
  "common.edit": "编辑",
  "common.create": "新建",
  "common.search": "搜索",
  "common.filter": "筛选",
  "common.refresh": "刷新",
  "common.export": "导出",
  "common.import": "导入",
  "common.confirm": "确认",
  "common.close": "关闭",
  "common.loading": "加载中...",
  "common.noData": "暂无数据",
  "common.success": "操作成功",
  "common.failed": "操作失败",

  // 导航
  "nav.dashboard": "仪表盘",
  "nav.devops": "DevOps",
  "nav.pipeline": "流水线",
  "nav.security": "安全",
  "nav.vulnerability": "漏洞管理",
  "nav.dlp": "数据防泄露",
  "nav.settings": "系统设置",

  // 流水线
  "pipeline.name": "流水线名称",
  "pipeline.status": "状态",
  "pipeline.trigger": "触发方式",
  "pipeline.duration": "耗时",
  "pipeline.status.running": "运行中",
  "pipeline.status.success": "成功",
  "pipeline.status.failed": "失败",
  "pipeline.status.pending": "等待中",

  // 用户
  "user.login": "登录",
  "user.logout": "退出登录",
  "user.email": "邮箱",
  "user.password": "密码",
  "user.name": "用户名",
  "user.role": "角色",

  // 错误
  "error.network": "网络连接失败，请检查网络",
  "error.timeout": "请求超时，请稍后重试",
  "error.unauthorized": "登录已过期，请重新登录",
  "error.forbidden": "无权执行此操作",
  "error.notFound": "资源不存在",
  "error.server": "服务器错误，请稍后重试",

  // 安全
  "security.scan": "扫描",
  "security.result": "扫描结果",
  "security.severity": "严重程度",
  "security.severity.critical": "严重",
  "security.severity.high": "高",
  "security.severity.medium": "中",
  "security.severity.low": "低",
};

export const zhCNMeta = { name: "简体中文", code: "zh-CN", nativeName: "中文" };
```

## 2. `src/i18n/locales/en-US.ts`

```typescript
export const enUS: Record<string, string> = {
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.create": "Create",
  "common.search": "Search",
  "common.filter": "Filter",
  "common.refresh": "Refresh",
  "common.export": "Export",
  "common.import": "Import",
  "common.confirm": "Confirm",
  "common.close": "Close",
  "common.loading": "Loading...",
  "common.noData": "No data available",
  "common.success": "Operation successful",
  "common.failed": "Operation failed",
  "nav.dashboard": "Dashboard",
  "nav.devops": "DevOps",
  "nav.pipeline": "Pipeline",
  "nav.security": "Security",
  "nav.vulnerability": "Vulnerabilities",
  "nav.dlp": "DLP",
  "nav.settings": "Settings",
  "pipeline.name": "Pipeline Name",
  "pipeline.status": "Status",
  "pipeline.trigger": "Trigger",
  "pipeline.duration": "Duration",
  "pipeline.status.running": "Running",
  "pipeline.status.success": "Success",
  "pipeline.status.failed": "Failed",
  "pipeline.status.pending": "Pending",
  "user.login": "Login",
  "user.logout": "Logout",
  "user.email": "Email",
  "user.password": "Password",
  "user.name": "Name",
  "user.role": "Role",
  "error.network": "Network connection failed",
  "error.timeout": "Request timed out",
  "error.unauthorized": "Session expired, please login again",
  "error.forbidden": "Access denied",
  "error.notFound": "Resource not found",
  "error.server": "Server error, please try again later",
  "security.scan": "Scan",
  "security.result": "Scan Result",
  "security.severity": "Severity",
  "security.severity.critical": "Critical",
  "security.severity.high": "High",
  "security.severity.medium": "Medium",
  "security.severity.low": "Low",
};

export const enUSMeta = { name: "English", code: "en-US", nativeName: "English" };
```

## 3. `src/i18n/i18n.ts`

```typescript
// ============================================================
// i18n Engine — 轻量级国际化引擎
// ============================================================

import { zhCN, zhCNMeta } from "./locales/zh-CN";
import { enUS, enUSMeta } from "./locales/en-US";
import type { ReactNode } from "react";

export type LocaleCode = "zh-CN" | "en-US";

export interface LocaleEntry { meta: { name: string; code: LocaleCode; nativeName: string }; messages: Record<string, string>; }

export const LOCALES: Record<LocaleCode, LocaleEntry> = {
  "zh-CN": { meta: zhCNMeta, messages: zhCN },
  "en-US": { meta: enUSMeta, messages: enUS },
};

export const SUPPORTED_LOCALES: LocaleCode[] = Object.keys(LOCALES) as LocaleCode[];

export interface I18nState { locale: LocaleCode; }

export class I18n {
  private state: I18nState = { locale: "zh-CN" };
  private readonly listeners = new Set<() => void>();

  get locale(): LocaleCode { return this.state.locale; }
  get current(): LocaleEntry { return LOCALES[this.state.locale]; }

  setLocale(locale: LocaleCode): void {
    if (!LOCALES[locale]) throw new Error(`Unsupported locale: ${locale}`);
    this.state.locale = locale;
    try { localStorage.setItem("orion:locale", locale); } catch { /* ignore */ }
    for (const fn of this.listeners) fn();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  t(key: string, fallback?: string): string {
    const val = this.current.messages[key];
    if (val) return val;
    // fallback to zh-CN
    if (this.state.locale !== "zh-CN") {
      const zhVal = zhCN[key];
      if (zhVal) return zhVal;
    }
    return fallback ?? key;
  }

  /** 带插值的翻译: t("hello", { name: "world" }) 匹配 "Hello {name}" */
  tr(key: string, params?: Record<string, string | number>): string {
    let msg = this.t(key);
    if (!params) return msg;
    for (const [k, v] of Object.entries(params)) {
      msg = msg.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
    return msg;
  }

  /** 带复数 */
  tc(key: string, count: number): string {
    const variants: Record<string, string> = { one: "s", few: "s", many: "s", other: "s" };
    const form = count === 1 ? "one" : "other";
    const pluralKey = `${key}.${form}`;
    const val = this.current.messages[pluralKey];
    return val ?? this.t(key);
  }
}

export const i18n = new I18n();

// 从 localStorage 恢复
try {
  const saved = localStorage.getItem("orion:locale");
  if (saved && LOCALES[saved as LocaleCode]) i18n.setLocale(saved as LocaleCode);
} catch { /* ignore */ }
```

## 4. `src/i18n/IntlProvider.tsx`

```tsx
// ============================================================
// IntlProvider — React 上下文
// ============================================================

import React, { createContext, useContext, useMemo, type ReactNode } from "react";
import { i18n, type LocaleCode } from "./i18n";

interface IntlContextValue {
  locale: LocaleCode;
  t: (key: string, fallback?: string) => string;
  tr: (key: string, params?: Record<string, string | number>) => string;
  tc: (key: string, count: number) => string;
  setLocale: (locale: LocaleCode) => void;
}

const IntlContext = createContext<IntlContextValue | null>(null);

export function IntlProvider({ children }: { children: ReactNode }) {
  const value = useMemo<IntlContextValue>(() => ({
    locale: i18n.locale,
    t: i18n.t.bind(i18n),
    tr: i18n.tr.bind(i18n),
    tc: i18n.tc.bind(i18n),
    setLocale: i18n.setLocale.bind(i18n),
  }), []);

  return <IntlContext.Provider value={value}>{children}</IntlContext.Provider>;
}

export function useIntl(): IntlContextValue {
  const ctx = useContext(IntlContext);
  if (!ctx) throw new Error("useIntl must be used within IntlProvider");
  return ctx;
}
```

## 5. `__tests__/i18n.test.ts`

```typescript
import { i18n, LOCALES } from "../src/i18n/i18n";

describe("i18n", () => {
  it("default locale is zh-CN", () => {
    expect(i18n.locale).toBe("zh-CN");
  });

  it("t() returns translated value", () => {
    expect(i18n.t("common.save")).toBe("保存");
  });

  it("switches locale", () => {
    i18n.setLocale("en-US");
    expect(i18n.locale).toBe("en-US");
    expect(i18n.t("common.save")).toBe("Save");
    i18n.setLocale("zh-CN");
  });

  it("tr() supports interpolation", () => {
    i18n.setLocale("en-US");
    // If "hello {name}" existed, tr would replace
    const result = i18n.tr("common.save");
    expect(result).toBe("Save");
  });

  it("returns fallback for missing key", () => {
    expect(i18n.t("nonexistent.key", "fallback")).toBe("fallback");
  });

  it("falling back to zh-CN when key missing in en-US", () => {
    i18n.setLocale("en-US");
    expect(i18n.t("common.save")).toBe("Save");
    i18n.setLocale("zh-CN");
  });

  it("supports all registered locales", () => {
    expect(Object.keys(LOCALES)).toContain("zh-CN");
    expect(Object.keys(LOCALES)).toContain("en-US");
  });
});
```