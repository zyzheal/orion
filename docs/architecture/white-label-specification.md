# White Label Specification (白标/品牌化规范)

**文档版本**: v1.0  
**创建日期**: 2026-04-10  
**状态**: 待评审  
**作者**: Orion Architecture Team  
**评审人**: 架构委员会  

---

## 执行摘要 (Executive Summary)

本设计文档详细描述 Orion 平台的白标（White Label）系统架构，支持多租户品牌定制化需求。

### 白标能力总览

| 能力域 | 核心功能 | 配置方式 | 生效时机 |
|--------|---------|---------|---------|
| **品牌标识** | Logo、名称、标语 | 管理 UI / API | 运行时 |
| **主题配色** | 主色、辅色、语义色 | JSON 配置 | 运行时 |
| **字体排印** | 中英文字体、等宽字体 | JSON 配置 | 页面加载 |
| **图标系统** | 图标库、自定义图标 | 资源上传 | 按需加载 |
| **文案定制** | 产品名称、帮助文档、错误消息 | 管理 UI | 运行时 |

### 预期收益

| 指标 | 当前 | 目标 | 改善 |
|------|------|------|------|
| 品牌定制上线时间 | 2 周 | 5 分钟 | 99% |
| 多租户品牌隔离 | 不支持 | 完全隔离 | 新增 |
| 品牌切换延迟 | N/A | < 100ms | 新增 |

---

## 一、设计背景与理由

### 1.1 业务需求

| 场景 | 问题 | 优先级 |
|------|------|--------|
| 企业客户品牌化 | 要求使用自有品牌 | P0 |
| SaaS 多租户 | 独立品牌标识 | P0 |
| OEM 合作 | 贴牌部署 | P1 |
| 国际化 | 多语言文案 | P1 |

### 1.2 当前问题

**问题 1: 硬编码品牌元素**

| 硬编码项 | 出现位置 | 影响 |
|---------|---------|------|
| "Orion" 产品名称 | 50+ 文件 | 全局 |
| Logo 路径 | 15 文件 | 登录页、导航栏 |
| 主色 `#0070F3` | 30+ CSS 文件 | 全局样式 |

**问题 2: 缺乏品牌隔离**

| 场景 | 当前行为 | 期望行为 |
|------|---------|---------|
| 租户上传 Logo | 覆盖全局 Logo | 仅该租户可见 |
| 租户修改主色 | 全局生效 | 仅该租户生效 |

### 1.3 业界参考

| 公司 | 方案 | 特性 |
|------|------|------|
| Slack | Enterprise Grid | 租户级 Logo、配色、域名 |
| Atlassian | Cloud Platform | 品牌配置中心、预览、发布 |
| Shopify | Plus | 完全自定义 storefront |

---

## 二、设计目标与原则

### 2.1 目标

| 目标 | 指标 | 验证方法 |
|------|------|---------|
| 切换延迟 | < 100ms | 性能测试 |
| 配置加载 | < 500ms | 首屏性能 |
| 存储开销 | < 10KB/品牌 | 数据库统计 |
| 缓存命中率 | > 95% | 监控指标 |

### 2.2 原则

| 原则 | 说明 | 验证标准 |
|------|------|---------|
| **运行时切换** | 无需刷新 | < 100ms 生效 |
| **级联继承** | 默认继承，支持覆盖 | 可配置继承链 |
| **原子化 Token** | Design Tokens 为最小单位 | Token 可独立变更 |
| **预览即所得** | 配置实时预览 | WYSIWYG |

---

## 三、白标架构

### 3.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Orion White Label Architecture                      │
└─────────────────────────────────────────────────────────────────────────────────┘

                                    ┌──────────────┐
                                    │   Browser    │
                                    │ (Client App) │
                                    └──────┬───────┘
                                           │ 1. 请求品牌配置
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Brand Configuration Layer                               │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                   API Gateway + Brand Resolver                               ││
│  │  ┌─────────────┐   ┌─────────────┐   ┌─────────────────────────────────┐   ││
│  │  │  Tenant     │ → │   Brand     │ → │    Brand Config Cache (Redis)   │   ││
│  │  │  Detector   │   │  Resolver   │   │    TTL: 5min, LRU               │   ││
│  │  └─────────────┘   └─────────────┘   └─────────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
                                           │ 2. 返回品牌配置 (JSON)
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            Theme Engine (Client-Side)                            │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                     Design Tokens Transformer                                ││
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌───────────────────┐  ││
│  │  │ CSS Variable │ │  Color       │ │  Font        │ │  Icon             │  ││
│  │  │ Generator    │ │  Transformer │ │  Mapper      │ │  Replacer         │  ││
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └───────────────────┘  ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                   │                                             │
│                                   ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                    CSS Custom Properties                                     ││
│  │  :root {                                                                     ││
│  │    --brand-primary-500: #0070F3;                                             ││
│  │    --brand-logo-url: url('/logo.svg');                                       ││
│  │    --brand-font-family: 'Inter', sans-serif;                                 ││
│  │  }                                                                           ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Persistence Layer                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                    PostgreSQL (Brand Config DB)                              ││
│  │  brands │ brand_themes │ brand_assets                                        ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 核心组件

