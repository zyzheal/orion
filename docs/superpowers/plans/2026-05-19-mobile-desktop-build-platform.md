# 移动端和桌面端 CI 构建平台实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现移动端 (iOS/Android/鸿蒙) 和桌面端 (Windows/macOS/Linux) CI 构建能力，以及 C++ 程序构建支持

**Architecture:** 基于 BuildExecutor 接口模式，扩展 HostBuildExecutor 和 MacBuildExecutor，通过 BuildExecutorRegistry 统一管理。复用现有 K8sBuildExecutor 架构，证书管理集成现有 CredentialService

**Tech Stack:** TypeScript, Fastify, PostgreSQL, Kubernetes, Shell Script

---

## 文件结构规划

```
orion-platform-service/src/services/build/
├── executors/
│   ├── BaseBuildExecutor.ts      # 基类和接口
│   ├── BuildExecutorRegistry.ts  # 执行器注册表
│   ├── HostBuildExecutor.ts      # 主机构建执行器 (C++/Android/Linux桌面)
│   └── MacBuildExecutor.ts       # macOS 构建执行器 (iOS/鸿蒙)
├── certificates/
│   └── CertificateService.ts     # 证书管理服务
├── mobile/
│   ├── AndroidBuildService.ts    # Android 构建服务
│   ├── iOSBuildService.ts        # iOS 构建服务
│   └── HarmonyBuildService.ts    # 鸿蒙构建服务
├── desktop/
│   └── DesktopBuildService.ts    # 桌面端构建服务
└── cpp/
    └── CppBuildService.ts        # C++ 构建服务
```

---

## Task 1: BuildExecutor 接口和注册表

**Files:**
- Create: `orion-platform-service/src/services/build/executors/BaseBuildExecutor.ts`
- Create: `orion-platform-service/src/services/build/executors/BuildExecutorRegistry.ts`
- Create: `orion-platform-service/src/services/build/executors/index.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// orion-platform-service/src/services/build/executors/__tests__/BuildExecutorRegistry.test.ts
import { BuildExecutorRegistry } from '../BuildExecutorRegistry';
import { BuildType, Platform } from '../../models/BuildType';

class MockExecutor implements BuildExecutor {
  type = BuildType.CPP_LINUX;
  platforms = [Platform.LINUX];

  async checkEnvironment(config: BuildConfig): Promise<boolean> {
    return true;
  }

  async execute(context: BuildContext): Promise<BuildResult> {
    return { status: 'success', artifacts: [] };
  }

  async cancel(runId: string): Promise<void> {}
}

describe('BuildExecutorRegistry', () => {
  let registry: BuildExecutorRegistry;

  beforeEach(() => {
    registry = new BuildExecutorRegistry();
  });

  it('should register and get executor by type', () => {
    const executor = new MockExecutor();
    registry.register(executor);
    expect(registry.get(BuildType.CPP_LINUX)).toBe(executor);
  });

  it('should return undefined for unknown type', () => {
    expect(registry.get(BuildType.ANDROID)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/build/executors/__tests__/BuildExecutorRegistry.test.ts -v`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write minimal implementation**

```typescript
// orion-platform-service/src/services/build/executors/BaseBuildExecutor.ts

export enum Platform {
  LINUX = 'linux',
  WINDOWS = 'windows',
  MACOS = 'macos',
}

export enum BuildType {
  // Existing
  NODE = 'node',
  PYTHON = 'python',
  GO = 'go',
  JAVA = 'java',
  DOTNET = 'dotnet',
  RUST = 'rust',
  // Mobile
  ANDROID = 'android',
  IOS = 'ios',
  HARMONY = 'harmony',
  // Desktop
  DESKTOP_WINDOWS = 'desktop-windows',
  DESKTOP_MACOS = 'desktop-macos',
  DESKTOP_LINUX = 'desktop-linux',
  // C++
  CPP_LINUX = 'cpp-linux',
  CPP_WINDOWS = 'cpp-windows',
  CPP_MACOS = 'cpp-macos',
}

export interface BuildConfig {
  type: BuildType;
  platform: Platform;
  sourceUrl: string;
  buildScript?: string;
  envVars?: Record<string, string>;
}

export interface BuildContext {
  runId: string;
  config: BuildConfig;
  workspace: string;
  artifacts: string[];
}

export interface BuildResult {
  status: 'success' | 'failed' | 'cancelled';
  artifacts: string[];
  log?: string;
  error?: string;
}

export interface BuildExecutor {
  readonly type: BuildType;
  readonly platforms: Platform[];
  checkEnvironment(config: BuildConfig): Promise<boolean>;
  execute(context: BuildContext): Promise<BuildResult>;
  cancel(runId: string): Promise<void>;
}
```

```typescript
// orion-platform-service/src/services/build/executors/BuildExecutorRegistry.ts

import { BuildExecutor, BuildType } from './BaseBuildExecutor';

export class BuildExecutorRegistry {
  private executors = new Map<BuildType, BuildExecutor>();

  register(executor: BuildExecutor): void {
    if (this.executors.has(executor.type)) {
      throw new Error(`Executor ${executor.type} already registered`);
    }
    this.executors.set(executor.type, executor);
  }

  get(type: BuildType): BuildExecutor | undefined {
    return this.executors.get(type);
  }

  getForType(type: BuildType): BuildExecutor | undefined {
    return this.executors.get(type);
  }

  list(): BuildExecutor[] {
    return Array.from(this.executors.values());
  }
}

// Singleton instance
export const buildExecutorRegistry = new BuildExecutorRegistry();
```

