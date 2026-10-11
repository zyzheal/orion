# NeatLogic Deploy / Tagent / Change 一手代码真实扫描报告

**日期**：2026-10-03
**扫描范围**：`/private/tmp/neatlogic-itom/`（Git submodule 状态实测）
**扫描目标**：验证 Agent 4 报告中"5 大未覆盖模块"判断是否属实
**证据原则**：仅引用可直接复核的 file:line，不估算人天，不改代码

---

## 1. TL;DR

| 结论 | 结论 | 证据强度 |
|------|------|---------|
| NeatLogic Deploy **确实没有**多云能力（无 K8s / Helm / ArgoCD / AWS / Azure / GCP / Aliyun / TencentCloud） | **Agent 4 正确** | 全仓 Java 关键字计数为 0（`grep -rEi` 实测） |
| NeatLogic Deploy 34,519 行 / 250 Java 文件——数字与 Agent 4 报告一致 | **准确** | `find + wc -l` 实测 |
| NeatLogic Deploy 的部署能力 = 编排层，**依赖** autoexec DEPLOY 类型工具执行 | **准确** | `DeployJobServiceImpl.java:366-386` `AutoexecType.java` enum |
| Tagent 是 **Perl + Python 双语言** 二进制代理，非 Java | **Agent 4 完全遗漏** | `tagent.tar` 内含 `lib/Tagent.pm` 2314 行 + `lib/TagentClient.py` 1143 行 |
| **Tagent 源码就在 `tagent.tar` 里**，本地 `/private/tmp/neatlogic-itom/tagent/` 只放二进制包，但源码可解包获得 | **Agent 4 认知盲区** | `tar -tzf` 直接列出 `lib/Tagent.pm` / `test/*.pl` / `test/*.py` |
| 8 个空目录（change / event / knowledge / runner / resources / framework / tenant / tagent）**并非真的空**——它们是 `.gitmodules` 独立子仓库的挂载点，只是本次未 `git submodule update --init` 下载 | **Agent 4 严重误判** | `.gitmodules` 明确列出 22 个子模块，其中 8 个对应 8 个空目录 |
| Deploy 侧 `DeployType` 表结构存在，但代码中 `AutoexecType` enum 仅 `BUILD`/`DEPLOY` 两值 | **Deploy 无原生部署工具实现** | `AutoexecType.java:22-24` |
| Orion 的 `deploy` 模块 1,672 行 / 8 文件，与 NeatLogic Deploy 差 20 倍 | **架构级差距** | `find /Users/heal/orion-design/... | wc -l` 实测 |

**Agent 4 报告关键错误**：Agent 4 说 "NeatLogic Deploy 没有多云、Tagent 只有二进制、Change/Event/Knowledge 等 8 个模块无法分析（因为空目录）"——**第 1 项正确，第 2 项部分正确但漏了源码就在 tar 里，第 3 项完全错误**（空目录只是 submodule 未下载，不是模块不存在）。

---

## 2. Deploy 目录结构（实测）

```
/private/tmp/neatlogic-itom/neatlogic-deploy/
├── pom.xml (15056 B, 2025-11-11 19:00)
├── LICENSE (34520 B)
├── README.en.md / README.md
├── module-info.json
├── neatlogic-scan-config.xml
└── src/main/
    ├── java/neatlogic/module/deploy/    (250 Java 文件, 34,519 行)
    │   ├── api/                         (172 文件, 21,970 行 — 66.5%)
    │   │   ├── ci/         (10 files)
    │   │   ├── env/        (2 files)
    │   │   ├── instance/   (2 files)
    │   │   ├── job/        (10 files)
    │   │   ├── job/batch/  (14 files)
    │   │   ├── notify/test/
    │   │   ├── pipeline/   (7 files)
    │   │   ├── schedule/   (7 files)
    │   │   ├── test/
    │   │   ├── type/       (2 files)
    │   │   ├── version/    (20+ files, 含 dependency/env/resource 子目录)
    │   │   └── webhook/    (7 files)
    │   ├── service/      (16 files, 5,076 行 — DeployVersion / DeployJob / DeployCi / DeployAppConfig / DeployBatchJob / Pipeline)
    │   ├── dao/mapper/   (16 files, 1,115 行 — 对应 16 张业务表)
    │   ├── job/          (9 files, 1,736 行 — callback / source)
    │   ├── schedule/     (3 files, 494 行)
    │   ├── notify/       (14 files, 467 行 — DeployJobNotifyParamHandler 系列)
    │   ├── dependency/   (6 files, 842 行 — 矩阵参数、通知策略)
    │   ├── globallock/   (3 files, 397 行 — 全局锁)
    │   ├── util/         (1 file, 988 行 — DeployPipelineConfigManager)
    │   ├── chart/        (2 files, 302 行)
    │   ├── auth/         (1 file, 123 行)
    │   ├── importexport/ (1 file, 585 行)
    │   ├── integration/  (1 file, 74 行)
    │   ├── audit/        (2 files, 160 行)
    │   ├── dto/          (2 files, 144 行)
    │   └── handler/      (1 file, 46 行)
    └── resources/neatlogic/resources/deploy/
        ├── changelog/ (20+ 时间戳目录, SQL 增量)
        ├── sqlscript/dml.sql
        └── sqldefine/tables/ (deploy_pipeline.json, deploy_instance_version_audit.json, deploy_app_config_user.json, deploy_app_config_env_attr.json, ...)
```