| 组件 | 职责 | 技术选型 | SLA |
|------|------|---------|-----|
| Tenant Detector | 识别租户 | Middleware | 99.99% |
| Brand Resolver | 解析品牌配置 | Go Service | 99.9% |
| Brand Cache | 缓存配置 | Redis Cluster | 99.99% |
| Theme Engine | 生成 CSS | TypeScript | N/A |

### 3.3 品牌查找链

```
优先级（从高到低）:

Level 1: 用户级覆盖 (User Override)
         └─ 用户个性化设置
                     │
                     ▼
Level 2: 租户级配置 (Tenant Config)
                     │
                     ▼
Level 3: 域名级配置 (Domain Config)
                     │
                     ▼
Level 4: 默认品牌 (Default Brand)
```

---

## 四、品牌元素模型

### 4.1 品牌元素模型图

```
                              ┌──────────────┐
                              │    Brand     │
                              └──────┬───────┘
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        │                            │                            │
        ▼                            ▼                            ▼
┌──────────────┐           ┌──────────────┐           ┌──────────────┐
│    Brand     │           │   Brand      │           │   Brand      │
│  Identity    │           │   Theme      │           │   Content    │
│  (标识)       │           │   (主题)      │           │   (内容)      │
└──────┬───────┘           └──────┬───────┘           └──────┬───────┘
         │                        │                          │
    ┌────┴────┐              ┌────┴────┐                ┌────┴────┐
    │         │              │         │                │         │
    ▼         ▼              ▼         ▼                ▼         ▼
 ┌─────┐ ┌──────┐       ┌─────────┐ ┌──────┐      ┌─────────┐ ┌───────┐
 │Logo │ │ Name │       │ Color   │ │ Font │      │  Copy   │ │ Icon  │
 └─────┘ └──────┘       └─────────┘ └──────┘      └─────────┘ └───────┘
```

### 4.2 元素说明

**BrandIdentity (品牌标识)**
- Logo: 多尺寸、多格式、SVG 优先
- Name: 品牌名称（2-50 字符）
- Tagline: 品牌标语（可选）

**BrandTheme (品牌主题)**
- Color Scheme: 主色、辅色、语义色
- Font Family: 中英文字体、等宽字体

**BrandContent (品牌内容)**
- Copy: 产品名称、帮助文档、错误消息
- Icon Set: 图标库配置

### 4.3 品牌配置 JSON

```json
{
  "brand": {
    "id": "brand_001",
    "name": "Acme Corp",
    "tenantId": "tenant_acme",
    "status": "active"
  },
  "identity": {
    "logo": {
      "header": "/assets/brands/acme/logo-header.svg",
      "login": "/assets/brands/acme/logo-login.svg",
      "favicon": "/assets/brands/acme/favicon.ico"
    },
    "name": "Acme Platform",
    "tagline": "Empowering Innovation"
  },
  "theme": {
    "colors": {
      "primary": { "500": "#0066CC", "600": "#0052A3" },
      "secondary": { "500": "#8B5CF6" },
      "semantic": {
        "success": "#10B981",
        "warning": "#F59E0B",
        "error": "#EF4444"
      }
    },
    "fonts": {
      "chinese": "'Noto Sans SC', 'PingFang SC'",
      "english": "'Inter', -apple-system",
      "mono": "'Fira Code', 'Consolas'"
    }
  },
  "content": {
    "copy": {
      "productName": "Acme Platform",
      "helpDocUrl": "https://help.acme.com/docs",
      "footerCopyright": "© 2026 Acme Corp"
    }
  }
}
```

---

## 五、主题配置规范

