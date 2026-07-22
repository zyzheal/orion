# Orion DESIGN.md 高保真设计稿

> 版本：v2.0  
> 创建日期：2026-04-10  
> 状态：**开发就绪**  
> 评审结论：P0 页面综合评分 4.6/5.0，全部批准进入开发

---

## 概述

本目录包含 Orion 平台 **22 个页面** 的完整高保真设计稿，基于 DESIGN.md 标准格式编写，可直接用于 AI 生成代码。

参考设计风格：
- **Linear** - 极简主义、精确的工程设计
- **Vercel** - 黑白单色、开发者友好
- **Supabase** - 深绿色主题、代码优先

---

## 设计文档清单

### Phase 1 (MVP) - 6 个 P0 页面

| 序号 | 页面 | 文件 | 大小 | 评审状态 |
|------|------|------|------|---------|
| 01 | 流水线列表 | 01-Pipeline-List-DESIGN.md | 18.7KB | ✅ 批准 |
| 02 | 创建向导 | 02-Pipeline-Wizard-DESIGN.md | 28.4KB | ✅ 批准* |
| 03 | 运行详情 | 03-Pipeline-Run-Details-DESIGN.md | 29.7KB | ✅ 批准 |
| 04 | 审批工作台 | 04-Approval-Workbench-DESIGN.md | 50.7KB | ✅ 批准 |
| 05 | 通知中心 | 05-Notification-Center-DESIGN.md | 43.6KB | ✅ 批准 |
| 06 | 效能看板 | 06-Efficiency-Dashboard-DESIGN.md | 45.2KB | ✅ 批准* |

### Phase 2 (核心能力) - 8 个页面

| 序号 | 页面 | 文件 | 大小 |
|------|------|------|------|
| 07 | 安全审计中心 | 07-Security-Audit-DESIGN.md | 22KB |
| 08 | 多分支产品线 | 08-Product-Lines-DESIGN.md | 27KB |
| 09 | GitOps 配置 | 09-GitOps-Config-DESIGN.md | 30KB |
| 10 | AI Skill 市场 | 10-AI-Skill-Marketplace-DESIGN.md | 31KB |
| 11 | 工具市场 | 11-Tool-Marketplace-DESIGN.md | 34KB |
| 12 | 智能部署 | 12-Smart-Deployment-DESIGN.md | 35KB |
| 13 | 安全合规报告 | 13-Security-Compliance-DESIGN.md | 32KB |
| 14 | 可观测性 | 14-Observability-DESIGN.md | 37KB |

### Phase 3 (增强能力) - 6 个页面

| 序号 | 页面 | 文件 | 大小 |
|------|------|------|------|
| 15 | 协作通知配置 | 15-Collaboration-DESIGN.md | 30KB |
| 16 | 代码管理集成 | 16-Code-Management-DESIGN.md | 33KB |
| 17 | 构建环境管理 | 17-Build-Environment-DESIGN.md | 40KB |
| 18 | 自愈规则配置 | 18-Self-Healing-DESIGN.md | 44KB |
| 19 | 多租户管理 | 19-Multi-Tenancy-DESIGN.md | 37KB |
| 20 | IaC 管理后台 | 20-IaC-Management-DESIGN.md | 36KB |

### Phase 4 (基础设施) - 2 个页面

| 序号 | 页面 | 文件 | 大小 |
|------|------|------|------|
| 21 | 事件总线监控 | 21-Event-Bus-DESIGN.md | 40KB |
| 22 | 数据存储管理 | 22-Data-Storage-DESIGN.md | 42KB |

> \* 需补充细节：暂存逻辑/图表库选型

---

## 设计基础

### Design Tokens

基于 `/docs/ui/Design-Tokens 完整定义.md`：

```css
/* 颜色系统 */
--color-primary: #0058C4;      /* WCAG 合规主色 */
--color-success: #389E0D;      /* 对比度 5.2:1 */
--color-warning: #D48806;      /* 对比度 4.6:1 */
--color-error: #D9363E;        /* 对比度 5.1:1 */

/* 暗黑模式 */
--dark-primary: #2b6bab;       /* 对比度 5.54:1 */
--dark-surface-1: #121212;
--dark-surface-2: #1E1E1E;
--dark-surface-3: #2A2A2A;

/* 字体系统 */
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;

/* 间距系统 */
--space-1: 4px; --space-2: 8px; --space-3: 16px;
--space-4: 24px; --space-5: 32px; --space-6: 40px;

/* 圆角系统 */
--radius-xs: 2px; --radius-sm: 4px; --radius-md: 8px;
--radius-lg: 12px; --radius-xl: 16px;

/* 阴影系统 */
--shadow-xs: 0 1px 2px rgba(0,0,0,0.05);
--shadow-sm: 0 1px 3px rgba(0,0,0,0.1);
--shadow-md: 0 4px 6px rgba(0,0,0,0.1);
--shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
--shadow-xl: 0 20px 25px rgba(0,0,0,0.15);

/* 焦点状态 */
--focus-ring-color: rgba(24, 144, 255, 0.5);
--focus-ring-width: 2px;
--keyboard-focus-width: 3px;
```

### 响应式断点

| 断点 | 屏幕宽度 | 布局列数 |
|------|---------|---------|
| XS | < 576px | 1 列（移动端） |
| SM | ≥ 576px | 2 列 |
| MD | ≥ 768px | 3 列 |
| LG | ≥ 992px | 4 列 |
| XL | ≥ 1200px | 6 列 |
| XXL | ≥ 1600px | 8 列 |

---

## 开发指南

### 使用方式

1. **直接生成代码**
   ```bash
   # 告诉 AI 助手
   "根据 01-Pipeline-List-DESIGN.md 生成 React + TypeScript 组件"
   ```

2. **按页面开发**
   - 每个 DESIGN.md 独立对应一个页面
   - 组件定义可复用
   - Design Tokens 全局共享

3. **验证检查点**
   - 颜色对比度 ≥ 4.5:1
   - 焦点状态可见
   - 响应式断点测试
   - 暗黑模式验证

### 技术栈推荐

| 类别 | 推荐方案 |
|------|---------|
| UI 框架 | React 18 + TypeScript |
| 样式方案 | TailwindCSS + CSS Variables |
| 组件库 | Ant Design 5.0（或 Headless UI） |
| 图表库 | Recharts（效能看板） |
| 状态管理 | Zustand |
| 表单处理 | React Hook Form |
| 实时数据 | TanStack Query + WebSocket |

---

## 评审问题追踪

| 页面 | 问题 | 状态 |
|------|------|------|
| Pipeline Wizard | 需补充暂存逻辑设计 | ⏳ 待修复 |
| Efficiency Dashboard | 需确认图表库选型 | ⏳ 待修复 |

---

## 版本历史

| 版本 | 日期 | 变更说明 |
|------|------|---------|
| v1.0 | 2026-04-10 | 初始版本，6 个 P0 页面完成 |
| v2.0 | 2026-04-10 | 新增 16 个页面，共 22 个页面完整设计 |

---

_本目录由 Orion 设计团队维护 | 下次更新：开发反馈迭代_