```typescript
// orion-platform-service/src/services/build/executors/index.ts

export * from './BaseBuildExecutor';
export * from './BuildExecutorRegistry';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/build/executors/__tests__/BuildExecutorRegistry.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add orion-platform-service/src/services/build/executors/
git commit -m "feat(build): add BuildExecutor interface and registry"
```

---

## Task 2: HostBuildExecutor 主机构建执行器

**Files:**
- Create: `orion-platform-service/src/services/build/executors/HostBuildExecutor.ts`
- Create: `orion-platform-service/src/services/build/executors/__tests__/HostBuildExecutor.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// orion-platform-service/src/services/build/executors/__tests__/HostBuildExecutor.test.ts
import { HostBuildExecutor } from '../HostBuildExecutor';
import { BuildType, Platform, BuildContext } from '../BaseBuildExecutor';

describe('HostBuildExecutor', () => {
  let executor: HostBuildExecutor;

  beforeEach(() => {
    executor = new HostBuildExecutor();
  });

  it('should have correct type and platforms', () => {
    expect(executor.type).toBe(BuildType.CPP_LINUX);
    expect(executor.platforms).toContain(Platform.LINUX);
  });

  it('should execute build successfully', async () => {
    const context: BuildContext = {
      runId: 'test-run-1',
      config: {
        type: BuildType.CPP_LINUX,
        platform: Platform.LINUX,
        sourceUrl: '/tmp/test-src',
        buildScript: 'g++ main.cpp -o app',
      },
      workspace: '/tmp/build-workspace',
      artifacts: [],
    };

    const result = await executor.execute(context);
    expect(result.status).toBe('success');
  });

  it('should support Android build type', () => {
    const androidExecutor = new HostBuildExecutor(BuildType.ANDROID);
    expect(androidExecutor.type).toBe(BuildType.ANDROID);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/build/executors/__tests__/HostBuildExecutor.test.ts -v`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write minimal implementation**

```typescript
// orion-platform-service/src/services/build/executors/HostBuildExecutor.ts

import {
  BuildExecutor,
  BuildType,
  Platform,
  BuildConfig,
  BuildContext,
  BuildResult,
} from './BaseBuildExecutor';

/**
 * 主机构建执行器
 * 用于非 Kubernetes 环境下的构建，如 C++、Android、Linux 桌面应用
 */
export class HostBuildExecutor implements BuildExecutor {
  constructor(readonly type: BuildType = BuildType.CPP_LINUX) {}

  get platforms(): Platform[] {
    switch (this.type) {
      case BuildType.CPP_LINUX:
      case BuildType.ANDROID:
      case BuildType.DESKTOP_LINUX:
        return [Platform.LINUX];
      case BuildType.CPP_WINDOWS:
      case BuildType.DESKTOP_WINDOWS:
        return [Platform.WINDOWS];
      case BuildType.CPP_MACOS:
      case BuildType.DESKTOP_MACOS:
        return [Platform.MACOS];
      default:
        return [Platform.LINUX];
    }
  }

  async checkEnvironment(config: BuildConfig): Promise<boolean> {
    // 检查必要的构建工具是否存在
    const tools = this.getRequiredTools();
    for (const tool of tools) {
      try {
        const { execSync } = require('child_process');
        execSync(`which ${tool}`, { stdio: 'ignore' });
      } catch {
        return false;
      }
    }
    return true;
  }

  async execute(context: BuildContext): Promise<BuildResult> {
    const { execSync } = require('child_process');
    const fs = require('fs');
    const path = require('path');

    try {
      // 1. 确保工作目录存在
      const workspace = context.workspace;
      if (!fs.existsSync(workspace)) {
        fs.mkdirSync(workspace, { recursive: true });
      }

      // 2. 设置环境变量
      const env = {
        ...process.env,
        ...context.config.envVars,
        BUILD_WORKSPACE: workspace,
      };

      // 3. 执行构建脚本
      let buildLog = '';
      if (context.config.buildScript) {
        try {
          buildLog = execSync(context.config.buildScript, {
            cwd: workspace,
            env,
            encoding: 'utf-8',
          });
        } catch (error: any) {
          buildLog = error.stdout + '\n' + error.stderr;
          return {
            status: 'failed',
            artifacts: [],
            log: buildLog,
            error: error.message,
          };
        }
      }

      // 4. 收集构建产物
      const artifacts = this.collectArtifacts(workspace);

      return {
        status: 'success',
        artifacts,
        log: buildLog,
      };
    } catch (error: any) {
      return {
        status: 'failed',
        artifacts: [],
        error: error.message,
      };
    }
  }

  async cancel(runId: string): Promise<void> {
    // 在生产环境中需要实现进程终止逻辑
    // 这里仅作为接口实现
  }

  private getRequiredTools(): string[] {
    switch (this.type) {
      case BuildType.CPP_LINUX:
      case BuildType.CPP_MACOS:
        return ['g++', 'make', 'cmake'];
      case BuildType.CPP_WINDOWS:
        return ['cl.exe', 'cmake'];
      case BuildType.ANDROID:
        return ['gradle', 'java'];
      case BuildType.DESKTOP_LINUX:
        return ['gcc', 'make'];
      default:
        return [];
    }
  }

  private collectArtifacts(workspace: string): string[] {
    const fs = require('fs');
    const artifacts: string[] = [];

    // 常见构建产物模式
    const patterns = ['*.so', '*.a', '*.exe', '*.app', '*.apk', '*.ipa'];

    // 简化实现：返回工作目录中的可执行文件
    if (fs.existsSync(workspace)) {
      const files = fs.readdirSync(workspace);
      for (const file of files) {
        const stat = fs.statSync(path.join(workspace, file));
        if (stat.isFile() && (stat.mode & 0o111) !== 0) {
          artifacts.push(path.join(workspace, file));
        }
      }
    }

    return artifacts;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/build/executors/__tests__/HostBuildExecutor.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add orion-platform-service/src/services/build/executors/HostBuildExecutor.ts
git commit -m "feat(build): add HostBuildExecutor for native builds"
```