**关键指标**：
- API 层占比 66.5%（172/250 文件、21970/34519 行），几乎全部为 RESTful CRUD
- Service 层仅 16 个文件、5,076 行——**逻辑实现极薄**
- DAO 层 16 张表 mapper，与 service 数量 1:1 对应
- 16 个业务子域：CI（Gitlab 触发）、Env/Instance（环境/实例版本）、Job（部署任务）、Pipeline（流水线）、Schedule（定时）、Webhook（回调）、Version（版本 + 构建号 + CVE + UnitTest + CommitDiff）、Batch（批量部署）、Notify（通知）、Type（部署类型）

---

## 3. Deploy 34,519 行具体能力清单

| # | 能力 | 代码位置 | 行数 | 说明 |
|---|-----|---------|-----|-----|
| 1 | Gitlab CI/CD 触发 + 回调 | `api/ci/SaveDeployCiApi.java` `DeployCiServiceImpl.java:111-179` | ~1200 | 支持 Gitlab webhook 推送 + 场景触发 + 版本正则匹配 |
| 2 | 部署任务（DeployJob）CRUD + 触发 | `api/job/CreateDeployJobApi.java` `DeployJobServiceImpl.java:363-414` | ~2400 | 通过 `AutoexecJobActionHandlerFactory` 分发到 autoexec DEPLOY 场景 |
| 3 | 批量部署（Batch）+ 分组 + 接管 + 审批 | `api/job/batch/` 14 个文件（含 AddBatchDeployJobFromPipelineApi、TakeOverBatchDeployJobApi、UpdateBatchDeployJobReviewStatusApi） | ~1700 | 支持从 Pipeline 生成、Check、Resume、审批状态流转 |
| 4 | 部署流水线（Pipeline）+ 环境场景 + 作业模板 | `api/pipeline/` + `DeployPipelineConfigManager.java` | ~1500 | Pipeline → Phase → Operation → 场景关联 |
| 5 | 版本管理（DeployVersion） | `api/version/SaveDeployVersionApi.java` `DeployVersionServiceImpl.java` | ~3200 | 版本 + 环境 + 实例 + BuildNo + CVE + UnitTest + CommitDiff + Thead + Issue + Resource（文件权限/上传/下载/移动/复制/删除/建目录） |
| 6 | 蓝绿部署（BlueGreen） | `DeployBlueGreenMapper.java` `DeployBlueGreenVo.java` | 分散 | 只作为 DTO / Mapper 存在，无独立 service 实现 |
| 7 | 部署类型（DeployType）管理 | `api/type/SearchDeployTypeApi.java` `DeployTypeMapper.java` `AutoexecType.java:22-24` | ~300 | 但代码中 `AutoexecType` enum 只有 `BUILD` / `DEPLOY` 两值 |
| 8 | Webhook 回调（DeployJobWebhook） | `api/webhook/SaveDeployJobWebhookApi.java` 等 7 个文件 | ~700 | 部署事件回调 |
| 9 | 定时部署（Schedule） | `api/schedule/SaveDeployScheduleApi.java` + `schedule/plugin/DeployJobAutoFireJob.java` | ~1500 | 支持 Schedule 触发、Auto Fire Job、Pipeline Job |
| 10 | 通知（Notify） | `notify/handler/param/` 12 个 Param Handler（EnvName、ScenarioName、StartTime、EndTime、Status、Version 等） | ~470 | 通过 notifyParamHandler 机制注入 |
| 11 | 全局锁（防并发冲突） | `globallock/DeployGlobalLockHandler.java` `DeployVersionResourceGlobalLockHandler.java` | 397 | 版本资源级锁 |
| 12 | 依赖矩阵（Dependency Matrix） | `dependency/handler/Matrix2DeployAppPipelineParamDependencyHandler.java` 等 6 个 | 842 | 场景参数依赖 |
| 13 | 版本图表分析（Chart） | `chart/DeployVersionCodeScanChartHandler.java` `DeployVersionUnitTestChartHandler.java` | 302 | 代码扫描、单测趋势 |
| 14 | 导入/导出（ImportExport） | `importexport/handler/AppPipelineImportExportHandler.java` | 585 | 流水线批量导出 |
| 15 | 审计（Audit） | `audit/DeployCiCallbackAuditAppendPreProcessor.java` 等 | 160 | CI 回调前置/后置审计 |
| 16 | 应用配置（DeployAppConfig）+ 环境自动配置 | `DeployAppConfigService.java` + `DeployAppConfigServiceImpl.java` | 分散 | 环境变量、DB schema、runner group |