### 5.1 主题配置数据流图

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Admin     │      │   Brand     │      │   Theme     │      │   Client    │
│   Config    │─────▶│   Config    │─────▶│   Engine    │─────▶│   Browser   │
│    (UI)     │      │    (JSON)   │      │ (Transformer)│     │    (DOM)    │
└─────────────┘      └─────────────┘      └─────────────┘      └─────────────┘
       │                    │                    │                    │
       │ 1. 配置品牌         │ 2. 存储配置        │ 3. 生成 CSS         │ 4. 应用主题
       ▼                    ▼                    ▼                    ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  PostgreSQL   │───▶│    Redis      │───▶│    CDN/OSS    │───▶│    Browser    │
│  (Source)     │    │   (Cache)     │    │  (Assets)     │    │     (DOM)     │
└───────────────┘    └───────────────┘    └───────────────┘    └───────────────┘
```

### 5.2 CSS 变量命名

```css
/* Brand Tokens - CSS Variables */
:root {
  /* 主色 */
  --brand-primary-50: #E6F4FF;
  --brand-primary-100: #BAE7FF;
  --brand-primary-500: #0070F3;
  --brand-primary-600: #0058C4;
  --brand-primary-700: #0047A0;

  /* 语义色 */
  --brand-success-500: #10B981;
  --brand-warning-600: #D97706;
  --brand-error-600: #DC2626;
  --brand-info-500: #3B82F6;

  /* 字体 */
  --brand-font-chinese: 'Noto Sans SC', 'PingFang SC', sans-serif;
  --brand-font-english: 'Inter', -apple-system, sans-serif;
  --brand-font-mono: 'Fira Code', 'Consolas', monospace;

  /* Logo */
  --brand-logo-header: url('/assets/brands/default/logo-header.svg');
  --brand-logo-login: url('/assets/brands/default/logo-login.svg');
}
```

---

## 六、Logo 替换机制

### 6.1 Logo 替换流程图

```
┌─────────────┐
│  Admin UI   │
└──────┬──────┘
       │ 1. 上传 Logo (SVG/PNG/WebP)
       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        Logo Processing Pipeline                                  │
│  ┌───────────┐   ┌───────────┐   ┌───────────┐   ┌───────────┐                 │
│  │ Validate  │ → │ Optimize  │ → │ Generate  │ → │  Upload   │                 │
│  │ Format    │   │ (SVGO)    │   │ Variants  │   │  to CDN   │                 │
│  └───────────┘   └───────────┘   └───────────┘   └───────────┘                 │
│                                                                                 │
│  格式优先级：SVG > PNG > WebP > JPG                                             │
│  生成尺寸：favicon (16x16), header (120x40), login (200x80), social (1200x630) │
└─────────────────────────────────────────────────────────────────────────────────┘
       │
       │ 2. 返回 CDN URLs
       ▼
┌───────────────┐
│   Database    │
│  brand_assets │
└───────┬───────┘
        │
        │ 3. 前端请求
        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        Runtime Logo Replacement                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │  CSS 注入：<style>:root { --brand-logo-header: url('...'); }</style>        ││
│  │  组件渲染：<img src={brandConfig.identity.logo.header} />                    ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 SVG 优先策略

| 特性 | SVG | PNG | WebP |
|------|-----|-----|------|
| 矢量缩放 | ✅ 无损 | ❌ 有损 | ❌ 有损 |
| 透明背景 | ✅ | ✅ | ✅ |
| 文件大小 | 1-5KB | 10-50KB | 5-20KB |
| CSS 可控 | ✅ | ❌ | ❌ |
| 暗色适配 | ✅ | ❌ | ❌ |

---

## 七、配色方案

### 7.1 配色方案层次图

