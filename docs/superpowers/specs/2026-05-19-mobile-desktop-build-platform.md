# 移动端和桌面端 CI 构建平台设计方案

**日期**: 2026-05-19
**状态**: Draft
**版本**: 1.0

---

## 一、设计概述

### 1.1 背景

Orion CI 当前支持 Node.js、Python、Go、Java、.NET、Rust 的 Docker/K8s 构建。为满足更广泛的开发需求，需要扩展支持：
- 移动端：iOS、Android、鸿蒙 (HarmonyOS)
- 桌面端：Windows、macOS、Linux
- C++ 程序构建

### 1.2 目标

构建一个可扩展的移动端和桌面端 CI 构建平台，支持多平台、多语言、自动化签名。

### 1.3 设计约束

| 约束 | 要求 |
|------|------|
| 架构 | 复用现有 BuildService 扩展，非新建独立服务 |
| 执行器 | 新增 HostBuildExecutor 和 MacBuildExecutor |
| 证书 | 使用现有 CredentialService 集成，K8s Secret 存储 |
| 集成 | 与 PipelineService、ArtifactService、NotificationService 集成 |

---

## 二、架构设计

### 2.1 总体架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         orion-platform-service                               │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         Build Service (扩展)                           │ │
│  │                                                                         │ │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────────┐  │ │
│  │  │  K8sBuildExecutor │  │  HostBuildExecutor │  │  MacBuildExecutor  │  │ │
│  │  │   (现有: Web语言)  │  │   (C++/Android)     │  │   (iOS/鸿蒙)       │  │ │
│  │  └────────┬─────────┘  └────────┬─────────┘  └──────────┬──────────┘  │ │
│  │           │                      │                       │              │ │
│  │  ┌────────┴──────────────────────┴───────────────────────┴───────────┐ │ │
│  │  │                    BuildExecutorRegistry                          │ │ │
│  │  │   - 根据 buildType 选择合适的执行器                                │ │ │
│  │  └────────────────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    Mobile/Desktop Services                             │ │
│  │                                                                         │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │ │
│  │  │ AndroidBuild │  │  iOSBuild    │  │ HarmonyBuild │  │ Desktop   │  │ │
│  │  │   Service    │  │   Service    │  │   Service    │  │ Build Svc │  │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └───────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
          ┌─────────────────────────────┼─────────────────────────────┐
          ▼                             ▼                             ▼
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│  K8s Cluster        │    │   Linux Build Farm  │    │   macOS Build Farm  │
│  (Pod)              │    │   (C++/Android)     │    │   (iOS/鸿蒙)        │
│                     │    │                     │    │                     │
│  - Node.js          │    │  - Android SDK      │    │  - Xcode            │
│  - Python           │    │  - Gradle           │    │  - CocoaPods        │
│  - Go               │    │  - C++ (gcc/cmake)  │    │  - Xcodegen         │
│  - Java             │    │                     │    │                     │
│  - .NET             │    │                     │    │                     │
│  - Rust             │    │                     │    │                     │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

### 2.2 构建执行器接口

```typescript
// src/services/build/executors/BaseBuildExecutor.ts
interface BuildExecutor {
  /** 执行器类型 */
  readonly type: BuildType;

  /** 支持的平台 */
  readonly platforms: Platform[];

  /** 检查环境是否就绪 */
  checkEnvironment(config: BuildConfig): Promise<boolean>;

  /** 执行构建 */
  execute(context: BuildContext): Promise<BuildResult>;

  /** 取消构建 */
  cancel(runId: string): Promise<void>;
}
```

---

## 三、构建类型定义

### 3.1 新增构建类型枚举

```typescript
// src/models/BuildType.ts
export enum BuildType {
  // 现有
  NODE = 'node',
  PYTHON = 'python',
  GO = 'go',
  JAVA = 'java',
  DOTNET = 'dotnet',
  RUST = 'rust',

  // 移动端
  ANDROID = 'android',
  IOS = 'ios',
  HARMONY = 'harmony',  // 鸿蒙

  // 桌面端
  DESKTOP_WINDOWS = 'desktop-windows',
  DESKTOP_MACOS = 'desktop-macos',
  DESKTOP_LINUX = 'desktop-linux',

  // C++
  CPP_LINUX = 'cpp-linux',
  CPP_WINDOWS = 'cpp-windows',
  CPP_MACOS = 'cpp-macos',
}
```

---

## 四、各平台构建方案

### 4.1 Android 构建

| 项目 | 方案 |
|------|------|
| **环境** | Linux Build Farm + Android SDK |
| **工具链** | Gradle 8.x + AGP 8.x + JDK 17 |
| **构建命令** | `./gradlew assembleDebug` / `assembleRelease` |
| **输出** | `.apk`, `.aab` |
| **签名** | 从 Keystore 自动签名 |

### 4.2 iOS 构建

| 项目 | 方案 |
|------|------|
| **环境** | macOS Build Farm (必须) |
| **工具链** | Xcode 15+ + CocoaPods + SwiftPackageManager |
| **构建命令** | `xcodebuild` + `xcodebuild -exportArchive` |
| **输出** | `.ipa` |
| **签名** | 自动从 Keychain 获取证书 + Provisioning Profile |

### 4.3 鸿蒙 (HarmonyOS) 构建

| 项目 | 方案 |
|------|------|
| **环境** | Linux Build Farm + HarmonyOS SDK |
| **工具链** | HUAWEI DevEco Studio + hvigor |
| **构建命令** | `./hvigorw assembleApp` |
| **输出** | `.hap` / `.app` |
| **签名** | 使用鸿蒙 AppGallery Connect |