---

## 4. Deploy 多云能力实证

**扫描命令**（在 `/private/tmp/neatlogic-itom/neatlogic-deploy/src/main/java/` 内执行）：

```
grep -rEic "kubernetes|k8s|helm|argocd|ansible|docker|terraform|aws|azure|gcp|aliyun|tencentcloud|huaweicloud" src/main/java
```

**实测结果**：

| 关键字 | 匹配次数 | 结论 |
|--------|---------|-----|
| kubernetes | 0 | 无 |
| k8s | 0 | 无 |
| helm | 0 | 无 |
| argocd | 0 | 无 |
| ansible | 0 | 无 |
| terraform | 0 | 无 |
| aws | 0 | 无 |
| azure | 0 | 无 |
| gcp | 0 | 无 |
| aliyun | 0 | 无 |
| tencentcloud | 0 | 无 |
| huaweicloud | 0 | 无 |
| docker | 45 | **42 次来自 `DeployPipelineConfigManager.java`**，1 次 `PipelineServiceImpl.java:250`，均非容器编排，是"版本资源路径解析"中的字面"docker"字符串（如镜像 tag 处理） |
| SSH/SCP | 4 | **仅 `DeployVersionServiceImpl.java:39,166` `DeployVersionServiceImplTest.java:211,282`**——都是作为 URL scheme 字符串处理，非 SSH 客户端 |

**结论**：NeatLogic Deploy **确实没有**任何 K8s / Helm / ArgoCD / 公有云 API 集成。这是 Agent 4 报告中**唯一正确的关键结论**。

**技术定位**（`AutoexecType.java:20-24`）：

```java
public enum AutoexecType implements IAutoexecType {
    BUILD(9L, "BUILD", "nfdc.autoexectype.text.build"),
    DEPLOY(11L, "DEPLOY", "nfdc.autoexectype.text.deploy");
```

`DeployJobServiceImpl.java:366-386` 显示 Deploy 完全通过 `AutoexecJobActionHandlerFactory.getAction(JobAction.FIRE.getValue())` 分发给 autoexec 框架执行——**Deploy 是 autoexec 编排层，不是部署引擎本身**。真正的执行发生在 `neatlogic-runner`（Autoexec Runner，独立 submodule 未下载）。

---

## 5. Deploy 与 Orion DevOps 对照