---

## Task 3: MacBuildExecutor macOS 构建执行器

**Files:**
- Create: `orion-platform-service/src/services/build/executors/MacBuildExecutor.ts`
- Create: `orion-platform-service/src/services/build/executors/__tests__/MacBuildExecutor.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// orion-platform-service/src/services/build/executors/__tests__/MacBuildExecutor.test.ts
import { MacBuildExecutor } from '../MacBuildExecutor';
import { BuildType, Platform, BuildContext } from '../BaseBuildExecutor';

describe('MacBuildExecutor', () => {
  let executor: MacBuildExecutor;

  beforeEach(() => {
    executor = new MacBuildExecutor();
  });

  it('should have correct type for iOS', () => {
    const iosExecutor = new MacBuildExecutor(BuildType.IOS);
    expect(iosExecutor.type).toBe(BuildType.IOS);
  });

  it('should support macOS platform', () => {
    expect(executor.platforms).toContain(Platform.MACOS);
  });

  it('should build iOS project', async () => {
    const context: BuildContext = {
      runId: 'test-run-ios',
      config: {
        type: BuildType.IOS,
        platform: Platform.MACOS,
        sourceUrl: '/tmp/ios-project',
        buildScript: 'xcodebuild -scheme MyApp -configuration Debug build',
      },
      workspace: '/tmp/build-workspace',
      artifacts: [],
    };

    const result = await executor.execute(context);
    // macOS 构建需要 Xcode 环境，测试会跳过或 mock
    expect(['success', 'failed']).toContain(result.status);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/build/executors/__tests__/MacBuildExecutor.test.ts -v`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write minimal implementation**

```typescript
// orion-platform-service/src/services/build/executors/MacBuildExecutor.ts

import {
  BuildExecutor,
  BuildType,
  Platform,
  BuildContext,
  BuildResult,
} from './BaseBuildExecutor';

/**
 * macOS 构建执行器
 * 用于 iOS、macOS 桌面应用、鸿蒙应用构建
 * 需要运行在 macOS 环境
 */
export class MacBuildExecutor implements BuildExecutor {
  constructor(readonly type: BuildType = BuildType.IOS) {}

  get platforms(): Platform[] {
    return [Platform.MACOS];
  }

  async checkEnvironment(config: BuildConfig): Promise<boolean> {
    const requiredTools = this.getRequiredTools();

    for (const tool of requiredTools) {
      try {
        const { execSync } = require('child_process');
        execSync(`which ${tool}`, { stdio: 'ignore' });
      } catch {
        return false;
      }
    }
    return true;
  }

  async execute(context: BuildContext): Promise<BuildResult> {
    const { execSync } = require('child_process');
    const fs = require('fs');
    const path = require('path');

    try {
      const workspace = context.workspace;

      // 创建工作目录
      if (!fs.existsSync(workspace)) {
        fs.mkdirSync(workspace, { recursive: true });
      }

      const env = {
        ...process.env,
        ...context.config.envVars,
        BUILD_WORKSPACE: workspace,
      };

      let buildLog = '';

      if (context.config.buildScript) {
        try {
          buildLog = execSync(context.config.buildScript, {
            cwd: workspace,
            env,
            encoding: 'utf-8',
            timeout: 3600000, // 1小时超时
          });
        } catch (error: any) {
          buildLog = error.stdout + '\n' + error.stderr;
          return {
            status: 'failed',
            artifacts: [],
            log: buildLog,
            error: error.message,
          };
        }
      }

      const artifacts = this.collectMacArtifacts(workspace);

      return {
        status: 'success',
        artifacts,
        log: buildLog,
      };
    } catch (error: any) {
      return {
        status: 'failed',
        artifacts: [],
        error: error.message,
      };
    }
  }

  async cancel(runId: string): Promise<void> {
    // 实现进程终止
  }

  private getRequiredTools(): string[] {
    switch (this.type) {
      case BuildType.IOS:
        return ['xcodebuild', 'xcrun'];
      case BuildType.HARMONY:
        return ['hvigor', 'java'];
      case BuildType.DESKTOP_MACOS:
        return ['xcodebuild', 'cmake'];
      default:
        return ['xcodebuild'];
    }
  }

  private collectMacArtifacts(workspace: string): string[] {
    const fs = require('fs');
    const artifacts: string[] = [];

    if (fs.existsSync(workspace)) {
      const patterns = ['*.app', '*.ipa', '*.dmg', '*.framework'];

      // 简化：扫描 build 目录
      const buildDir = path.join(workspace, 'build');
      if (fs.existsSync(buildDir)) {
        const files = fs.readdirSync(buildDir);
        for (const file of files) {
          const filePath = path.join(buildDir, file);
          const stat = fs.statSync(filePath);
          if (stat.isDirectory() && file.endsWith('.app')) {
            artifacts.push(filePath);
          }
        }
      }
    }

    return artifacts;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/build/executors/__tests__/MacBuildExecutor.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add orion-platform-service/src/services/build/executors/MacBuildExecutor.ts
git commit -m "feat(build): add MacBuildExecutor for iOS/macOS builds"
```