```
                                    ┌──────────────┐
                                    │Brand Primary │
                                    │   (主色板)    │
                                    └──────┬───────┘
                                           │
                   ┌───────────────────────┼───────────────────────┐
                   │                       │                       │
                   ▼                       ▼                       ▼
          ┌───────────────┐       ┌───────────────┐       ┌───────────────┐
          │ Primary Scale │       │Secondary Scale│       │Neutral Scale  │
          │  50: #E6F4FF  │       │  50: #F5F3FF  │       │  50: #FAFAFA  │
          │  500: #0070F3 │       │  500: #8B5CF6 │       │  500: #8C8C8C │
          │  900: #002352 │       │  900: #4C1D95 │       │  900: #1A1A1A │
          └───────────────┘       └───────────────┘       └───────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Semantic Colors                                      │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐         │
│  │   Success   │   │   Warning   │   │    Error    │   │    Info     │         │
│  │  #10B981    │   │  #F59E0B    │   │  #EF4444    │   │  #3B82F6    │         │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘         │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 暗黑模式映射

| 浅色模式 | 暗黑模式 | 调整策略 |
|---------|---------|---------|
| primary-500 | dark-primary-400 | 明度 -8%, 饱和度 -40% |
| primary-600 | dark-primary-500 | 明度 -12%, 饱和度 -37% |
| neutral-50 | dark-surface-3 | 背景反转 |
| neutral-900 | dark-text-primary | 文本反转 |

---

## 八、字体规范

### 8.1 字体栈

**中文字体**
```
'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif
```

**英文字体**
```
'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif
```

**等宽字体**
```
'Fira Code', 'Consolas', 'Monaco', monospace
```

### 8.2 加载策略

1. **系统字体优先** - 无需下载，FOUT 风险低
2. **Web 字体按需加载** - font-display: swap
3. **字体子集化** - 中文字体仅包含常用字
4. **本地缓存** - Service Worker 缓存

---

## 九、图标规范

### 9.1 图标系统架构

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Layer 1: Icon Library                                                            │
│  Lucide (首选) | FontAwesome | Material Icons                                    │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Layer 2: Custom Icons                                                            │
│  1. 上传 SVG → 2. 验证 → 3. 优化 → 4. 存储 → 5. 返回 ID                          │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Layer 3: Runtime Rendering                                                       │
│  优先级：自定义图标 > 图标库 > Emoji 兜底                                         │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 图标配置

```json
{
  "icons": {
    "library": "lucide",
    "customIcons": {
      "logo": "custom_acme_logo",
      "dashboard": "custom_acme_dashboard"
    }
  }
}
```

---

## 十、文案规范

### 10.1 文案定制范围

| 类别 | Token | 默认值 | 可定制 |
|------|-------|--------|--------|
| 产品标识 | productName | "Orion Platform" | ✅ |
| 导航链接 | helpDocUrl | "/help" | ✅ |
| 界面消息 | loginWelcome | "Welcome to Orion" | ✅ |
| 错误消息 | error.404 | "Page Not Found" | ✅ |
| 版权信息 | footerCopyright | "© Orion Team" | ✅ |

### 10.2 文案配置

```json
{
  "content": {
    "copy": {
      "productName": "Acme Platform",
      "helpDocUrl": "https://help.acme.com/docs",
      "loginWelcome": "Welcome to Acme Platform",
      "footerCopyright": "© 2026 Acme Corp"
    }
  }
}
```

---

## 十一、品牌切换 API

### 11.1 品牌切换时序图

```
User      Admin UI    Brand API   Database   Client App
  │           │           │           │           │
  │ 1.选择品牌 │           │           │           │
  │──────────▶│           │           │           │
  │           │ 2.POST /switch      │           │
  │           │──────────▶│           │           │
  │           │           │ 3.验证权限│           │
  │           │           │──────────▶│           │
  │           │           │ 4.更新    │           │
  │           │           │◀──────────│           │
  │           │ 5.返回配置│           │           │
  │           │◀──────────│           │           │
  │           │ 6.广播事件│           │           │
  │           │──────────────────────────────────▶│
  │           │           │           │           │ 7.应用主题
  │           │           │           │           │ (CSS+DOM)
  │ 8.完成    │           │           │           │
  │◀──────────│           │           │           │
```

### 11.2 API 定义

```yaml
# 获取品牌列表
GET /api/v1/brands

# 获取品牌详情
GET /api/v1/brands/{brandId}

# 切换品牌
POST /api/v1/brands/{brandId}/switch
Body: { "scope": "tenant", "persist": true }

# 获取当前品牌
GET /api/v1/brand/current