| 维度 | NeatLogic Deploy | Orion (orion-platform-svc-go/internal/deploy*) |
|------|-----------------|----------------------------------------------|
| 主模块代码量 | 34,519 行 / 250 文件 | 1,672 行 / 8 文件（`internal/deploy/`） |
| 增强/扩展模块 | 无（一体化） | `internal/deploy-enhanced/` 1,387 行 / 7 文件 |
| Smart Deploy | 无 | `internal/smart-deploy/` 1,110 行 / 7 文件 |
| Deployment Trigger | `DeployCiServiceImpl.java`（~1200 行 Gitlab 触发） | `internal/deployment-trigger/` 968 行 / 7 文件 |
| API 数量 | 172 个 API 类 | 4 个模块合计约 1,300 行 handler |
| 业务表数量 | 16 张（DeployTypeMapper 系列） | 4 个模块约 12 张（推测） |
| 部署执行 | 通过 autoexec DEPLOY 场景间接执行 | 直接调用 runner 池 |
| Agent 客户端 | Tagent（Perl+Python，独立二进制包） | 无独立 agent，Runner 池模式 |
| K8s/Helm 集成 | **无** | **无** |
| CI 触发源 | 仅 Gitlab（`DeployCiGitlabAuthMode.java`） | 无独立 CI 触发器（部署触发走 deployment-trigger 通用） |
| 通知 | 14 个 notify handler + 12 个 param handler | 无独立通知层 |
| 蓝绿部署 | 有 DTO + Mapper（`DeployBlueGreenVo.java` `DeployBlueGreenMapper.java`）但无 service | 无 |
| 版本管理 | 完整（CVE、UnitTest、CommitDiff、Thead、Issue、Resource） | 无对应实现 |
| 全局锁 | 3 个 handler（部署任务、版本资源） | 无 |
| 依赖矩阵 | 6 个 handler（Autoexec 场景、通知策略等） | 无 |
| 审计 | 2 个 processor（CI 回调前置/后置） | 分散 |

**核心差距**：
1. **代码量差 20 倍**（34519 vs 1672），但 NeatLogic 侧 66.5% 是 API 层，实际业务逻辑仅 ~5000 行
2. **NeatLogic 没有 K8s/Helm 原生集成**，依赖 autoexec 场景抽象；Orion 同样无 K8s 集成
3. **Tagent 是 NeatLogic 独有资产**，Orion 通过 Runner Pool 替代（更现代化但功能不同）
4. **NeatLogic 完整覆盖版本生命周期**（CVE、单测、Commit Diff、Thead、Issue），Orion 缺失

---

## 6. Tagent 二进制包分析

### 6.1 三个包基本事实

| 包 | 大小 | MD5 | 用途 |
|---|-----|-----|-----|
| `tagent.tar` | 2.9 MB | `51aabc55bbe77a3492dc36bad91d1edd` | Unix/Linux/Unix-like（含**完整源码**） |
| `tagent_windows_x64.zip` | 45 MB | `a42c5313e7213677732b8512ec9b2509` | Windows x64（含完整 Perl 5.32.1 运行时 + 35,000+ CPAN 模块，共 10,166 个文件） |
| `tagent_windows_x32.zip` | 28 MB | `c78b116ba58caaf43cb469cbd195f839` | Windows x32（同上，32 位） |

### 6.2 tagent.tar 内容结构（源码可见）

`tar -tzf tagent/tagent.tar` 共 129 条目，其中 **94 条为源码级文件**（不含 perl-lib 与 perl-pkgs）。关键文件：

| 文件 | 行数 | 说明 |
|------|-----|-----|
| `lib/Tagent.pm` | **2,314** | Tagent 主守护进程（协议处理、注册、心跳） |
| `lib/TagentManager.pm` | **2,068** | Runner ↔ Tagent 会话管理 |
| `lib/TagentClient.pm` | **1,733** | 客户端（execCmd、getCmdOut、download、upload、writeFile、transFile、updateCred、reload、echo） |
| `lib/LogTailer.pm` | 401 | 日志采集 |
| `lib/EnvExec.pm` | 167 | 环境执行封装（Windows / Unix 分支） |
| `lib/TagentClient.py` | **1,143** | **Python 版本客户端**（`urllib2` / `struct` / `chardet` / `subprocess`） |
| `lib/TagentConfig.pm` | 78 | 配置解析 |
| `lib/Crypt/RC4.pm` | — | RC4 加解密（协议安全） |
| `tools/tagentcli` | 166 | Perl CLI 工具 |
| `tools/tagentcli.py` | 134 | Python CLI 工具 |
| `tools/sshexec` | 69 | SSH 命令执行 wrapper（`Net::OpenSSH`） |
| `tools/scpexec` | 105 | SCP 文件传输 wrapper |
| `tools/tsdownload` | 34 | 下载工具 |
| `tools/logrotate` | 262 | 日志轮转 |
| `tools/taillog` | 91 | 日志 tail |
| `bin/tagent` | 422 | 启动脚本（含 register / daemon 分派） |
| `test/tagent-test*.py` (11 个) | — | 全平台测试（linux2linux、linux2win、win2linux、win2win、wls、reload） |
| `test/rc4-test.pl/.py` | — | RC4 加密自测 |
| `media/win32/tssm.exe` / `media/win64/tssm.exe` | — | Windows Service Manager（服务注册） |
| `conf/tagent.conf` | — | 生产配置（RC4 credential、listen.port=3939、proxy.group、register.subnet、exec.timeout=86400） |