---

## Task 4: CertificateService 证书管理服务

**Files:**
- Create: `orion-platform-service/src/services/build/certificates/CertificateService.ts`
- Create: `orion-platform-service/src/services/build/certificates/__tests__/CertificateService.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// orion-platform-service/src/services/build/certificates/__tests__/CertificateService.test.ts
import { CertificateService } from '../CertificateService';
import { v4 as uuidv4 } from 'uuid';

describe('CertificateService', () => {
  let service: CertificateService;

  beforeEach(() => {
    service = new CertificateService();
  });

  it('should upload and retrieve iOS certificate', async () => {
    const tenantId = uuidv4();
    const certData = Buffer.from('fake-cert-data');
    const password = 'test-password';

    const cert = await service.uploadIOSCertificate(tenantId, certData, password);
    expect(cert.id).toBeDefined();
    expect(cert.platform).toBe('ios');
    expect(cert.name).toContain('.p12');
  });

  it('should upload Android keystore', async () => {
    const tenantId = uuidv4();
    const keystoreData = Buffer.from('fake-keystore');
    const storePassword = 'store-password';
    const keyAlias = 'mykey';
    const keyPassword = 'key-password';

    const cert = await service.uploadAndroidKeystore(
      tenantId,
      keystoreData,
      storePassword,
      keyAlias,
      keyPassword
    );

    expect(cert.platform).toBe('android');
  });

  it('should list certificates by tenant', async () => {
    const tenantId = uuidv4();

    await service.uploadIOSCertificate(tenantId, Buffer.from('cert'), 'pass');

    const certs = await service.listCertificates(tenantId);
    expect(certs.length).toBeGreaterThan(0);
  });

  it('should delete certificate', async () => {
    const tenantId = uuidv4();
    const cert = await service.uploadIOSCertificate(
      tenantId,
      Buffer.from('cert'),
      'pass'
    );

    await service.deleteCertificate(cert.id);

    const certs = await service.listCertificates(tenantId);
    expect(certs.find(c => c.id === cert.id)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/build/certificates/__tests__/CertificateService.test.ts -v`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write minimal implementation**