### 4.4 桌面端构建

| 平台 | 环境 | 工具链 | 输出 |
|------|------|--------|------|
| Windows | Windows Build Farm | MSBuild / CMake / electron-builder | `.exe`, `.msi` |
| macOS | macOS Build Farm | Xcode / CMake / electron-builder | `.app`, `.dmg` |
| Linux | Linux Build Farm | CMake / electron-builder | `.AppImage`, `.deb` |

### 4.5 C++ 构建

| 平台 | 环境 | 工具链 | 输出 |
|------|------|--------|------|
| Linux | Linux Build Farm | GCC 13 + CMake + Make | `.so`, `.a`, 可执行文件 |
| Windows | Windows Build Farm | MSVC 2022 + CMake | `.dll`, `.lib`, `.exe` |
| macOS | macOS Build Farm | Clang + CMake | `.dylib`, `.a` |

---

## 五、核心组件设计

### 5.1 构建执行器注册表

```typescript
// src/services/build/BuildExecutorRegistry.ts
export class BuildExecutorRegistry {
  private executors = new Map<BuildType, BuildExecutor>();

  register(executor: BuildExecutor): void {
    this.executors.set(executor.type, executor);
  }

  get(type: BuildType): BuildExecutor | undefined {
    return this.executors.get(type);
  }

  getForPlatform(platform: Platform): BuildExecutor | undefined {
    for (const executor of this.executors.values()) {
      if (executor.platforms.includes(platform)) {
        return executor;
      }
    }
    return undefined;
  }
}
```

### 5.2 主机构建执行器

```typescript
// src/services/build/executors/HostBuildExecutor.ts
export class HostBuildExecutor implements BuildExecutor {
  type = BuildType.CPP_LINUX;
  platforms = [Platform.LINUX];

  async execute(context: BuildContext): Promise<BuildResult> {
    // 1. 准备构建环境
    await this.prepareEnvironment(context);

    // 2. 执行构建命令
    const result = await this.runBuildCommand(context);

    // 3. 收集产物
    const artifacts = await this.collectArtifacts(context);

    return { status: 'success', artifacts };
  }
}
```

### 5.3 证书管理服务

```typescript
// src/services/build/certificates/CertificateService.ts
interface CertificateService {
  /** 上传 iOS 证书 (.p12) */
  uploadIOSCertificate(tenantId: string, data: Buffer, password: string): Promise<Certificate>;

  /** 上传 Android 签名密钥 (jks/keystore) */
  uploadAndroidKeystore(tenantId: string, data: Buffer, storePassword: string, keyAlias: string, keyPassword: string): Promise<Certificate>;

  /** 获取构建用证书 */
  getCertificateForBuild(buildId: string, platform: Platform): Promise<CertificateResult>;

  /** 清理过期证书 */
  cleanupExpired(): Promise<void>;
}
```

---

## 六、数据库设计

### 6.1 新增表结构

```sql
-- 构建执行器配置表
CREATE TABLE build_executors (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  config JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 移动端证书表
CREATE TABLE build_certificates (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  platform VARCHAR(20) NOT NULL,
  name VARCHAR(255) NOT NULL,
  certificate_data BYTEA NOT NULL,
  expires_at TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 构建任务扩展表
CREATE TABLE build_tasks (
  id UUID PRIMARY KEY,
  run_id UUID NOT NULL,
  build_type VARCHAR(30) NOT NULL,
  platform VARCHAR(20) NOT NULL,
  executor_id UUID REFERENCES build_executors(id),
  certificate_id UUID REFERENCES build_certificates(id),
  output_artifacts JSONB,
  build_log TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  finished_at TIMESTAMP
);
```

---

## 七、API 设计

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/build/executors` | POST | 注册构建执行器 |
| `/api/v1/build/executors` | GET | 列出执行器 |
| `/api/v1/build/executors/:id` | DELETE | 删除执行器 |
| `/api/v1/build/certificates` | POST | 上传签名证书 |
| `/api/v1/build/certificates` | GET | 列出证书 |
| `/api/v1/build/certificates/:id` | DELETE | 删除证书 |
| `/api/v1/build/tasks` | POST | 创建构建任务 |
| `/api/v1/build/tasks/:id` | GET | 获取构建状态 |
| `/api/v1/build/tasks/:id/logs` | GET | 获取构建日志 |

---

## 八、与现有系统集成

| 现有模块 | 集成点 |
|----------|--------|
| PipelineService | 新增 BuildType 触发对应执行器 |
| ArtifactService | 存储构建产物 (.apk/.ipa/.exe) |
| BuildLogService | 统一日志收集 |
| NotificationService | 构建结果通知 |
| CredentialService | 证书凭据管理 |

---

## 九、安全考虑

1. **证书加密**：使用 AES-256 加密存储证书数据
2. **隔离执行**：
   - iOS 构建在专用 macOS 虚拟机
   - 证书不落盘，通过内存挂载
3. **构建环境清理**：每次构建后重置工作目录
4. **访问控制**：证书操作需 tenant 级别权限

---

## 十、实现计划

### Phase 1: 基础设施
1. 新增 BuildExecutor 接口和注册表
2. 创建 HostBuildExecutor (Linux C++)
3. 创建 MacBuildExecutor (macOS)
4. 新增数据库表结构

### Phase 2: 移动端支持
5. AndroidBuildService 实现
6. iOSBuildService 实现
7. HarmonyBuildService 实现
8. CertificateService 实现

### Phase 3: 桌面端支持
9. DesktopBuildService 实现
10. 跨平台构建模板

### Phase 4: 集成与测试
11. PipelineService 集成
12. 前端页面开发
13. 端到端测试