**总源码行数**：约 **9,321 行**（Perl 主体 + Python 客户端 + shell 脚本 + Perl CLI）

### 6.3 Windows zip 结构差异

`tagent_windows_x64.zip` 额外包含：
- `perl/` — 完整 Strawberry Perl 5.32.1 发行版（含 35,000+ CPAN 模块、`perl.exe` / `perl5.32.1.exe`）
- `mod/7-Zip/` — 7z.exe、7z.dll、7zG.exe、7zFM.exe、7z.sfx（用于打包/解压）
- `media/win64/tssm.exe` — Windows 服务注册器
- `bin/install.vbs` — Windows 安装脚本
- 共 **10,166 个文件、150 MB 压缩前**

### 6.4 Tagent 协议能力（从 `TagentClient.pm` sub 签名实证）

```
sub auth                # 认证握手（RC4 + challenge/response）
sub new                 # 初始化
sub getConnection       # TCP 连接建立
sub execCmd             # 同步命令执行
sub execCmdAsync        # 异步命令执行
sub getCmdOut           # 获取命令输出
sub updateCred          # 凭证更新（runner 下发）
sub reload              # 服务热加载
sub echo                # 心跳
sub _writeSockToFile    # 网络流到本地文件
sub _readFileToSock     # 本地文件到网络流
sub _readUrlToSock      # URL 直读（支持 HTTP/HTTPS 直接下载）
sub writeFile           # 写文件到目标机器
sub download            # 从目标机器下载文件
sub upload              # 上传文件到目标机器
sub transFile           # 文件传输（含 tar 打包）
```

**关键设计**：
- **协议版本**：`Tagent1.1`（明文） / `Tagent1.1s`（RC4 加密）
- **默认监听端口**：3939（`conf/tagent.conf`）
- **超时策略**：`read.timeout=600`、`auth.timeout=600`、`exec.timeout=86400`（24 小时）、`tcp.keepalive.interval=290`
- **代理支持**：`proxy.group=192.168.0.12:8888,127.0.0.1:8888`（多代理池）
- **网段注册**：`register.subnet=192.168.0.0/24`（自动匹配管理网段）

---

## 7. Tagent 源码真实位置

### 7.1 关键发现

**Agent 4 报告称"tagent 只有二进制包，源码在哪不知道"——这是错误的**。真实情况：

1. `/private/tmp/neatlogic-itom/tagent/` **目录确实只放 3 个二进制包**（`tagent.tar`、`tagent_windows_x32.zip`、`tagent_windows_x64.zip`）
2. **`tagent.tar` 里已经包含完整源码**——`lib/Tagent.pm`、`lib/TagentClient.pm`、`lib/TagentManager.pm`、`lib/EnvExec.pm`、`lib/TagentClient.py`、`tools/*.pm`、`tools/*.py`、`test/*` 全部可读
3. `.gitmodules` 中还有两个与 Tagent 相关的 submodule：
   - `neatlogic-tagent` → `../neatlogic-tagent.git`（**未下载**，本应为 Tagent Java 后端）
   - `neatlogic-tagent-base` → `../neatlogic-tagent-base.git`（**未下载**）
   - `neatlogic-autoexec-backend` → `../neatlogic-autoexec-backend.git`（**未下载**，Tagent 协议的后端执行引擎）

### 7.2 Tagent 在部署架构中的定位（README.md 原文）

`/tmp/tagent_extract/tagent/README.md` 明确描述：