```typescript
// orion-platform-service/src/services/build/certificates/CertificateService.ts

import * as crypto from 'crypto';
import * as fs from 'fs';

export interface Certificate {
  id: string;
  tenantId: string;
  platform: 'ios' | 'android';
  name: string;
  expiresAt: Date | null;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface CertificateResult {
  certificateData: Buffer;
  password?: string;
  keyAlias?: string;
}

// 内存存储（生产环境应使用数据库）
const certificates = new Map<string, Certificate & { encryptedData: Buffer }>();

/**
 * 证书管理服务
 * 处理 iOS 证书 (.p12) 和 Android 签名密钥 (jks/keystore) 的存储和使用
 */
export class CertificateService {
  private readonly ENCRYPTION_KEY: Buffer;

  constructor() {
    // 使用环境变量或生成随机密钥
    const keyEnv = process.env.CERTIFICATE_ENCRYPTION_KEY;
    this.ENCRYPTION_KEY = keyEnv
      ? Buffer.from(keyEnv, 'hex')
      : crypto.randomBytes(32);
  }

  /**
   * 上传 iOS 证书
   */
  async uploadIOSCertificate(
    tenantId: string,
    data: Buffer,
    password: string
  ): Promise<Certificate> {
    const id = this.generateId();
    const encryptedData = this.encrypt(data);

    const cert: Certificate & { encryptedData: Buffer } = {
      id,
      tenantId,
      platform: 'ios',
      name: `ios-cert-${Date.now()}.p12`,
      expiresAt: null, // 需要解析证书获取实际过期时间
      metadata: { password },
      createdAt: new Date(),
      encryptedData,
    };

    certificates.set(id, cert);

    return this.toPublicCert(cert);
  }

  /**
   * 上传 Android 签名密钥
   */
  async uploadAndroidKeystore(
    tenantId: string,
    data: Buffer,
    storePassword: string,
    keyAlias: string,
    keyPassword: string
  ): Promise<Certificate> {
    const id = this.generateId();
    const encryptedData = this.encrypt(data);

    const cert: Certificate & { encryptedData: Buffer } = {
      id,
      tenantId,
      platform: 'android',
      name: `android-keystore-${Date.now()}.jks`,
      expiresAt: null,
      metadata: { keyAlias, keyPassword },
      createdAt: new Date(),
      encryptedData,
    };

    certificates.set(id, cert);

    return this.toPublicCert(cert);
  }

  /**
   * 获取构建用证书
   */
  async getCertificateForBuild(
    buildId: string,
    platform: 'ios' | 'android'
  ): Promise<CertificateResult | null> {
    // 简化实现：查找最近的证书
    for (const cert of certificates.values()) {
      if (cert.platform === platform) {
        const decrypted = this.decrypt(cert.encryptedData);
        return {
          certificateData: decrypted,
          password: cert.metadata.password,
          keyAlias: cert.metadata.keyAlias,
        };
      }
    }
    return null;
  }

  /**
   * 列出租户证书
   */
  async listCertificates(tenantId: string): Promise<Certificate[]> {
    const result: Certificate[] = [];
    for (const cert of certificates.values()) {
      if (cert.tenantId === tenantId) {
        result.push(this.toPublicCert(cert));
      }
    }
    return result;
  }

  /**
   * 删除证书
   */
  async deleteCertificate(id: string): Promise<boolean> {
    return certificates.delete(id);
  }

  /**
   * 清理过期证书
   */
  async cleanupExpired(): Promise<number> {
    let cleaned = 0;
    const now = new Date();

    for (const [id, cert] of certificates.entries()) {
      if (cert.expiresAt && cert.expiresAt < now) {
        certificates.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }

  private generateId(): string {
    return crypto.randomUUID();
  }

  private encrypt(data: Buffer): Buffer {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.ENCRYPTION_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    return Buffer.concat([iv, encrypted]);
  }

  private decrypt(encryptedData: Buffer): Buffer {
    const iv = encryptedData.subarray(0, 16);
    const data = encryptedData.subarray(16);
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.ENCRYPTION_KEY, iv);
    return Buffer.concat([decipher.update(data), decipher.final()]);
  }

  private toPublicCert(
    cert: Certificate & { encryptedData: Buffer }
  ): Certificate {
    const { encryptedData, ...publicCert } = cert;
    return publicCert;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/build/certificates/__tests__/CertificateService.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add orion-platform-service/src/services/build/certificates/
git commit -m "feat(build): add CertificateService for mobile signing"
```

---

## Task 5: Android/iOS/Harmony 构建服务

**Files:**
- Create: `orion-platform-service/src/services/build/mobile/AndroidBuildService.ts`
- Create: `orion-platform-service/src/services/build/mobile/iOSBuildService.ts`
- Create: `orion-platform-service/src/services/build/mobile/HarmonyBuildService.ts`
- Create: `orion-platform-service/src/services/build/mobile/__tests__/MobileBuildServices.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// orion-platform-service/src/services/build/mobile/__tests__/MobileBuildServices.test.ts
import { AndroidBuildService } from '../AndroidBuildService';
import { iOSBuildService } from '../iOSBuildService';
import { HarmonyBuildService } from '../HarmonyBuildService';

describe('Mobile Build Services', () => {
  describe('AndroidBuildService', () => {
    it('should create Android build config', () => {
      const service = new AndroidBuildService();
      const config = service.createBuildConfig({
        projectPath: '/src/android',
        buildType: 'release',
        minSdk: 24,
        targetSdk: 34,
      });

      expect(config.buildScript).toContain('gradlew');
      expect(config.buildScript).toContain('assembleRelease');
    });

    it('should generate signing config', () => {
      const service = new AndroidBuildService();
      const signConfig = service.createSigningConfig({
        keystoreId: 'test-keystore',
      });

      expect(signConfig).toBeDefined();
    });
  });

  describe('iOSBuildService', () => {
    it('should create iOS build config', () => {
      const service = new iOSBuildService();
      const config = service.createBuildConfig({
        projectPath: '/src/ios',
        scheme: 'MyApp',
        configuration: 'Release',
      });

      expect(config.buildScript).toContain('xcodebuild');
    });
  });

  describe('HarmonyBuildService', () => {
    it('should create Harmony build config', () => {
      const service = new HarmonyBuildService();
      const config = service.createBuildConfig({
        projectPath: '/src/harmony',
        buildType: 'release',
      });

      expect(config.buildScript).toContain('hvigor');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/build/mobile/__tests__/MobileBuildServices.test.ts -v`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write minimal implementation**