# 持久化设置
POST /api/v1/users/me/brand-preference
```

### 11.3 持久化策略

| Scope | 存储位置 | 持久性 | 用例 |
|-------|---------|--------|------|
| session | sessionStorage | 标签页关闭清除 | 临时演示 |
| user | localStorage | 永久 | 用户偏好 |
| tenant | Database | 永久 | 租户配置 |
| url | URL Param | 分享链接 | 营销页面 |

---

## 十二、品牌管理 UI

### 12.1 品牌管理 UI 线框图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Orion Admin Console                                              [User ▼]      │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐                                                                 │
│  │ Navigation  │   ┌──────────────────────────────────────────────────────────┐ │
│  │             │   │  Brand Management                                         │ │
│  │ • Brands ◀──┼───┤                                                          │ │
│  │             │   │  [+ New Brand] [Import] [Export]                          │ │
│  │             │   │                                                           │ │
│  │             │   │  ┌───────────────┐  ┌──────────────────────────────────┐ │ │
│  │             │   │  │ Brand List    │  │  Preview Pane                    │ │ │
│  │             │   │  │               │  │                                  │ │ │
│  │             │   │  │ ┌───────────┐ │  │  ┌────────────────────────────┐  │ │ │
│  │             │   │  │ │● Acme    │ │  │  │  [Logo Preview]             │  │ │ │
│  │             │   │  │ │  Corp    │ │  │  │  Acme Platform              │  │ │ │
│  │             │   │  │ │ Active   │ │  │  │  ┌─────┐ ┌─────┐ ┌─────┐   │  │ │ │
│  │             │   │  │ └───────────┘ │  │  │  │ Btn │ │ Btn │ │ Btn │   │  │ │ │
│  │             │   │  │               │  │  │  └─────┘ └─────┘ └─────┘   │  │ │ │
│  │             │   │  │ ┌───────────┐ │  │  │  Primary: #0066CC █        │  │ │ │
│  │             │   │  │ │ Orion     │ │  │  │  Success: #10B981 █        │  │ │ │
│  │             │   │  │ │ Default   │ │  │  └────────────────────────────┘  │ │ │
│  │             │   │  │ └───────────┘ │  │                                  │ │ │
│  │             │   │  └───────────────┘  └──────────────────────────────────┘ │ │
│  │             │   │                                                           │ │
│  │             │   │  ┌──────────────────────────────────────────────────────┐ │ │
│  │             │   │  │  Brand Editor                                         │ │ │
│  │             │   │  │                                                       │ │ │
│  │             │   │  │  Identity: Name[_______] Tagline[_______] Logo[___]  │ │ │
│  │             │   │  │  Colors: Primary[#____] Secondary[#____] ...         │ │ │
│  │             │   │  │  Fonts: Chinese[▼] English[▼] Mono[▼]               │ │ │
│  │             │   │  │  Copy: Product[_______] Help[_______] Copyright[___] │ │ │
│  │             │   │  │                                                       │ │ │
│  │             │   │  │              [Cancel] [Save Draft] [Publish]          │ │ │
│  │             │   │  └──────────────────────────────────────────────────────┘ │ │
│  └─────────────┘                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 12.2 区域说明

| 区域 | 功能 |
|------|------|
| Brand List | 显示所有品牌，支持搜索筛选 |
| Preview Pane | 实时预览品牌效果 |
| Brand Editor | 编辑品牌元素（标识、配色、字体、文案）|

---

## 十三、数据库 Schema

### 13.1 完整数据库设计

```sql
-- 品牌主表
CREATE TABLE brands (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'draft',  -- draft, active, archived
    created_by VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    published_at TIMESTAMP NULL,
    INDEX idx_status (status),
    INDEX idx_created_by (created_by)
);

-- 品牌主题配置（JSON 存储）
CREATE TABLE brand_themes (
    id VARCHAR(36) PRIMARY KEY,
    brand_id VARCHAR(36) NOT NULL,
    tokens_json JSON NOT NULL,  -- 完整 Design Tokens
    dark_mode_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE,
    INDEX idx_brand_id (brand_id)
);

-- 品牌资源（Logo、图标等）
CREATE TABLE brand_assets (
    id VARCHAR(36) PRIMARY KEY,
    brand_id VARCHAR(36) NOT NULL,
    type VARCHAR(50) NOT NULL,  -- logo_header, logo_login, favicon, icon_custom
    format VARCHAR(20) NOT NULL,  -- svg, png, webp, ico
    url VARCHAR(500) NOT NULL,  -- CDN URL
    size_bytes INT NOT NULL,
    dimensions VARCHAR(20),  -- e.g., "120x40"
    hash VARCHAR(64) NOT NULL,  -- 文件哈希（去重）
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE,
    INDEX idx_brand_type (brand_id, type),
    INDEX idx_hash (hash)
);

-- 品牌文案配置
CREATE TABLE brand_copy (
    id VARCHAR(36) PRIMARY KEY,
    brand_id VARCHAR(36) NOT NULL,
    language VARCHAR(10) DEFAULT 'zh-CN',
    copy_json JSON NOT NULL,  -- 文案键值对
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE,
    INDEX idx_brand_lang (brand_id, language)
);

