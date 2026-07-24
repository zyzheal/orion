# APK上传到应用市场插件

## 概述

参照 [apkgo](https://github.com/KevinGong2013/apkgo.git) 项目的设计，在Orion CI平台中实现了上传APK到多个应用市场的插件功能。

## 支持的应用市场

| 市场 | 配置Key | 认证方式 |
|------|---------|----------|
| 华为 AppGallery | `huawei` | OAuth2 Client Credentials / Service Account JWT |
| 小米应用商店 | `xiaomi` | RSA非对称加密 |
| OPPO软件商店 | `oppo` | OAuth2 + HMAC-SHA256签名 |
| VIVO应用商店 | `vivo` | HMAC-SHA256签名 |
| 荣耀应用市场 | `honor` | OAuth2 Client Credentials |
| 腾讯应用宝 | `tencent` | HMAC-SHA256签名 |
| 蒲公英 | `pgyer` | API Key |
| fir.im | `fir` | API Token |
| Google Play | `googleplay` | OAuth2 Service Account JWT |
| 三星 Galaxy Store | `samsung` | JWT + Bearer Token |

## Pipeline YAML 配置示例

### 1. 上传到蒲公英（最简单）

```yaml
stages:
  - name: upload
    runsOn: linux
    steps:
      - name: Upload to Pgyer
        uses: apk-upload/upload
        with:
          market: pgyer
          apkPath: app/build/outputs/apk/release/app-release.apk
          packageName: com.example.myapp
          pgyer:
            apiKey: ${secrets.PGYER_API_KEY}
```

### 2. 上传到华为应用市场

```yaml
stages:
  - name: upload-huawei
    runsOn: linux
    steps:
      - name: Upload to Huawei AppGallery
        uses: apk-upload/upload
        with:
          market: huawei
          apkPath: app/build/outputs/apk/release/app-release.apk
          packageName: com.example.myapp
          versionCode: 100
          versionName: 1.0.0
          changelog: |
            - 修复了登录页面的Bug
            - 新增了暗黑模式
          huawei:
            clientId: ${secrets.HUAWEI_CLIENT_ID}
            clientSecret: ${secrets.HUAWEI_CLIENT_SECRET}
```

### 3. 上传到小米应用商店

```yaml
stages:
  - name: upload-xiaomi
    runsOn: linux
    steps:
      - name: Upload to Xiaomi App Store
        uses: apk-upload/upload
        with:
          market: xiaomi
          apkPath: app/build/outputs/apk/release/app-release.apk
          packageName: com.example.myapp
          xiaomi:
            email: ${secrets.XIAOMI_EMAIL}
            privateKey: ${secrets.XIAOMI_PRIVATE_KEY}
            cert: ${secrets.XIAOMI_CERT}
```

### 4. 上传到OPPO软件商店

```yaml
stages:
  - name: upload-oppo
    runsOn: linux
    steps:
      - name: Upload to OPPO App Market
        uses: apk-upload/upload
        with:
          market: oppo
          apkPath: app/build/outputs/apk/release/app-release.apk
          packageName: com.example.myapp
          oppo:
            clientId: ${secrets.OPPO_CLIENT_ID}
            clientSecret: ${secrets.OPPO_CLIENT_SECRET}
```

### 5. 上传到VIVO应用商店

```yaml
stages:
  - name: upload-vivo
    runsOn: linux
    steps:
      - name: Upload to VIVO App Store
        uses: apk-upload/upload
        with:
          market: vivo
          apkPath: app/build/outputs/apk/release/app-release.apk
          packageName: com.example.myapp
          vivo:
            accessKey: ${secrets.VIVO_ACCESS_KEY}
            accessSecret: ${secrets.VIVO_ACCESS_SECRET}
```

### 6. 完整的构建+上传Pipeline

```yaml
name: Android CI/CD Pipeline
description: Build and upload APK to multiple app markets

spec:
  stages:
    - name: checkout
      runsOn: linux
      steps:
        - name: Clone repository
          uses: git/clone
          with:
            repo: https://github.com/org/myapp.git
            branch: main

    - name: build
      runsOn: linux
      steps:
        - name: Build APK
          uses: shell/run
          with:
            script: |
              cd android
              ./gradlew assembleRelease

    - name: upload-pgyer
      runsOn: linux
      steps:
        - name: Upload to Pgyer
          uses: apk-upload/upload
          with:
            market: pgyer
            apkPath: android/app/build/outputs/apk/release/app-release.apk
            packageName: com.example.myapp
            pgyer:
              apiKey: ${secrets.PGYER_API_KEY}

    - name: upload-huawei
      runsOn: linux
      steps:
        - name: Upload to Huawei
          uses: apk-upload/upload
          with:
            market: huawei
            apkPath: android/app/build/outputs/apk/release/app-release.apk
            packageName: com.example.myapp
            changelog: "新版本发布"
            huawei:
              clientId: ${secrets.HUAWEI_CLIENT_ID}
              clientSecret: ${secrets.HUAWEI_CLIENT_SECRET}
```

## 参数说明

### 必需参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `market` | string | 应用市场类型 |
| `apkPath` | string | APK文件路径（相对于workspace） |
| `packageName` 或 `appId` | string | 应用包名 |

### 可选参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `versionCode` | number | 版本号 |
| `versionName` | string | 版本名称 |
| `changelog` | string | 更新日志 |
| `screenshots` | string[] | 截图路径列表 |
| `channel` | string | 发布渠道：production/beta/alpha/internal |
| `timeout` | number | 超时时间（秒），默认300 |

### 市场凭证参数

每个市场有特定的凭证参数，请参照上文的配置示例。

## 架构设计

### 核心接口

```typescript
interface MarketUploader {
  name(): string;
  upload(request: UploadRequest, credentials: MarketCredentials): Promise<UploadResult>;
}
```

### 文件结构

```
orion-platform-service/src/
├── engine/
│   └── TaskRunner.ts                    # 任务执行器，新增apk-upload类型
├── services/pipeline/
│   ├── ApkMarketUploadService.ts        # 核心服务接口
│   └── apk-uploaders.ts                 # 各市场上传器实现
└── engine/__tests__/
    └── TaskRunner.apk-upload.test.ts    # 单元测试
```

## 错误处理

上传失败时，会返回标准的错误分类：

| 错误类型 | 说明 | 处理建议 |
|----------|------|----------|
| `auth_failed` | 认证失败 | 检查凭证配置 |
| `network_retry` | 网络错误 | 可自动重试 |
| `store_busy` | 市场处理中 | 延迟后重试 |
| `policy_block` | 审核/规则拒绝 | 需人工处理 |
| `config_invalid` | 配置缺失 | 检查参数 |

## 扩展新市场

要添加新的应用市场支持，只需：

1. 在 `apk-uploaders.ts` 中实现 `MarketUploader` 接口
2. 在 `TaskRunner.ts` 的 `executeApkUploadTask` 方法中注册新的上传器

## 测试

运行单元测试：

```bash
cd orion-platform-service
npx jest src/engine/__tests__/TaskRunner.apk-upload.test.ts
```