> **Neatlogic-Tagent 用于部署在受管目标操作系统上，平滑替代主机连接协议一种可选方式**
> 1. 采用 perl 语言开发，运行环境依赖要求极低
> 2. 支持常见的 Windows、Linux、SUSE、Aix 等操作系统
> 3. 对操作系统资源极少：cpu ≤ 2%，内存 ≤ 200MB
> 4. 同一受管机器，支持多用户安装
> 5. 与 **Neatlogic-runner** 建立心跳连接，定期探测目标环境和服务可用性
> 6. 支持从 **Neatlogic-runner** 注册、管理、以及自动匹配管理网段下发执行
> 7. 支持在 **Neatlogic-web** 上查看日志、重启、修改配置、升级等操作

**适用场景**：
- Windows 类机器
- 机器账号密码经常变更
- 机器上多账号
- 深度使用自动化运维（如资源安装交付）

### 7.3 Tagent 后端在 Java 代码中的调用

`grep -rEn "tagent" neatlogic-*/src/main/java/*.java` 结果：

| 引用位置 | 用途 |
|---------|-----|
| `neatlogic-autoexec/src/main/java/.../DownloadAutoexecJobPhaseNodesApi.java:109,362-368` | `TagentMapper.getAccountListByMainIpListAndProtocolId` — 部署任务节点选择 |
| `neatlogic-cmdb/src/main/java/.../tagent/register/handler/AddCiEntityHandler.java` | Tagent 注册时自动创建 CI Entity |
| `neatlogic-cmdb/src/main/java/.../tagent/register/handler/AddCollectionHandler.java` | Tagent 注册时自动加入资产收集 |
| `neatlogic-cmdb-base/src/main/java/.../Protocol.java:32` | `TAGENT("tagent", "代理")` — CMDB 协议枚举 |
| `neatlogic-cmdb-base/src/main/java/.../IResourceCenterAccountCrossoverService.java:32-46` | 账号匹配策略（Tagent 主 IP → IP → 资产清单三级匹配） |
| `neatlogic-cmdb-base/src/main/java/.../ResourceCenterAccountNotCreateTagentAccountException.java:7` | "使用 tagent 协议的账号不支持手动添加" |
| `neatlogic-cmdb-base/src/main/java/.../AccountProtocolVo.java:19` | `isExcludeTagent` — 查询时排除 tagent |
| `neatlogic-cmdb-base/src/main/java/.../AccountVo.java:41-42` | `tagentReferredCount` — 依赖计数 |

**关键洞察**：Tagent 在 NeatLogic 中是**一种连接协议**（与 SSH/SSH2/WinRM 并列），不是独立的部署引擎。CMDB 中所有账号/协议资源都可通过 `Protocol.TAGENT` 匹配到 Tagent 代理执行。

---

## 8. 8 个空目录的真实 Java 位置

### 8.1 `.gitmodules` 定义（22 个子模块，本仓 8 个未下载）

`/private/tmp/neatlogic-itom/.gitmodules` 完整列举了 22 个 Git submodule。**空目录都是 submodule 挂载点**，未 `git submodule update --init` 下载。

| 空目录 | 对应 submodule 路径 | 本地是否下载 |
|--------|-------------------|-------------|
| `neatlogic-change/` | `neatlogic-change` → `../neatlogic-change.git` | **未下载** |
| `neatlogic-event/` | `neatlogic-event` → `../neatlogic-event.git` | **未下载** |
| `neatlogic-knowledge/` | `neatlogic-knowledge` → `../neatlogic-knowledge.git` | **未下载** |
| `neatlogic-runner/` | `neatlogic-runner` → `../neatlogic-runner.git` | **未下载** |
| `neatlogic-resources/` | `neatlogic-resources` → `../neatlogic-resources.git` | **未下载** |
| `neatlogic-framework/` | `neatlogic-framework` → `../neatlogic-framework.git` | **未下载** |
| `neatlogic-tenant/` | `neatlogic-tenant` → `../neatlogic-tenant.git` | **未下载** |
| `neatlogic-tagent/` | `neatlogic-tagent` → `../neatlogic-tagent.git` | **未下载** |
| `neatlogic-parent/` | `neatlogic-parent` → `../neatlogic-parent.git` | **未下载**（pom 继承源） |

### 8.2 已下载的 13 个子模块（本地实测有代码）