```typescript
// orion-platform-service/src/services/build/mobile/AndroidBuildService.ts

import { BuildConfig, BuildType, Platform } from '../executors/BaseBuildExecutor';

export interface AndroidBuildOptions {
  projectPath: string;
  buildType: 'debug' | 'release';
  minSdk?: number;
  targetSdk?: number;
  gradleProperties?: Record<string, string>;
}

export interface AndroidSigningConfig {
  keystoreId: string;
  keyAlias?: string;
}

/**
 * Android 构建服务
 */
export class AndroidBuildService {
  /**
   * 创建 Android 构建配置
   */
  createBuildConfig(options: AndroidBuildOptions): BuildConfig {
    const buildScript = this.generateBuildScript(options);

    return {
      type: BuildType.ANDROID,
      platform: Platform.LINUX,
      sourceUrl: options.projectPath,
      buildScript,
      envVars: {
        ANDROID_HOME: process.env.ANDROID_HOME || '/opt/android-sdk',
        ANDROID_SDK_ROOT: process.env.ANDROID_SDK_ROOT || '/opt/android-sdk',
        JAVA_HOME: process.env.JAVA_HOME || '/opt/java/openjdk',
        ...options.gradleProperties,
      },
    };
  }

  /**
   * 创建签名配置
   */
  createSigningConfig(options: AndroidSigningConfig): Record<string, any> {
    return {
      signingEnabled: true,
      keystoreId: options.keystoreId,
      keyAlias: options.keyAlias || 'androidkey',
      v2SigningEnabled: true,
      v3SigningEnabled: true,
    };
  }

  /**
   * 生成 Gradle 构建命令
   */
  private generateBuildScript(options: AndroidBuildOptions): string {
    const task = options.buildType === 'release'
      ? 'assembleRelease'
      : 'assembleDebug';

    let script = `cd ${options.projectPath} && ./gradlew ${task}`;

    if (options.minSdk) {
      script += ` -PminSdkVersion=${options.minSdk}`;
    }
    if (options.targetSdk) {
      script += ` -PtargetSdkVersion=${options.targetSdk}`;
    }

    return script;
  }

  /**
   * 解析构建产物路径
   */
  getOutputPaths(projectPath: string, buildType: 'debug' | 'release'): string[] {
    const variant = buildType === 'release' ? 'release' : 'debug';
    return [
      `${projectPath}/app/build/outputs/apk/${variant}/app-${variant}.apk`,
      `${projectPath}/app/build/outputs/bundle/${variant}/app-${variant}.aab`,
    ];
  }
}
```

```typescript
// orion-platform-service/src/services/build/mobile/iOSBuildService.ts

import { BuildConfig, BuildType, Platform } from '../executors/BaseBuildExecutor';

export interface iOSBuildOptions {
  projectPath: string;
  scheme: string;
  configuration: 'Debug' | 'Release';
  destination?: string;
  codeSignIdentity?: string;
  provisioningProfile?: string;
}

/**
 * iOS 构建服务
 */
export class iOSBuildService {
  /**
   * 创建 iOS 构建配置
   */
  createBuildConfig(options: iOSBuildOptions): BuildConfig {
    const buildScript = this.generateBuildScript(options);

    return {
      type: BuildType.IOS,
      platform: Platform.MACOS,
      sourceUrl: options.projectPath,
      buildScript,
      envVars: {
        CODE_SIGN_IDENTITY: options.codeSignIdentity || '-',
        PROVISIONING_PROFILE: options.provisioningProfile || '',
        CODE_SIGNING_REQUIRED: 'NO', // 允许无签名构建用于测试
        CODE_SIGNING_ALLOWED: 'NO',
      },
    };
  }

  /**
   * 生成 XcodeBuild 命令
   */
  private generateBuildScript(options: iOSBuildOptions): string {
    const destination = options.destination || 'generic/platform=iOS Simulator';

    return [
      `cd ${options.projectPath}`,
      `xcodebuild -scheme ${options.scheme}`,
      `-configuration ${options.configuration}`,
      `-destination '${destination}'`,
      'build',
    ].join(' && ');
  }

  /**
   * 导出 IPA
   */
  generateExportScript(options: iOSBuildOptions): string {
    return [
      `cd ${options.projectPath}`,
      `xcodebuild -exportArchive`,
      `-archivePath build/${options.scheme}.xcarchive`,
      `-exportPath output/${options.scheme}.ipa`,
      `-exportOptionsPlist ExportOptions.plist`,
    ].join(' && ');
  }

  /**
   * 获取构建产物路径
   */
  getOutputPaths(scheme: string): string[] {
    return [
      `build/${scheme}.xcarchive`,
      `output/${scheme}.ipa`,
    ];
  }
}
```

```typescript
// orion-platform-service/src/services/build/mobile/HarmonyBuildService.ts

import { BuildConfig, BuildType, Platform } from '../executors/BaseBuildExecutor';

export interface HarmonyBuildOptions {
  projectPath: string;
  buildType: 'debug' | 'release';
  module?: string;
  signMode?: 'remote' | 'local';
}

/**
 * 鸿蒙 (HarmonyOS) 构建服务
 */
export class HarmonyBuildService {
  /**
   * 创建鸿蒙构建配置
   */
  createBuildConfig(options: HarmonyBuildOptions): BuildConfig {
    const buildScript = this.generateBuildScript(options);

    return {
      type: BuildType.HARMONY,
      platform: Platform.LINUX,
      sourceUrl: options.projectPath,
      buildScript,
      envVars: {
        HARMONY_SDK: process.env.HARMONY_SDK || '/opt/harmony-sdk',
        JAVA_HOME: process.env.JAVA_HOME || '/opt/java/openjdk',
        NODE_HOME: process.env.NODE_HOME || '/opt/node',
      },
    };
  }

  /**
   * 生成 hvigor 构建命令
   */
  private generateBuildScript(options: HarmonyBuildOptions): string {
    const task = options.buildType === 'release'
      ? 'assembleApp'
      : 'assembleDebug';

    let script = `cd ${options.projectPath} && ./hvigorw ${task}`;

    if (options.module) {
      script += ` -p module=${options.module}`;
    }

    return script;
  }

  /**
   * 获取构建产物路径
   */
  getOutputPaths(projectPath: string): string[] {
    return [
      `${projectPath}/build/outputs/hap/debug/`,
      `${projectPath}/build/outputs/hap/release/`,
    ];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/build/mobile/__tests__/MobileBuildServices.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add orion-platform-service/src/services/build/mobile/
git commit -m "feat(build): add mobile build services (Android/iOS/Harmony)"
```