-- 租户品牌关联
CREATE TABLE tenant_brands (
    tenant_id VARCHAR(36) NOT NULL,
    brand_id VARCHAR(36) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    scope VARCHAR(20) DEFAULT 'tenant',  -- tenant, user, domain
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id, brand_id, scope),
    FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE,
    INDEX idx_tenant (tenant_id)
);

-- 域名品牌映射
CREATE TABLE domain_brands (
    domain VARCHAR(100) PRIMARY KEY,
    brand_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE,
    INDEX idx_brand (brand_id)
);

-- 品牌草稿
CREATE TABLE brand_drafts (
    id VARCHAR(36) PRIMARY KEY,
    brand_id VARCHAR(36) NOT NULL,
    draft_json JSON NOT NULL,
    created_by VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE,
    INDEX idx_brand (brand_id)
);

-- 品牌发布历史
CREATE TABLE brand_publish_history (
    id VARCHAR(36) PRIMARY KEY,
    brand_id VARCHAR(36) NOT NULL,
    version INT NOT NULL,
    published_by VARCHAR(36),
    published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    previous_version INT NULL,
    rollback_to_version INT NULL,
    FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE,
    INDEX idx_brand_version (brand_id, version)
);
```

### 13.2 Redis 缓存结构

```
# 品牌配置缓存（TTL: 5 分钟）
品牌配置：orion:brand:{brandId}
格式：JSON
TTL: 300 秒

# 租户当前品牌
租户品牌：orion:tenant:brand:{tenantId}
格式：String (brandId)
TTL: 3600 秒

# 域名品牌映射
域名映射：orion:domain:brand:{domain}
格式：String (brandId)
TTL: 3600 秒

# 品牌资产 CDN 映射
资产映射：orion:brand:assets:{brandId}:{type}
格式：String (CDN URL)
TTL: 86400 秒（24 小时，资产不常变）
```

---

## 十四、风险评估

### 14.1 风险矩阵

| 风险 | 影响 | 概率 | 风险值 | 优先级 |
|------|------|------|--------|--------|
| XSS 攻击（恶意 SVG） | 高 | 中 | 高 | P0 |
| 品牌配置泄漏 | 高 | 低 | 中 | P1 |
| 性能下降（配置加载） | 中 | 中 | 中 | P1 |
| 缓存不一致 | 中 | 中 | 中 | P1 |
| 兼容性问题 | 低 | 中 | 低 | P2 |

### 14.2 详细风险缓解

#### 14.2.1 XSS 攻击风险 (P0)

**风险描述**: 恶意用户上传包含 XSS 的 SVG 文件。

**缓解措施**:
1. **SVG 消毒**: 上传时使用 DOMPurify 或类似库清理 SVG
2. **CSP 头**: 设置 Content-Security-Policy 限制脚本执行
3. **文件验证**: 仅允许白名单 MIME 类型
4. **Sandbox 渲染**: 在 iframe 中预览用户上传内容

```
SVG 消毒流程:
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 1. 上传 SVG 文件                                                                 │
│              │                                                                    │
│              ▼                                                                    │
│ 2. 解析 SVG DOM                                                                   │
│              │                                                                    │
│              ▼                                                                    │
│ 3. 移除危险元素：<script>, <iframe>, <object>, <embed>                          │
│              │                                                                    │
│              ▼                                                                    │
│ 4. 移除危险属性：onerror, onload, onclick 等 event handlers                      │
│              │                                                                    │
│              ▼                                                                    │
│ 5. 验证 XML 命名空间                                                              │
│              │                                                                    │
│              ▼                                                                    │
│ 6. 重新序列化并存储                                                               │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### 14.2.2 品牌配置泄漏 (P1)

**风险描述**: 租户 A 看到租户 B 的品牌配置。

**缓解措施**:
1. **权限隔离**: 基于租户 ID 的品牌查询
2. **缓存隔离**: Redis key 包含租户前缀
3. **审计日志**: 记录所有品牌配置访问

#### 14.2.3 性能下降 (P1)

**风险描述**: 品牌配置加载导致首屏延迟。

**缓解措施**:
1. **CDN 缓存**: 品牌资源缓存 24 小时
2. **Redis 缓存**: 配置缓存 5 分钟
3. **预加载**: 关键品牌资源使用 `<link rel="preload">`
4. **压缩传输**: JSON 配置使用 gzip 压缩

**性能目标**:
| 指标 | 目标 | 告警阈值 |
|------|------|---------|
| 配置加载时间 | < 100ms | > 500ms |
| Logo 加载时间 | < 500ms | > 2000ms |
| 主题切换延迟 | < 100ms | > 300ms |