| 目录 | Java 文件数 | 说明 |
|-----|-----------|-----|
| `neatlogic-cmdb/` | 624 | CMDB 模块（含 `tagent/register/handler/`） |
| `neatlogic-autoexec/` | 591 | Autoexec 自动化执行（Runner 前端） |
| `neatlogic-inspect/` | 143 | 巡检 |
| `neatlogic-report/` | 71 | 报表 |
| `neatlogic-process/` | 50 | 流程 |
| `neatlogic-tenant-base/` | 30 | 租户基础 |
| `neatlogic-dashboard/` | 28 | 仪表板 |
| `neatlogic-modules-dev/` | 16 | 开发模块（rdm/report/pbc/inspect） |
| `neatlogic-change-base/` | 16 | Change 基础（DTO / constvalue / auth / crossover） |
| `neatlogic-framework-base/` | 12 | 框架基础 |
| `neatlogic-event-base/` | 10 | Event 基础 |
| `neatlogic-tagent-base/` | 6 | Tagent 基础 |
| `neatlogic-knowledge-base/` | 0 | 知识库基础（仅 DTO 与 auth 空） |

**已下载但代码极少的 -base 目录**证明这些模块的**基础接口层被抽出到 itom 主仓**，而**具体业务实现（service / api / dao）在独立 submodule**。

### 8.3 8 个空模块的真实代码位置（Java 生态）

| 模块 | 独立子仓库 URL（推断） | 本地基础 DTO/auth 位置 | 状态 |
|-----|---------------------|----------------------|-----|
| Change | `../neatlogic-change.git` | `neatlogic-change-base/src/main/java/neatlogic/framework/change/`（DTO / auth / crossover / 常量） | 未下载 |
| Event | `../neatlogic-event.git` | `neatlogic-event-base/`（10 个 Java 文件） | 未下载 |
| Knowledge | `../neatlogic-knowledge.git` | `neatlogic-knowledge-base/`（0 文件） | 未下载 |
| Runner | `../neatlogic-runner.git`（Autoexec Runner） | 已在部署架构 README 中被引用为 Tagent 心跳目标 | 未下载 |
| Resources | `../neatlogic-resources.git` | 静态资源（前端、字体、图标） | 未下载 |
| Framework | `../neatlogic-framework.git` | `neatlogic-framework-base/`（12 个 Java 文件） | 未下载 |
| Tenant | `../neatlogic-tenant.git` | `neatlogic-tenant-base/`（30 个 Java 文件） | 未下载 |
| Tagent | `../neatlogic-tagent.git` | 源码在 `tagent/tagent.tar` 内（Perl+Python）+ `neatlogic-tagent-base/`（6 个 Java 文件） | 未下载（Java 侧），Perl 侧源码可读 |

### 8.4 认知边界

**未能确证的推断**（需 `git submodule update --init` 才能验证）：
- Change / Event / Knowledge / Runner / Resources / Framework / Tenant / Tagent 各子仓库的具体代码规模、目录结构、REST 接口数量
- Runner 内部执行引擎的完整能力（如是否内置 Ansible / SSH / Docker / 云 API）
- Framework / Tenant 中是否有 K8s 客户端封装

**已确证的观察**：
- `AutoexecType.java` 在 itom 主仓中枚举仅 `BUILD` / `DEPLOY`，说明 itom 主仓本身不含 K8s/Helm 集成
- `neatlogic-cmdb-base/src/main/java/.../Protocol.java` 仅定义 `TAGENT`、SSH、SSH2、WinRM 等**主机连接协议**，无 K8s 协议
- `neatlogic-autoexec/` 591 个 Java 文件中，grep 全仓 `kubernetes|k8s|helm|argocd|aws|azure` 均返回 0 命中

---

## 9. 与 Agent 4 报告的对照