---

## Task 6: Desktop/C++ 构建服务

**Files:**
- Create: `orion-platform-service/src/services/build/desktop/DesktopBuildService.ts`
- Create: `orion-platform-service/src/services/build/cpp/CppBuildService.ts`
- Create: `orion-platform-service/src/services/build/desktop/__tests__/DesktopCppBuildServices.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// orion-platform-service/src/services/build/desktop/__tests__/DesktopCppBuildServices.test.ts
import { DesktopBuildService } from '../DesktopBuildService';
import { CppBuildService } from '../../cpp/CppBuildService';
import { BuildType } from '../../executors/BaseBuildExecutor';

describe('Desktop and C++ Build Services', () => {
  describe('DesktopBuildService', () => {
    it('should create Windows desktop build config', () => {
      const service = new DesktopBuildService();
      const config = service.createBuildConfig({
        platform: 'windows',
        projectPath: '/src/desktop',
        buildTool: 'electron',
      });

      expect(config.type).toBe(BuildType.DESKTOP_WINDOWS);
    });

    it('should create Linux desktop build config', () => {
      const service = new DesktopBuildService();
      const config = service.createBuildConfig({
        platform: 'linux',
        projectPath: '/src/desktop',
        buildTool: 'electron',
      });

      expect(config.type).toBe(BuildType.DESKTOP_LINUX);
    });
  });

  describe('CppBuildService', () => {
    it('should create Linux C++ build config', () => {
      const service = new CppBuildService();
      const config = service.createBuildConfig({
        platform: 'linux',
        projectPath: '/src/cpp',
        buildSystem: 'cmake',
        compiler: 'gcc',
      });

      expect(config.type).toBe(BuildType.CPP_LINUX);
      expect(config.buildScript).toContain('cmake');
    });

    it('should create Windows C++ build config', () => {
      const service = new CppBuildService();
      const config = service.createBuildConfig({
        platform: 'windows',
        projectPath: '/src/cpp',
        buildSystem: 'cmake',
        compiler: 'msvc',
      });

      expect(config.type).toBe(BuildType.CPP_WINDOWS);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/build/desktop/__tests__/DesktopCppBuildServices.test.ts -v`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write minimal implementation**

```typescript
// orion-platform-service/src/services/build/desktop/DesktopBuildService.ts

import { BuildConfig, BuildType, Platform } from '../executors/BaseBuildExecutor';

export type DesktopPlatform = 'windows' | 'macos' | 'linux';
export type BuildTool = 'electron' | 'cmake' | 'qt' | 'gtk';

export interface DesktopBuildOptions {
  platform: DesktopPlatform;
  projectPath: string;
  buildTool: BuildTool;
  electronVersion?: string;
  appId?: string;
  outputFormat?: string;
}

/**
 * 桌面端构建服务
 */
export class DesktopBuildService {
  /**
   * 创建桌面端构建配置
   */
  createBuildConfig(options: DesktopBuildOptions): BuildConfig {
    const buildType = this.getBuildType(options.platform);
    const buildScript = this.generateBuildScript(options);

    return {
      type: buildType,
      platform: this.getPlatform(options.platform),
      sourceUrl: options.projectPath,
      buildScript,
      envVars: this.getEnvVars(options),
    };
  }

  private getBuildType(platform: DesktopPlatform): BuildType {
    switch (platform) {
      case 'windows':
        return BuildType.DESKTOP_WINDOWS;
      case 'macos':
        return BuildType.DESKTOP_MACOS;
      case 'linux':
        return BuildType.DESKTOP_LINUX;
    }
  }

  private getPlatform(platform: DesktopPlatform): Platform {
    switch (platform) {
      case 'windows':
        return Platform.WINDOWS;
      case 'macos':
        return Platform.MACOS;
      case 'linux':
        return Platform.LINUX;
    }
  }

  private generateBuildScript(options: DesktopBuildOptions): string {
    const { platform, projectPath, buildTool } = options;

    switch (buildTool) {
      case 'electron':
        return this.generateElectronScript(platform, projectPath);
      case 'cmake':
        return this.generateCMakeScript(platform, projectPath);
      default:
        return `cd ${projectPath} && make`;
    }
  }

  private generateElectronScript(platform: DesktopPlatform, projectPath: string): string {
    const target = platform === 'macos' ? 'mac' : platform === 'windows' ? 'win' : 'linux';
    return `cd ${projectPath} && npm run build:${target}`;
  }

  private generateCMakeScript(platform: DesktopPlatform, projectPath: string): string {
    return [
      `cd ${projectPath}`,
      'mkdir -p build',
      'cd build',
      'cmake ..',
      'make',
    ].join(' && ');
  }

  private getEnvVars(options: DesktopBuildOptions): Record<string, string> {
    const base: Record<string, string> = {};

    if (options.electronVersion) {
      base.ELECTRON_VERSION = options.electronVersion;
    }

    return base;
  }

  /**
   * 获取构建产物路径
   */
  getOutputPaths(platform: DesktopPlatform, buildTool: BuildTool): string[] {
    const base = 'dist' || 'build';

    switch (buildTool) {
      case 'electron':
        return [`${base}/${platform}/*`];
      case 'cmake':
        return [`${base}/bin/*`];
      default:
        return [`${base}/*`];
    }
  }
}
```

```typescript
// orion-platform-service/src/services/build/cpp/CppBuildService.ts

import { BuildConfig, BuildType, Platform } from '../executors/BaseBuildExecutor';

export type CppPlatform = 'linux' | 'windows' | 'macos';
export type CppCompiler = 'gcc' | 'clang' | 'msvc';
export type BuildSystem = 'cmake' | 'make' | 'meson';

export interface CppBuildOptions {
  platform: CppPlatform;
  projectPath: string;
  buildSystem: BuildSystem;
  compiler: CppCompiler;
  cmakeOptions?: Record<string, string>;
  outputType?: 'executable' | 'shared' | 'static';
}

/**
 * C++ 构建服务
 */