#### 14.2.4 缓存不一致 (P1)

**风险描述**: Redis 缓存与数据库不一致。

**缓解措施**:
1. **发布时失效**: 品牌发布时自动失效 Redis 缓存
2. **广播事件**: 使用 BroadcastChannel 通知多标签页
3. **版本控制**: 配置中包含版本号，客户端检测变更

---

## 十五、验收标准

### 15.1 功能验收

| 编号 | 验收项 | 验收方法 | 通过标准 |
|------|--------|---------|---------|
| F1 | 品牌创建 | 创建新品牌 | 品牌成功保存 |
| F2 | Logo 上传 | 上传 SVG/PNG | 生成所有尺寸变体 |
| F3 | 配色定制 | 选择主色 | 生成 10 级色板 |
| F4 | 品牌切换 | 切换品牌 | < 100ms 生效 |
| F5 | 暗色模式 | 切换暗色 | 配色正确映射 |
| F6 | 文案定制 | 修改文案 | 全站生效 |
| F7 | 品牌预览 | 实时预览 | WYSIWYG |
| F8 | 品牌发布 | 发布品牌 | 缓存失效 |
| F9 | 回滚功能 | 回滚版本 | 恢复旧配置 |
| F10 | 多租户隔离 | 租户 A/B 配置 | 互不干扰 |

### 15.2 性能验收

| 编号 | 验收项 | 验收方法 | 通过标准 |
|------|--------|---------|---------|
| P1 | 配置加载时间 | Lighthouse | < 100ms |
| P2 | Logo 加载时间 | WebPageTest | < 500ms |
| P3 | 主题切换延迟 | 性能测试 | < 100ms |
| P4 | 缓存命中率 | 监控 | > 95% |
| P5 | API 响应时间 | 压测 | P99 < 50ms |

### 15.3 安全验收

| 编号 | 验收项 | 验收方法 | 通过标准 |
|------|--------|---------|---------|
| S1 | SVG XSS 防护 | 渗透测试 | 无法注入脚本 |
| S2 | 权限隔离 | 渗透测试 | 无法越权访问 |
| S3 | CSP 头 | 安全扫描 | 无警告 |
| S4 | 文件类型验证 | 渗透测试 | 拒绝非白名单格式 |

---

## 十六、技术实现细节

### 16.1 前端 Theme Provider

```typescript
// ThemeContext.tsx
interface BrandConfig {
  identity: {
    logo: { header: string; login: string; favicon: string };
    name: string;
    tagline: string;
  };
  theme: {
    colors: {
      primary: Record<string, string>;
      secondary: Record<string, string>;
      semantic: Record<string, string>;
    };
    darkMode: boolean;
    fonts: {
      chinese: string;
      english: string;
      mono: string;
    };
  };
  content: {
    copy: Record<string, string>;
    icons: {
      library: string;
      customIcons: Record<string, string>;
    };
  };
}

// ThemeProvider Component
function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [brandConfig, setBrandConfig] = useState<BrandConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // 加载品牌配置
  useEffect(() => {
    async function loadBrand() {
      try {
        const config = await fetch('/api/v1/brand/current');
        const data = await config.json();
        setBrandConfig(data);
        applyBrandConfig(data);
      } catch (error) {
        console.error('Failed to load brand config:', error);
      } finally {
        setLoading(false);
      }
    }
    loadBrand();
  }, []);

  // 监听品牌切换事件
  useEffect(() => {
    function handleBrandChange(event: StorageEvent) {
      if (event.key === 'orion:brand:current') {
        const newConfig = JSON.parse(event.newValue);
        setBrandConfig(newConfig);
        applyBrandConfig(newConfig);
      }
    }
    window.addEventListener('storage', handleBrandChange);
    return () => window.removeEventListener('storage', handleBrandChange);
  }, []);

  // 应用品牌配置到 DOM
  function applyBrandConfig(config: BrandConfig) {
    const root = document.documentElement;

    // 应用颜色
    Object.entries(config.theme.colors.primary).forEach(([key, value]) => {
      root.style.setProperty(`--brand-primary-${key}`, value);
    });

    // 应用字体
    root.style.setProperty('--brand-font-chinese', config.theme.fonts.chinese);
    root.style.setProperty('--brand-font-english', config.theme.fonts.english);

    // 应用 Logo
    root.style.setProperty('--brand-logo-header', `url(${config.identity.logo.header})`);

    // 应用暗色模式
    if (config.theme.darkMode) {
      root.classList.add('dark-mode');
    } else {
      root.classList.remove('dark-mode');
    }

    // 更新文档标题
    document.title = config.content.copy.productName || config.identity.name;
  }

  if (loading) return <LoadingSpinner />;
  if (!brandConfig) return <DefaultTheme>{children}</DefaultTheme>;

  return (
    <ThemeContext.Provider value={{ brandConfig, setBrandConfig }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

### 16.2 品牌发布流程

```
Step 1: 保存草稿
┌─────────────────────────────────────────────────────────────────────────────────┐
│ • 配置保存到 brand_drafts 表                                                     │
│ • 状态：draft                                                                    │
│ • 不影响线上品牌配置                                                             │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
Step 2: 发布前验证
┌─────────────────────────────────────────────────────────────────────────────────┐
│ • 验证 Logo 可访问性（CDN URL 有效）                                              │
│ • 验证颜色对比度（WCAG AA）                                                      │
│ • 验证文案无敏感词                                                               │
│ • 预览确认                                                                       │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
Step 3: 发布品牌
┌─────────────────────────────────────────────────────────────────────────────────┐
│ • 更新 brands 表状态：draft → active                                            │
│ • 失效 Redis 缓存                                                                 │
│ • 广播品牌变更事件                                                               │
│ • 记录发布日志（audit log）                                                      │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
Step 4: 生效确认
┌─────────────────────────────────────────────────────────────────────────────────┐
│ • 检查客户端是否接收到新配置                                                     │
│ • 监控品牌配置加载错误率                                                         │
│ • 如有问题，支持一键回滚                                                         │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 16.3 多租户品牌模型