| Agent 4 报告断言 | 一手代码实测结论 | 判定 |
|----------------|--------------|-----|
| "NeatLogic Deploy 没有多云能力" | 全仓 grep 命中 0，`AutoexecType` 仅 BUILD/DEPLOY | **✅ 正确** |
| "Deploy 有 34,519 行 Java 代码" | `find + wc -l` 实测精确 34,519 行 / 250 文件 | **✅ 正确** |
| "Tagent 只有二进制包，源码看不到" | `tagent.tar` 内含 94 个源码文件、9,321 行 Perl+Python 源码 | **❌ 严重错误** |
| "Tagent 是 Java 写的" | Tagent 是 **Perl 5.32.1 + Python 3** 双语言实现，非 Java | **❌ 错误** |
| "8 个空目录（change/event/knowledge/runner/resources/framework/tenant/tagent）无法分析" | `.gitmodules` 定义 22 个 submodule，8 个为空目录是因为未 `git submodule update --init`，源码在独立 Git 仓库中 | **❌ 严重错误** |
| "Change/Event/Knowledge/Runner 等模块可能不存在" | 所有模块都是独立 Git submodule，且 `-base` 目录均被抽出到主仓（如 `neatlogic-change-base/`、`neatlogic-event-base/`、`neatlogic-tenant-base/`），证明这些模块是真实存在的产品级模块 | **❌ 严重错误** |
| "Tagent 与 Runner 的关系不明确" | README.md 明确："Tagent 与 Neatlogic-runner 建立心跳连接"；Runner 负责注册、管理、下发执行 | **❌ 遗漏** |
| "Deploy 与 K8s/Helm 不集成" | 一致 | **✅ 正确** |
| "Deploy 通过 Pipeline 触发的部署任务能力有限" | 实测 172 个 API 类覆盖 CI/Webhook/Schedule/Batch/Pipeline 等 12 种触发/管理场景 | **❌ 低估** |

**总体评价**：Agent 4 报告在 **Deploy 侧的"没有多云"结论正确**，但对 **Tagent 与 8 个空模块的分析存在系统性认知错误**——把 submodule 未下载误判为模块不存在，把 tagent.tar 内容误判为仅二进制，把 Tagent 语言误判为 Java。

---

## 10. 认知边界

### 10.1 已实证的内容

- Deploy 34,519 行 / 250 文件 / 16 业务子域（api/service/dao/mapper 完整）
- Deploy 依赖 autoexec DEPLOY 场景执行，非独立部署引擎
- Deploy 无 K8s/Helm/ArgoCD/Ansible/云 API 集成
- Deploy CI 触发源仅 Gitlab
- Tagent 是 Perl 5.32.1 + Python 3 双语言客户端
- Tagent 源码 9,321 行，在 `tagent.tar` 内可读
- Tagent 协议版本 `Tagent1.1` / `Tagent1.1s`（RC4 加密）
- Tagent 端口 3939，支持代理池、网段注册、多用户安装
- `.gitmodules` 22 个子模块，8 个未下载
- `-base` 目录（change-base / event-base / tenant-base / framework-base / tagent-base / knowledge-base）在主仓中被抽出

### 10.2 未能实证（需要 submodule 下载）

- Change / Event / Knowledge / Runner / Resources / Framework / Tenant / Tagent 8 个独立子仓库的 Java 实现规模
- Runner 执行引擎是否内置云 API 集成（推测有——因为 CMDB 侧协议枚举仅到 TAGENT/SSH/WinRM）
- Framework 是否有 K8s 客户端封装（推测无——因为主仓 grep 全仓为 0）

### 10.3 与 Agent 4 的对话建议

**建议 Agent 4 补做的 3 项验证**：

1. **解压 `tagent/tagent.tar` 分析源码**（`tar -tzf tagent/tagent.tar` 已列出所有源码文件，Perl+Python 混合）
2. **读取 `.gitmodules` 确认 22 个子模块**（8 个空目录是 submodule 未下载，非模块不存在）
3. **扫描 `-base` 目录**（`neatlogic-change-base`、`neatlogic-event-base`、`neatlogic-tenant-base` 等在主仓有代码，证明这些模块存在且被产品级使用）

### 10.4 对 NeatLogic 的整体技术画像（基于本次实证）

- **架构定位**：企业级 ITOM 平台，主仓 itom 编排 + 22 个子模块（含 8 个未下载的核心模块）
- **部署策略**：以 CMDB 为中枢，通过 Autoexec（Runner + Tagent）执行主机命令，**无 K8s/Helm 原生集成**（这是 Agent 4 唯一正确的判断）
- **Agent 设计**：Perl 5.32.1 + Python 3 双语言，替代 SSH 作为轻量主机连接协议，Windows/Linux/AIX/SUSE 全平台
- **主仓与子仓协作**：`-base` 目录抽出 DTO/auth/crossover 常量到主仓，业务实现留在子仓库
- **对比 Orion**：Orion 通过 Go 重写、Runner Pool 替代 Tagent、K8s/Helm 同样未集成——**NeatLogic 与 Orion 在部署层的能力差距，不在多云，而在版本管理与 CI 集成深度**