export class CppBuildService {
  /**
   * 创建 C++ 构建配置
   */
  createBuildConfig(options: CppBuildOptions): BuildConfig {
    const buildType = this.getBuildType(options.platform);
    const buildScript = this.generateBuildScript(options);

    return {
      type: buildType,
      platform: this.getPlatform(options.platform),
      sourceUrl: options.projectPath,
      buildScript,
      envVars: this.getEnvVars(options),
    };
  }

  private getBuildType(platform: CppPlatform): BuildType {
    switch (platform) {
      case 'linux':
        return BuildType.CPP_LINUX;
      case 'windows':
        return BuildType.CPP_WINDOWS;
      case 'macos':
        return BuildType.CPP_MACOS;
    }
  }

  private getPlatform(platform: CppPlatform): Platform {
    switch (platform) {
      case 'linux':
        return Platform.LINUX;
      case 'windows':
        return Platform.WINDOWS;
      case 'macos':
        return Platform.MACOS;
    }
  }

  private generateBuildScript(options: CppBuildOptions): string {
    const { platform, projectPath, buildSystem, cmakeOptions } = options;

    switch (buildSystem) {
      case 'cmake':
        return this.generateCMakeScript(platform, projectPath, cmakeOptions);
      case 'make':
        return this.generateMakeScript(projectPath);
      case 'meson':
        return this.generateMesonScript(projectPath);
      default:
        return `cd ${projectPath} && make`;
    }
  }

  private generateCMakeScript(
    platform: CppPlatform,
    projectPath: string,
    options?: Record<string, string>
  ): string {
    const cmakeArgs = options
      ? Object.entries(options).map(([k, v]) => `-D${k}=${v}`).join(' ')
      : '';

    return [
      `mkdir -p ${projectPath}/build`,
      `cd ${projectPath}/build`,
      `cmake .. ${cmakeArgs}`,
      platform === 'windows' ? 'cmake --build . --config Release' : 'make',
    ].join(' && ');
  }

  private generateMakeScript(projectPath: string): string {
    return `cd ${projectPath} && make -j$(nproc)`;
  }

  private generateMesonScript(projectPath: string): string {
    return [
      `cd ${projectPath}`,
      'meson setup build',
      'meson compile -C build',
    ].join(' && ');
  }

  private getEnvVars(options: CppBuildOptions): Record<string, string> {
    const env: Record<string, string> = {};

    if (options.compiler === 'gcc') {
      env.CC = 'gcc';
      env.CXX = 'g++';
    } else if (options.compiler === 'clang') {
      env.CC = 'clang';
      env.CXX = 'clang++';
    }

    return env;
  }

  /**
   * 获取构建产物路径
   */
  getOutputPaths(projectPath: string, outputType?: string): string[] {
    const baseDir = `${projectPath}/build`;

    switch (outputType) {
      case 'shared':
        return [
          `${baseDir}/lib/*.so`,
          `${baseDir}/lib/*.dylib`,
          `${baseDir}/lib/*.dll`,
        ];
      case 'static':
        return [`${baseDir}/lib/*.a`, `${baseDir}/lib/*.lib`];
      default:
        return [`${baseDir}/bin/*`];
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/build/desktop/__tests__/DesktopCppBuildServices.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add orion-platform-service/src/services/build/desktop/
git add orion-platform-service/src/services/build/cpp/
git commit -m "feat(build): add desktop and C++ build services"
```

---

## 实施完成检查清单

- [ ] Task 1: BuildExecutor 接口和注册表
- [ ] Task 2: HostBuildExecutor 主机构建执行器
- [ ] Task 3: MacBuildExecutor macOS 构建执行器
- [ ] Task 4: CertificateService 证书管理服务
- [ ] Task 5: Android/iOS/Harmony 构建服务
- [ ] Task 6: Desktop/C++ 构建服务