```
租户与品牌关系：

┌─────────────────────────────────────────────────────────────────────────────────┐
│  Tenant A (Acme Corp)                                                           │
│  ├─ Brand: "Acme Platform"                                                      │
│  ├─ Logo: acme-logo.svg                                                         │
│  ├─ Colors: Blue (#0066CC)                                                      │
│  └─ Users: user1@acme.com, user2@acme.com                                       │
│                                                                                  │
│  Tenant B (Beta Inc)                                                            │
│  ├─ Brand: "Beta System"                                                        │
│  ├─ Logo: beta-logo.svg                                                         │
│  ├─ Colors: Purple (#8B5CF6)                                                    │
│  └─ Users: user1@beta.com, user2@beta.com                                       │
│                                                                                  │
│  Tenant C (Default)                                                             │
│  ├─ Brand: "Orion Platform"                                                     │
│  ├─ Logo: orion-logo.svg                                                        │
│  ├─ Colors: Blue (#0070F3)                                                      │
│  └─ Users: free-tier users                                                      │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 十七、附录

### 17.1 术语表

| 术语 | 定义 |
|------|------|
| White Label | 白标，可定制品牌标识的系统 |
| Design Tokens | 视觉设计的最小原子单位 |
| CSS Custom Properties | CSS 自定义属性（CSS 变量） |
| WCAG | Web Content Accessibility Guidelines |
| FOUT | Flash of Unstyled Text，未样式文本闪烁 |
| CDN | Content Delivery Network，内容分发网络 |
| SVG | Scalable Vector Graphics，可缩放矢量图形 |
| CSP | Content Security Policy，内容安全策略 |
| TTL | Time To Live，缓存生存时间 |
| LRU | Least Recently Used，最近最少使用缓存算法 |

### 17.2 参考文档

| 文档 | 链接/位置 |
|------|----------|
| Design Tokens 完整定义 | `/Users/heal/orion-design/docs/ui/Design-Tokens 完整定义.md` |
| W3C Design Tokens 规范 | https://www.w3.org/design-tokens/ |
| WCAG 2.1 指南 | https://www.w3.org/WAI/WCAG21/Quickref/ |
| Lucide Icons | https://lucide.dev/ |
| DOMPurify | https://github.com/cure53/DOMPurify |

### 17.3 评审记录

| 评审日期 | 评审人 | 意见 | 状态 |
|---------|--------|------|------|
| 2026-04-10 | 架构委员会 | 待评审 | 待评审 |

### 17.4 变更历史

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|---------|
| v1.0 | 2026-04-10 | Orion Architecture Team | 初始版本 |

---

_文档版本：v1.0 | 创建日期：2026-04-10 | 状态：待评审 | 维护团队：Orion Platform Team_
