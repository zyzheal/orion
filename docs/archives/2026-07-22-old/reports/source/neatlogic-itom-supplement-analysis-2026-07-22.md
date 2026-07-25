# NeatLogic ITOM 补充深度分析报告（框架/ITSM/前端/AI/拓扑）

> **分析对象**: NeatLogic ITOM 4.0.0 中 Git pack 未包含的 5 个关键模块
> **分析日期**: 2026-07-22
> **分析方法**: 从已提取的 16 个模块源码中的 1,415 条框架引用逆向还原框架层；从数据库 DDL 还原 ITSM/拓扑/AI 模块；从项目规范文档还原前端/AI 模块
> **目标**: 补全全量分析，为 Orion 系统提供完整借鉴依据

---

## 目录

1. [neatlogic-framework（全局基础框架）](#1-neatlogic-framework全局基础框架)
2. [neatlogic-itsm（ITSM 流程引擎）](#2-neatlogic-itsmitsm-流程引擎)
3. [neatlogic-web（前端 Vue 项目）](#3-neatlogic-web前端-vue-项目)
4. [neatlogic-ai（AI 推理 + RAG）](#4-neatlogic-ai-ai-推理--rag)
5. [neatlogic-diagram（拓扑图/架构图）](#5-neatlogic-diagram拓扑图架构图)
6. [对 Orion 系统的补充借鉴建议](#6-对-orion-系统的补充借鉴建议)

---

## 1. neatlogic-framework（全局基础框架）

### 1.1 分析说明

`neatlogic-framework` 是 NeatLogic 的**全局基础框架层**，所有业务模块都依赖此模块。其 Bean 由 Spring root-context 加载，天然可被所有子模块访问。由于该模块没有本地 Git 数据，本分析通过**逆向还原**方式进行：从 16 个已提取模块的源码中提取了 **1,415 条唯一框架类引用**，完整重构了框架层的包结构和 API。

### 1.2 框架层包结构（从引用逆向还原）

```
neatlogic.framework/
│
├── alert/                    # 告警基础（110+ 类）
│   ├── adaptor/core/         # 告警适配器管理
│   ├── attr/freemarker/      # 告警属性 Freemarker 模板
│   ├── auth/                 # 告警权限定义（20+ 权限类）
│   ├── breaker/              # 告警熔断器（Handler/Action 工厂模式）
│   ├── config/               # 告警配置
│   ├── crossover/            # 告警跨模块引用
│   ├── dao/mapper/           # 告警共享 DAO
│   ├── dto/                  # 告警 DTO/Vo（40+ 类）
│   ├── enums/                # 告警枚举
│   ├── event/                # 告警事件
│   ├── exception/            # 告警异常
│   └── utils/                # 告警工具类
│
├── applicationlistener/      # 应用监听
│   └── core/                 # ModuleInitializedListenerBase
│
├── asynchronization/         # 异步处理
│   ├── taskmanager/          # AsyncTaskManager
│   ├── thread/               # NeatLogicThread
│   ├── threadlocal/          # InputFromContext, RequestContext, TenantContext, UserContext
│   └── threadpool/           # CachedThreadPool, ScheduledThreadPool, TransactionSynchronizationPool
│
├── auditconfig/              # 审计配置
│   └── core/                 # AuditCleanerBase
│
├── auth/                     # 认证框架（核心）
│   ├── core/                 # AuthAction, AuthActionChecker, AuthBase, AuthFactory
│   └── label/                # ADMIN, DATA_WAREHOUSE_BASE, MQ_MODIFY, NoAuth, NOTIFY_POLICY_MODIFY
│
├── autoexec/                 # 自动化基础（60+ 类）
│   ├── annotation/           # 自动化注解
│   ├── auth/                 # 自动化权限
│   ├── config/               # 自动化配置
│   ├── constvalue/           # 自动化常量
│   ├── crossover/            # 自动化跨模块引用
│   ├── dao/                  # 自动化共享 DAO
│   ├── dto/                  # 自动化 DTO/Vo
│   ├── exception/            # 自动化异常
│   ├── job/                  # 作业相关
│   ├── notify/               # 自动化通知
│   ├── script/               # 脚本相关
│   ├── scriptcheck/          # 脚本校验
│   ├── source/               # 执行源
│   ├── type/                 # 操作类型
│   └── util/                 # 自动化工具
│
├── batch/                    # 批处理
│   └── BatchRunner
│
├── bootstrap/                # 应用引导
│   └── NeatLogicWebApplicationContext
│
├── change/                   # 变更管理基础
│   ├── constvalue/           # 变更常量
│   ├── dto/                  # 变更 DTO
│   └── exception/            # 变更异常
│
├── cmdb/                     # CMDB 基础（100+ 类）
│   ├── annotation/           # CMDB 注解
│   ├── attrvaluehandler/     # 属性值处理器
│   ├── auth/                 # CMDB 权限
│   ├── cientityevent/        # CI 事件
│   ├── crossover/            # CMDB 跨模块引用
│   ├── dao/                  # CMDB 共享 DAO
│   ├── dataconversion/       # 数据转换
│   ├── diagram/              # 图可视化
│   ├── dto/                  # CMDB DTO/Vo
│   ├── enums/                # CMDB 枚举
│   ├── exception/            # CMDB 异常
│   ├── resourcecenter/       # 资源中心
│   ├── utils/                # CMDB 工具
│   └── validator/            # 校验器
│
├── common/                   # 通用工具（40+ 类）
│   ├── audit/                # AuditVoHandler
│   ├── config/               # Config, IConfigListener
│   ├── constvalue/           # ApiParamType, AuthType, CacheControlType, Expression, IEnum, MimeType...
│   ├── dto/                  # BaseEditorVo, BasePageVo, ValueTextVo
│   └── util/                 # FileUtil, IpUtil, ModuleUtil, PageUtil, RC4Util, StringUtil
│
├── condition/                # 条件引擎
│   ├── core/                 # IConditionHandler
│   └── dto/                  # ConditionBaseVo, ConditionConfigBaseVo, ConditionGroupBaseVo
│
├── config/                   # 配置管理
│   ├── ConfigManager         # 全局配置管理
│   └── ITenantConfig         # 租户配置接口
│
├── crossover/                # 跨模块引用工厂（核心）
│   ├── CrossoverServiceFactory  # 跨模块服务工厂
│   ├── ICrossoverService      # 跨模块服务接口
│   ├── IFileCrossoverService  # 文件跨模块服务
│   └── IScheduleCrossoverService # 调度跨模块服务
│
├── dao/                      # DAO 框架
│   └── mapper/               # DataBaseViewInfoMapper, RoleMapper, RunnerMapper, SchemaMapper, TagMapper, TeamMapper, UserMapper...
│
├── dashboard/                # 仪表盘基础
│   ├── charts/               # 图表
│   ├── config/               # 配置
│   ├── constvalue/           # 常量
│   ├── dto/                  # DTO
│   └── enums/                # 枚举
│
├── datawarehouse/            # 数据仓库
│   ├── dao/mapper/           # DataWarehouseDataSourceMapper
│   └── dto/                  # DataSourceFieldVo, DataSourceVo
│
├── dependency/               # 依赖管理
│   ├── constvalue/           # FrameworkFromType
│   ├── core/                 # CustomDependencyHandlerBase, DefaultDependencyHandlerBase, DependencyManager, IFromType
│   └── dto/                  # DependencyInfoVo, DependencyVo
│
├── deploy/                   # 发布管理基础
│   ├── auth/                 # 发布权限
│   ├── chart/                # 发布图表
│   ├── constvalue/           # 发布常量
│   ├── crossover/            # 发布跨模块引用
│   ├── dto/                  # 发布 DTO
│   ├── exception/            # 发布异常
│   └── notify/               # 发布通知
│
├── dto/                      # 通用 DTO
│
├── exception/                # 异常体系（50+ 类）
│   ├── condition/            # ConditionNotFoundException
│   ├── core/                 # ApiRuntimeException, NotFoundEditTargetException
│   ├── database/             # DataBaseNotFoundException
│   ├── elasticsearch/        # ElasticSearchDeleteDocumentException, ElasticSearchDeleteFieldException...
│   ├── file/                 # FileAccessDeniedException, FileExtNotAllowedException, FileNotFoundException...
│   ├── integration/          # IntegrationHandlerNotFoundException, IntegrationNotFoundException...
│   └── ...
│
├── file/                     # 文件处理
│
├── filter/                   # 过滤器
│   └── core/                 # LoginAuthHandlerBase
│
├── form/                     # 表单引擎（15+ 类）
│   ├── attribute/core/       # FormAttributeDataConversionHandlerFactory, FormHandlerBase, IFormAttributeDataConversionHandler
│   ├── constvalue/           # FormConditionModel, FormHandler, IFormHandler
│   ├── dao/mapper/           # FormMapper
│   ├── dto/                  # AttributeDataVo, FormAttributeVo, FormVersionVo, FormVo
│   ├── exception/            # AttributeValidException, FormActiveVersionNotFoundException...
│   └── service/              # IFormCrossoverService
│
├── fulltextindex/            # 全文索引（10+ 类）
│   ├── core/                 # FullTextIndexHandlerBase, FullTextIndexHandlerFactory, IFullTextIndexHandler, IFullTextIndexType
│   ├── dto/                  # FullTextIndexTypeVo, FullTextIndexVo, DocumentTypeVo, DocumentVo
│   └── utils/                # FullTextIndexUtil
│
├── globalsearch/             # 全局搜索
│   └── core/                 # GlobalSearchManager
│
├── graphviz/                 # 图可视化（GraphViz）
│   ├── Graphviz              # GraphViz 构建器
│   ├── Layer                 # 图层
│   ├── Link                  # 图边
│   ├── Node                  # 图节点
│   └── enums/                # LayoutType
│
├── healthcheck/              # 健康检查
│   └── dao/mapper/           # DatabaseFragmentMapper
│
├── importexport/             # 导入导出（10+ 类）
│   ├── constvalue/           # FrameworkImportExportHandlerType
│   ├── core/                 # ImportExportHandler, ImportExportHandlerBase, ImportExportHandlerFactory
│   ├── dto/                  # ImportDependencyTypeVo, ImportExportBaseInfoVo, ImportExportPrimaryChangeVo
│   └── exception/            # ExportNoAuthException, ImportExportHandlerNotFoundException
│
├── initialdata/              # 初始化数据
│   └── core/                 # IAfterInitialDataImportHandler, IInitialDataDefiner
│
├── integration/              # 系统集成（15+ 类）
│   ├── authentication/enums/ # AuthenticateType
│   ├── core/                 # IIntegrationHandler, IntegrationHandlerBase, IntegrationHandlerFactory
│   ├── dao/mapper/           # IntegrationMapper
│   └── dto/                  # IntegrationResultVo, IntegrationVo, PatternVo
│
├── inspect/                  # 巡检基础
│   └── constvalue/           # AutoexecType
│
├── lcs/                      # 基线/LCS 管理
│   ├── constvalue/           # ChangeType, LineHandler
│   └── util/                 # LCSUtil, BaseLineVo, SegmentPair
│
├── lock/                     # 锁
│   └── dao/mapper/           # LockMapper
│
├── matrix/                   # 矩阵管理
│
├── message/                  # 消息
│   └── core/                 # MessageHandlerBase
│
├── mq/                       # 消息队列（10+ 类）
│   ├── core/                 # ITopic, SubscribeHandlerBase, TopicBase, TopicFactory
│   └── dto/                  # SubscribeVo, TopicVo
│
├── notify/                   # 通知引擎（15+ 类）
│   ├── core/                 # INotifyParam, INotifyParamHandler, INotifyPolicyHandler, NotifyPolicyHandlerBase...
│   ├── crossover/            # INotifyServiceCrossoverService
│   ├── dao/mapper/           # NotifyMapper
│   └── dto/                  # InvokeNotifyPolicyConfigVo, NotifyPolicyVo, NotifyReceiverVo, NotifyTriggerVo
│
├── process/                  # 流程引擎基础（80+ 类）
│   ├── audithandler/core/    # IProcessTaskAuditDetailType, IProcessTaskAuditType, IProcessTaskStepAuditDetailHandler
│   ├── auth/                 # PROCESS, PROCESS_BASE, PROCESS_MODIFY
│   ├── condition/core/       # ProcessTaskConditionFactory
│   ├── constvalue/           # FailPolicy, ProcessStepMode, ProcessTaskStatus, ProcessUserType...
│   ├── crossover/            # ICatalogCrossoverService, IProcessCrossoverMapper, IProcessStepHandlerCrossoverUtil...
│   ├── dto/                  # ActionConfigVo, ProcessStepVo, ProcessTaskVo, ProcessVo...
│   ├── exception/            # ProcessTaskPermissionDeniedException, ProcessStepHandlerNotFoundException...
│   └── notify/               # ProcessTaskNotifyParam, ProcessTaskStepNotifyParam
│
├── rebuilddatabaseview/      # 数据库视图重建
│   └── core/                 # IRebuildDataBaseView, ViewStatusInfo
│
├── restful/                  # REST 框架（核心）
│   ├── annotation/           # AuthUser, Description, EntityField, Input, OperationType, Output, Param
│   ├── constvalue/           # ApiAnonymousAccessSupportEnum, OperationTypeEnum
│   ├── core/                 # IValid
│   ├── core/privateapi/      # PrivateApiComponentBase, PrivateBinaryStreamApiComponentBase
│   └── groupsearch/core/     # GroupSearchOptionVo, GroupSearchVo, IGroupSearchHandler
│
├── scheduler/                # 调度框架（12+ 类）
│   ├── annotation/           # Prop
│   ├── core/                 # IJob, JobBase, SchedulerManager
│   ├── dao/mapper/           # SchedulerMapper
│   ├── dto/                  # JobObject, JobStatusVo, JobVo
│   ├── enums/                # JobLoadTriggerType
│   └── exception/            # ScheduleHandlerNotFoundException, ScheduleIllegalParameterException
│
├── service/                  # 服务层
│   └── AuthenticationInfoService
│
├── sqlgenerator/             # SQL 动态生成
│   ├── $sql                  # SQL 构建器
│   ├── ExpressionVo          # 表达式
│   ├── JoinVo                # 连接
│   ├── SqlVo                 # SQL 对象
│   └── ValueVo               # 值对象
│
├── startup/                  # 启动
│   └── StartupBase
│
├── store/                    # 数据存储
│   ├── elasticsearch/        # ElasticsearchClientFactory, ElasticsearchDocumentBase, IElasticsearchDocument
│   └── mysql/                # DatabaseVendor, DatasourceManager, NeatLogicBasicDataSource
│
├── tagent/                   # Agent 管理
│   ├── dao/mapper/           # TagentMapper
│   ├── dto/                  # TagentVo
│   ├── enums/                # TagentFromType
│   └── register/core/        # AfterRegisterBase
│
├── tenantinit/               # 租户初始化
│   └── TenantInitBase
│
├── transaction/              # 事务
│   ├── core/                 # AfterTransactionJob, EscapeTransactionJob
│   └── util/                 # TransactionUtil
│
├── userexportfile/           # 用户导出文件
│   ├── core/                 # ExportFileManager, IUserExportFileType
│
└── util/                     # 工具类（30+ 类）
    ├── $                     # 快捷工具
    ├── AviatorEvaluatorUtil  # 表达式求值
    ├── EmailUtil             # 邮件
    ├── excel/                # ExcelBuilder, SheetBuilder
    ├── FileSafeUtil          # 安全文件
    ├── FormUtil              # 表单
    ├── FreemarkerUtil        # 模板
    ├── HtmlUtil              # HTML
    ├── HttpRequestUtil       # HTTP
    ├── I18n/I18nUtils        # 国际化
    ├── javascript/           # JavascriptResult, JavascriptUtil
    ├── Md5Util               # MD5
    ├── NotifyPolicyUtil      # 通知策略
    ├── RegexUtils            # 正则
    ├── RestUtil              # REST
    ├── SnowflakeUtil         # 雪花 ID
    ├── SpringContextUtil     # Spring 上下文
    ├── TableResultUtil       # 分页结果
    ├── TimeUtil              # 时间
    ├── UuidUtil              # UUID
    └── word/                 # WordBuilder (FontColor, FontFamily, TableColor, TitleType)
```

### 1.3 框架层核心设计模式

#### 1.3.1 注解驱动 REST 框架

```
框架类: neatlogic.framework.restful.*

注解体系:
  @AuthAction(action = XXX_BASE.class)  → 权限控制（权限类实现 AuthBase）
  @OperationType(type = OperationTypeEnum.SEARCH/SAVE/UPDATE/DELETE)  → 操作类型
  @Description(value = "...")           → 接口描述
  @Input(params = {...})                → 输入参数
  @Output(params = {...})               → 输出参数
  @Param(name = "...", type = ApiParamType.XXX) → 参数类型
  @EntityField(name = "...", type = ApiParamType.XXX) → 实体字段

入口类:
  PrivateApiComponentBase               → 私有 API 基类（所有 API 继承此类）
  PrivateBinaryStreamApiComponentBase   → 二进制流 API 基类

分组搜索:
  GroupSearchOptionVo                   → 分组搜索选项
  GroupSearchVo                         → 分组搜索参数
  IGroupSearchHandler                   → 分组搜索处理器接口
```

#### 1.3.2 认证框架

```
neatlogic.framework.auth.core/

AuthBase         → 权限基类（所有权限类继承）
AuthAction       → 权限注解
AuthActionChecker → 权限检查器
AuthFactory      → 权限工厂

使用方式:
  // 1. 定义权限类
  public class CMDB_CI_MODIFY extends AuthBase { ... }

  // 2. 在 API 上声明权限
  @AuthAction(action = CMDB_CI_MODIFY.class)
  public class SaveCiApi extends PrivateApiComponentBase { ... }
```

#### 1.3.3 跨模块引用工厂

```
neatlogic.framework.crossover/

CrossoverServiceFactory     → 跨模块服务工厂（核心）
ICrossoverService           → 跨模块服务接口
IFileCrossoverService       → 文件跨模块服务
IScheduleCrossoverService   → 调度跨模块服务

使用方式:
  // 从框架获取其他模块的服务
  ICmdbCrossoverService cmdbService =
      CrossoverServiceFactory.tryToGetApi(ICmdbCrossoverService.class);
```

#### 1.3.4 通知引擎

```
neatlogic.framework.notify/

核心接口:
  INotifyParam              → 通知参数
  INotifyParamHandler       → 通知参数处理器
  INotifyPolicyHandler      → 通知策略处理器
  INotifyPolicyHandlerGroup → 通知策略处理器组
  INotifyTriggerType        → 通知触发类型

使用方式:
  // 1. 定义通知参数处理器
  @Component
  public class AlertNotifyParamHandler extends NotifyPolicyHandlerBase { ... }

  // 2. 注册到工厂
  // NotifyPolicyHandlerFactory 自动扫描并注册
```

#### 1.3.5 调度框架

```
neatlogic.framework.scheduler/

核心接口:
  IJob                      → 任务接口
  JobBase                   → 任务基类
  SchedulerManager          → 调度管理器

注解:
  @Prop                     → 调度属性

任务类型:
  JobObject                 → 任务对象
  JobStatusVo               → 任务状态
  JobLoadTriggerType        → 加载触发类型
```

#### 1.3.6 表单引擎

```
neatlogic.framework.form/

核心:
  FormVo                    → 表单定义
  FormVersionVo             → 表单版本
  FormAttributeVo           → 表单属性
  FormHandlerBase           → 属性处理器基类
  IFormAttributeDataConversionHandler → 数据转换处理器

异常:
  FormNotFoundException, FormAttributeNotFoundException,
  FormAttributeRequiredException, AttributeValidException
```

#### 1.3.7 全文索引 + 全局搜索

```
neatlogic.framework.fulltextindex/
  IFullTextIndexHandler     → 全文索引处理器
  FullTextIndexHandlerFactory → 全文索引处理器工厂
  FullTextIndexHandlerType  → 索引类型枚举
  FullTextIndexUtil         → 索引工具

neatlogic.framework.globalsearch/
  GlobalSearchManager       → 全局搜索管理器

支持的索引类型:
  autoexec, cmdb, framework, knowledge, process, rdm
```

#### 1.3.8 异步处理

```
neatlogic.framework.asynchronization/

线程管理:
  NeatLogicThread           → 自定义线程
  CachedThreadPool          → 缓存线程池
  ScheduledThreadPool       → 定时线程池
  TransactionSynchronizationPool → 事务同步线程池

线程上下文:
  TenantContext             → 租户上下文
  UserContext               → 用户上下文
  RequestContext            → 请求上下文
  InputFromContext          → 输入来源上下文
```

#### 1.3.9 图可视化（GraphViz）

```
neatlogic.framework.graphviz/

Graphviz                    → GraphViz 构建器
  ├── Builder(LayoutType)   → 图构建器（支持多种布局）
  ├── Node.Builder          → 节点构建器
  │   ├── withLabel()       → 标签
  │   ├── withTooltip()     → 提示
  │   ├── withImage()       → 图标
  │   ├── withColor()       → 颜色
  │   └── ...
  └── Link.Builder          → 边构建器
      ├── withLabel()       → 标签
      ├── withArrow()       → 箭头
      └── ...

LayoutType                  → 布局类型（dot/neato/fdp/sfdp/twopi/circo）
```

#### 1.3.10 SQL 动态生成

```
neatlogic.framework.sqlgenerator/

$sql            → SQL 构建器（支持动态拼接）
ExpressionVo    → 表达式
JoinVo          → 连接条件
SqlVo           → SQL 对象
ValueVo         → 值对象
```

### 1.4 框架层与业务模块关系

```
业务模块的 -base 层:
  neatlogic.framework.alert.*      → neatlogic-alert-base 暴露给其他模块的类
  neatlogic.framework.autoexec.*   → neatlogic-autoexec-base 暴露给其他模块的类
  neatlogic.framework.cmdb.*       → neatlogic-cmdb-base 暴露给其他模块的类
  neatlogic.framework.deploy.*     → neatlogic-deploy-base 暴露给其他模块的类
  neatlogic.framework.change.*     → neatlogic-change-base 暴露给其他模块的类
  neatlogic.framework.dashboard.*  → neatlogic-dashboard-base 暴露给其他模块的类
  neatlogic.framework.process.*    → neatlogic-itsm-base 暴露给其他模块的类

框架层:
  neatlogic.framework.common.*     → 通用工具（所有模块可用）
  neatlogic.framework.restful.*    → REST 框架（所有模块可用）
  neatlogic.framework.auth.*       → 认证框架（所有模块可用）
  neatlogic.framework.notify.*     → 通知框架（所有模块可用）
  neatlogic.framework.scheduler.*  → 调度框架（所有模块可用）
  neatlogic.framework.form.*       → 表单引擎（所有模块可用）
  neatlogic.framework.integration.* → 集成框架（所有模块可用）
  neatlogic.framework.crossover.*  → 跨模块引用（所有模块可用）
  neatlogic.framework.fulltextindex.* → 全文索引（所有模块可用）
  neatlogic.framework.globalsearch.* → 全局搜索（所有模块可用）
  neatlogic.framework.sqlgenerator.* → SQL 动态生成（所有模块可用）
  neatlogic.framework.graphviz.*   → 图可视化（所有模块可用）
  neatlogic.framework.importexport.* → 导入导出（所有模块可用）
  neatlogic.framework.store.*      → 数据存储（ES + MySQL）
  neatlogic.framework.asynchronization.* → 异步处理（所有模块可用）
  neatlogic.framework.tagent.*     → Agent 管理
  neatlogic.framework.lcs.*        → 基线/LCS 管理
  neatlogic.framework.datawarehouse.* → 数据仓库
  neatlogic.framework.rebuilddatabaseview.* → 数据库视图重建
```

---

## 2. neatlogic-itsm（ITSM 流程引擎）

### 2.1 分析说明

`neatlogic-itsm` 是 NeatLogic 的 **ITSM（IT Service Management）流程引擎**，是平台的**核心业务流程层**。分析基于：
- 数据库中的 **107 张流程/任务相关表**（`process_*` + `processtask_*`）
- 框架层 `neatlogic.framework.process.*` 的 **80+ 类引用**
- 已提取的 `neatlogic-change` 模块中的流程集成代码
- 开发规范文档中的流程相关规范

### 2.2 流程引擎架构

```
neatlogic-itsm/
├── api/
│   ├── process/              # 流程定义管理
│   ├── processtask/          # 流程任务管理
│   ├── workcenter/           # 工作台
│   ├── sla/                  # SLA 管理
│   ├── score/                # 评分
│   ├── tag/                  # 标签
│   ├── workcenter/           # 工作中心
│   └── ...
├── audithandler/             # 审计处理
├── auth/label/               # 权限标签
├── dao/mapper/               # MyBatis Mapper
├── notify/                   # 通知
├── schedule/plugin/          # 调度插件
├── service/                  # 业务服务
├── stephandler/              # 步骤处理器
│   ├── component/            # 步骤组件
│   └── utilhandler/          # 工具处理器
├── config/                   # 配置
├── initialdata/handler/      # 初始化数据
└── ...
```

### 2.3 核心数据模型（107 张表）

#### 2.3.1 流程定义层

```
process                 -- 流程定义（JSON 配置驱动）
├── config (longtext)   -- 流程图配置（JSON，包含 SLA、步骤、处理人等）
├── is_active           -- 是否激活
├── process_step        -- 流程步骤
│   ├── process_step_handler  -- 步骤处理器
│   ├── process_step_rel      -- 步骤关系
│   ├── process_step_tag      -- 步骤标签
│   ├── process_step_sla      -- 步骤 SLA
│   ├── process_step_notify_policy  -- 步骤通知策略
│   ├── process_step_worker_dispatcher -- 工作分发器
│   └── process_step_worker_policy    -- 工作策略
├── process_form        -- 流程表单
├── process_sla         -- 流程 SLA
├── process_score_template  -- 评分模板
├── process_tag         -- 流程标签
├── process_integration -- 流程集成
└── process_notify_policy   -- 流程通知策略
```

**流程配置 JSON 结构示例**（从 `neatlogic_demo.sql` 提取）:

```json
{
  "process": {
    "slaList": [{
      "calculateHandler": "DefaultSlaCalculateHandler",
      "transferPolicyList": [],
      "processStepUuidList": ["e2c62e...", "0e380b2...", "022dacc..."],
      "calculatePolicyList": [{
        "enablePriority": 1,
        "unit": "minute",
        "conditionGroupList": [],
        "time": 0,
        "priorityList": [{
          "unit": "minute",
          "name": "",
          "time": 30,
          "priorityUuid": "08ca6c7..."
        }]
      }],
      "uuid": "1493f4f...",
      "conditionGroupRelList": []
    }],
    "name": "事件SLA时效",
    "uuid": "5f6ff8b..."
  }
}
```

#### 2.3.2 流程任务执行层

```
processtask               -- 流程任务（实例）
├── processtask_content   -- 任务内容
├── processtask_form      -- 任务表单
├── processtask_form_content -- 表单内容
├── processtask_formattribute -- 表单属性
├── processtask_step      -- 任务步骤
│   ├── processtask_step_content      -- 步骤内容
│   ├── processtask_step_data         -- 步骤数据
│   ├── processtask_step_worker       -- 步骤处理人
│   ├── processtask_step_user         -- 步骤用户
│   ├── processtask_step_sla          -- 步骤 SLA
│   ├── processtask_step_notify_policy -- 步骤通知
│   ├── processtask_step_timer        -- 步骤定时器
│   ├── processtask_step_remind       -- 步骤提醒
│   ├── processtask_step_tag          -- 步骤标签
│   ├── processtask_step_audit        -- 步骤审计
│   ├── processtask_step_audit_detail -- 步骤审计详情
│   ├── processtask_step_change_create -- 步骤创建变更
│   ├── processtask_step_change_handle -- 步骤处理变更
│   ├── processtask_step_event        -- 步骤事件
│   ├── processtask_step_diagram      -- 步骤图
│   ├── processtask_step_eoa          -- 步骤电子审批
│   └── processtask_step_reapproval_restore_backup -- 步骤重新审批/备份恢复
├── processtask_file      -- 任务文件
├── processtask_score     -- 任务评分
├── processtask_action    -- 任务操作
├── processtask_agent     -- 任务代理人
├── processtask_agent_target -- 代理人目标
├── processtask_assignworker -- 任务分配
├── processtask_focus     -- 任务关注
├── processtask_converge  -- 任务汇聚
├── processtask_urge      -- 任务催办
├── processtask_sla       -- 任务 SLA
├── processtask_sla_time  -- 任务 SLA 时间
├── processtask_sla_notify -- 任务 SLA 通知
├── processtask_sla_transfer -- 任务 SLA 转移
├── processtask_repeat    -- 任务重复
├── processtask_tag       -- 任务标签
├── processtask_relation  -- 任务关系
├── processtask_time_cost -- 任务耗时
├── processtask_invoke    -- 任务调用
└── processtask_config    -- 任务配置
```

#### 2.3.3 工作中心

```
process_workcenter                -- 工作中心
├── process_workcenter_authority  -- 权限
├── process_workcenter_catalog    -- 目录
├── process_workcenter_owner      -- 负责人
├── process_workcenter_thead      -- 线程
├── process_workcenter_thead_config -- 线程配置
└── process_workcenter_user_profile -- 用户档案
```

#### 2.3.4 知识库集成

```
processtask_collection            -- 任务收集
├── processtask_collection_definition -- 收集定义
├── processtask_collection_form -- 收集表单
├── processtask_collection_phase  -- 收集阶段
└── processtask_collection_preparation -- 收集准备
```

### 2.4 核心设计模式

#### 2.4.1 步骤处理器工厂模式

```
neatlogic.framework.process.stephandler/

ProcessStepHandlerNotFoundException → 步骤处理器不存在异常
ProcessStepUtilHandlerNotFoundException → 工具处理器不存在异常

框架层:
  IProcessStepHandlerCrossoverUtil → 步骤处理器跨模块工具
  ProcessTaskConditionFactory      → 条件工厂

业务层:
  stephandler/component/           → 步骤组件
  stephandler/utilhandler/         → 工具处理器

每个步骤类型有一个独立的处理器类，通过工厂模式注册和调用。
```

#### 2.4.2 审计处理器

```
neatlogic.framework.process.audithandler/

IProcessTaskAuditDetailType  → 审计详情类型
IProcessTaskAuditType        → 审计类型
IProcessTaskStepAuditDetailHandler → 步骤审计详情处理器

审计粒度:
  processtask_step_audit        → 步骤级审计
  processtask_step_audit_detail → 步骤详情级审计
```

#### 2.4.3 SLA 管理

```
process_sla                    → 流程 SLA 定义
process_sla_notify_policy      → SLA 通知策略
processtask_sla                → 任务 SLA
processtask_sla_time           → SLA 时间记录
processtask_sla_notify         → SLA 通知记录
processtask_sla_transfer       → SLA 转移记录
processtask_step_sla           → 步骤 SLA
processtask_step_sla_delay     → 步骤 SLA 延迟
processtask_step_sla_time      → 步骤 SLA 时间

SLA 配置（JSON）:
  calculateHandler: "DefaultSlaCalculateHandler"
  transferPolicyList: [...]
  calculatePolicyList: [{
    enablePriority: 1,
    unit: "minute",
    conditionGroupList: [],
    priorityList: [{time: 30, unit: "minute"}]
  }]
```

#### 2.4.4 条件引擎

```
neatlogic.framework.condition/

IConditionHandler              → 条件处理器
ConditionBaseVo                → 条件基础 Vo
ConditionConfigBaseVo          → 条件配置 Vo
ConditionGroupBaseVo           → 条件组 Vo
RelVo                          → 关系 Vo

ConditionProcessTaskOptions    → 流程任务条件选项
ProcessTaskConditionFactory    → 条件工厂
```

### 2.5 流程与变更/自动化集成

```
变更管理 (neatlogic-change) 与流程引擎集成:
  change → change_step → change_step_content → change_step_user
  change_sop → change_sop_step → change_sop_step_content
  change_auto_start (自动启动)

自动化 (neatlogic-autoexec) 与流程引擎集成:
  processtask_step_change_create → 创建变更
  processtask_step_change_handle → 处理变更
  processtask_step_event        → 创建事件
  processtask_step_diagram      → 更新拓扑图
  processtask_step_reapproval_restore_backup → 重新审批/备份恢复

事件管理 (neatlogic-event) 与流程引擎集成:
  event → event_type → event_solution
  processtask_step_event        → 流程步骤创建事件
```

---

## 3. neatlogic-web（前端 Vue 项目）

### 3.1 分析说明

`neatlogic-web` 是 NeatLogic 的前端项目，基于 Vue.js。由于没有本地 Git 数据，本分析基于：
- `PROJECT_DEVELOPMENT_GUIDE.md` 中的**完整前端开发规范**
- `CODE-BUILD.md` 中的**前端搭建文档**
- `build-root/pom.xml` 中的模块列表推断前端模块结构

### 3.2 前端项目结构

```
neatlogic-web/
├── public/                   # 静态资源
├── src/
│   ├── assets/               # 全局资源
│   │   └── css/
│   │       └── common.less   # 全局通用样式（优先复用）
│   ├── components/           # 全局组件
│   │   ├── Loading/          # Loading 组件（全局注册，禁止页面内重复 import）
│   │   └── ...
│   ├── community-module/     # 社区版模块
│   │   ├── alert/            # 告警管理
│   │   │   ├── api/          # API 调用
│   │   │   ├── pages/        # 页面组件
│   │   │   ├── import.js     # 组件注册
│   │   │   └── router.js     # 路由/菜单
│   │   ├── autoexec/         # 自动化
│   │   ├── cmdb/             # CMDB
│   │   ├── dashboard/        # 仪表盘
│   │   ├── deploy/           # 发布管理
│   │   ├── change/           # 变更管理
│   │   ├── inspect/          # 巡检
│   │   ├── knowledge/        # 知识库
│   │   ├── itsm/             # ITSM 流程
│   │   ├── rdm/              # 需求/缺陷管理
│   │   ├── report/           # 报表
│   │   └── ...
│   ├── commercial-module/    # 商业版模块
│   │   ├── ai/               # AI 模块
│   │   │   ├── api/          # AI API 调用
│   │   │   ├── pages/
│   │   │   │   ├── system/
│   │   │   │   │   ├── ai-model-manage.vue    # AI 模型管理
│   │   │   │   │   ├── ai-model-edit.vue      # AI 模型编辑
│   │   │   │   │   ├── ai-agent-manage.vue    # AI Agent 管理
│   │   │   │   │   └── ai-agent-edit.vue      # AI Agent 编辑
│   │   │   │   ├── rag/
│   │   │   │   │   └── rag-dataset-manage.vue # RAG 数据集管理
│   │   │   │   └── topnav/
│   │   │   │       ├── ai-chat-nav.vue        # 顶部 AI 聊天导航
│   │   │   │       └── ai-chat-dialog.vue     # AI 聊天对话框
│   │   │   └── languages/    # 多语言
│   │   ├── codehub/          # 代码仓库
│   │   ├── diagram/          # 拓扑图
│   │   ├── dr/               # 灾备
│   │   ├── monitor/          # 监控
│   │   ├── master/           # Master 管理
│   │   ├── pbc/              # 策略基线
│   │   ├── resourcepool/     # 资源池
│   │   └── ...
│   ├── resources/            # 全局资源
│   │   ├── assets/
│   │   ├── components/
│   │   └── i18n/             # 国际化
│   ├── api/                  # 全局 API 配置
│   ├── router/               # 路由配置
│   ├── store/                # Vuex 状态管理
│   ├── utils/                # 工具函数
│   └── App.vue
├── config/
│   └── apiconfig.json        # API 配置（tenantName, urlPrefix）
├── package.json
└── ...
```

### 3.3 前端开发规范

#### 3.3.1 模块目录约定

每个前端模块目录包含：
```
{module}/
├── api/          # 后端 API 调用文件（按页面或功能分包）
├── pages/        # 页面级 .vue 文件
├── import.js     # 组件全局注册（静态编译时需要）
└── router.js     # 模块菜单和路由管理
```

#### 3.3.2 组件化组织约束

**禁止在主页面中大段 if/else 或多 v-if 展开不同实现**。推荐模式：

```javascript
// 1. 映射表
import { index } from './component-map/index.js'

// 2. 动态组件
<component :is="index[step.handler]" :step="step" />

// 3. 按类型拆分组件
step-config-text.vue
step-config-select.vue
step-detail-llm.vue
step-detail-tool.vue
form-text.vue
form-select.vue
```

**公共 props/computed/methods 应抽到基础组件**，各类型组件通过 `extends` 复用。

#### 3.3.3 样式约束

- 优先在 `common.less` 中查找并复用通用样式
- 新增页面样式使用 `<style scoped lang="less">`
- 禁止编写未加 `scoped` 的页面级样式
- 尽量减少页面内新增 class 数量

#### 3.3.4 全局组件约束

- 全局注册的组件（如 `Loading`）禁止在页面中重复 import
- 直接使用全局组件名称即可

#### 3.3.5 开发环境

| 配置 | 值 |
|------|------|
| Node.js | v18.x |
| cnpm | v8.2.0 |
| 编辑器 | VS Code |
| 插件 | ESLint, Vetur, Prettier, i18nhelper |
| 启动 | `cnpm run serve` |
| 构建 | `cnpm run build` |

#### 3.3.6 API 配置

```json
// config/apiconfig.json
{
  "tenantName": "demo",
  "urlPrefix": "http://ip:port"
}
```

### 3.4 前端模块与后端模块映射

| 前端模块 | 后端 API 模块 | 说明 |
|----------|-------------|------|
| `community-module/alert` | `neatlogic-alert` | 告警管理 |
| `community-module/autoexec` | `neatlogic-autoexec` | 自动化 |
| `community-module/cmdb` | `neatlogic-cmdb` | CMDB |
| `community-module/dashboard` | `neatlogic-dashboard` | 仪表盘 |
| `community-module/deploy` | `neatlogic-deploy` | 发布管理 |
| `community-module/change` | `neatlogic-change` | 变更管理 |
| `community-module/itsm` | `neatlogic-itsm` | ITSM 流程 |
| `community-module/rdm` | `neatlogic-rdm` | 需求/缺陷 |
| `community-module/report` | `neatlogic-report` | 报表 |
| `community-module/knowledge` | `neatlogic-knowledge` | 知识库 |
| `commercial-module/ai` | `neatlogic-ai` | AI 推理 + RAG |
| `commercial-module/codehub` | `neatlogic-codehub` | 代码仓库 |
| `commercial-module/diagram` | `neatlogic-diagram` | 拓扑图 |
| `commercial-module/dr` | `neatlogic-dr` | 灾备 |
| `commercial-module/monitor` | `neatlogic-monitor` | 监控 |

---

## 4. neatlogic-ai（AI 推理 + RAG）

### 4.1 分析说明

`neatlogic-ai` 是 NeatLogic 的 **AI 推理代理 + RAG（检索增强生成）** 模块，属于**商业版模块**（不在 `.gitmodules` 中，仅在 `commercial` profile 中）。本分析基于：
- `PROJECT_DEVELOPMENT_GUIDE.md` 中的**完整 AI 模块开发规范**
- 框架层 `neatlogic.framework.alert.crossover.IAlertEmbeddingCrossoverService` 引用（AI 与告警集成）
- `neatlogic_build_root/pom.xml` 中商业版模块列表
- 数据库中的 `knowledge_*` 表和 `fulltextindex_content_knowledge` 索引表

### 4.2 AI 模块架构

```
neatlogic-ai/
├── src/main/java/neatlogic/module/ai/
│   ├── api/                      # AI API
│   │   ├── rag/                  # RAG 相关 API
│   │   │   └── SearchRagDatasetApi.java  # RAG 数据集搜索
│   │   ├── model/                # 模型管理 API
│   │   │   ├── SaveAiModelApi.java
│   │   │   ├── DeleteAiModelApi.java
│   │   │   └── SearchAiModelApi.java
│   │   ├── agent/                # Agent 管理 API
│   │   │   ├── SaveAiAgentApi.java
│   │   │   ├── DeleteAiAgentApi.java
│   │   │   └── SearchAiAgentApi.java
│   │   └── chat/                 # 对话 API
│   │       └── AiChatApi.java
│   │
│   ├── dao/mapper/               # MyBatis Mapper
│   │   ├── AiModelMapper.java
│   │   ├── AiModelMapper.xml
│   │   ├── RagMapper.java
│   │   ├── RagMapper.xml
│   │   ├── AiAgentMapper.java
│   │   └── AiAgentMapper.xml
│   │
│   ├── dto/                      # DTO
│   │   ├── AiModelVo.java
│   │   ├── AiAgentVo.java
│   │   ├── RagDatasetVo.java
│   │   └── RagDocumentVo.java
│   │
│   ├── service/                  # 服务层
│   │   ├── AiAgentRunner.java    # Agent 执行器
│   │   └── ...
│   │
│   └── ...
│
neatlogic-ai-base/
├── src/main/java/neatlogic/framework/ai/
│   ├── rag/                      # RAG 核心
│   │   ├── retriever/            # 检索器
│   │   │   ├── ContentRetriever  # 内容检索器（每个 dataset 一个）
│   │   │   ├── RetrieverFactory  # 检索器工厂
│   │   │   └── LanguageModelQueryRouter  # 查询路由器
│   │   ├── augmentor/            # 增强器
│   │   │   └── RetrievalAugmentor # 检索增强器
│   │   ├── dto/                  # RAG DTO
│   │   ├── service/              # RAG 服务
│   │   └── util/                 # RAG 工具
│   ├── model/                    # 模型管理
│   │   ├── dto/                  # 模型 DTO
│   │   └── service/              # 模型服务
│   ├── agent/                    # Agent 管理
│   │   ├── dto/                  # Agent DTO
│   │   └── service/              # Agent 服务
│   └── ...
```

### 4.3 AI 核心设计模式

#### 4.3.1 RAG 接入方式（推荐）

```
基于 langchain4j 的 AiServices + RetrievalAugmentor 机制:

1. 每个已激活的 RAG dataset 对应一个 ContentRetriever
2. RetrieverFactory 统一装配当前租户下所有激活 dataset 的 retriever
3. LanguageModelQueryRouter 让模型自动选择最合适的 retriever

dataset 路由描述信息:
  - dataset 名称
  - dataset 说明
  - handler 名称

检索策略（第一阶段）:
  - 不同 handler 的 dataset 统一基于 embedding 字段做向量召回
  - 具体检索实现、dataset 装配和容错逻辑下沉到 AI base 层

入口层职责:
  AiAgentRunner.chatByAiServices()
  - 只负责挂载 retriever/augmentor
  - 不直接写具体 ES 检索细节
```

#### 4.3.2 AI Agent 执行器

```
AiAgentRunner.chatByAiServices()
  │
  ├── 1. 获取当前租户已激活的 RAG dataset
  ├── 2. RetrieverFactory 装配所有 dataset 的 ContentRetriever
  ├── 3. LanguageModelQueryRouter 路由到合适的 retriever
  ├── 4. RetrievalAugmentor 增强上下文
  ├── 5. langchain4j AiServices 调用模型
  └── 6. 返回增强后的对话结果
```

#### 4.3.3 与告警模块的集成

```
neatlogic.framework.alert.crossover.IAlertEmbeddingCrossoverService

告警模块通过 CrossoverServiceFactory 调用 AI 的 Embedding 服务:
  IAlertEmbeddingCrossoverService alertEmbeddingService =
      CrossoverServiceFactory.tryToGetApi(IAlertEmbeddingCrossoverService.class);

用途:
  - 告警文本向量化
  - 告警相似性检索
  - 告警智能分类
```

### 4.4 数据库表（推断）

```
ai_model                      -- AI 模型定义
  ├── name                    -- 模型名称
  ├── type                    -- 模型类型（LLM/Embedding/Rerank）
  ├── config                  -- 模型配置（JSON）
  ├── is_active               -- 是否激活
  └── ...

ai_agent                      -- AI Agent 定义
  ├── name                    -- Agent 名称
  ├── model_id                -- 关联模型
  ├── config                  -- Agent 配置（JSON）
  ├── rag_dataset_ids         -- 关联 RAG dataset
  └── ...

rag_dataset                   -- RAG 数据集
  ├── name                    -- 数据集名称
  ├── description             -- 数据集说明
  ├── handler                 -- 处理器类型
  ├── embedding               -- Embedding 向量
  ├── is_active               -- 是否激活
  └── ...

rag_document                  -- RAG 文档
  ├── dataset_id              -- 数据集 ID
  ├── content                 -- 文档内容
  ├── embedding               -- 向量嵌入
  └── ...
```

### 4.5 AI 前端模块

```
neatlogic-web/src/commercial-module/ai/
├── api/                      # AI API 调用
├── pages/
│   ├── system/
│   │   ├── ai-model-manage.vue     # AI 模型管理
│   │   ├── ai-model-edit.vue       # AI 模型编辑
│   │   ├── ai-agent-manage.vue     # AI Agent 管理
│   │   └── ai-agent-edit.vue       # AI Agent 编辑
│   ├── rag/
│   │   └── rag-dataset-manage.vue  # RAG 数据集管理
│   └── topnav/
│       ├── ai-chat-nav.vue         # 顶部 AI 聊天导航
│       └── ai-chat-dialog.vue      # AI 聊天对话框
└── languages/                # 多语言
```

---

## 5. neatlogic-diagram（拓扑图/架构图）

### 5.1 分析说明

`neatlogic-diagram` 是 NeatLogic 的 **拓扑图/架构图** 模块，属于**商业版模块**。本分析基于：
- 数据库中的 **22 张 diagram_* 相关表**
- 框架层 `neatlogic.framework.graphviz.*` 图可视化 API（已在 CMDB 中实际使用）
- CMDB 模块中的 `GetGraphTopoApi.java`（使用 GraphViz 生成拓扑图）
- CMDB 的 `api/topo/` 包中的拓扑相关 API

### 5.2 拓扑图架构

```
neatlogic-diagram/
├── api/
│   ├── catalog/              # 图目录管理
│   ├── graph/                # 图管理
│   ├── template/             # 图模板管理
│   ├── widget/               # 图组件管理
│   ├── source/               # 图数据源
│   ├── check/                # 图校验
│   └── ...
├── dao/mapper/               # MyBatis Mapper
├── service/                  # 业务服务
├── dto/                      # DTO
├── util/                     # 工具类
└── ...
```

### 5.3 核心数据模型（22 张表）

#### 5.3.1 图目录管理

```
diagram_catalog               -- 图目录
├── diagram_catalog_auth      -- 目录权限
├── diagram_catalog_item      -- 目录项
└── diagram_catalog_template  -- 目录模板
```

#### 5.3.2 图模板

```
diagram_template              -- 架构图模板
├── config (longtext)         -- 模板配置（JSON）
├── ci_id                     -- 起点模型 ID（从哪个 CI 开始构建图）
├── is_autofill               -- 是否自动填充
├── diagram_template_edge     -- 模板边定义
├── diagram_template_source   -- 模板数据源
├── diagram_template_widget   -- 模板组件
├── diagram_template_status   -- 模板状态
└── diagram_template_status_rel -- 模板状态关系
```

**模板配置 JSON 结构**:
```json
{
  "name": "应用架构图模板",
  "ci_id": 12345,
  "is_autofill": 1,
  "nodes": [...],
  "edges": [...],
  "widgets": [...]
}
```

#### 5.3.3 图实例

```
diagram_graph                 -- 架构图图（实例）
├── template_id               -- 模板 ID
├── active_version_id         -- 激活版本 ID
├── edit_version_id           -- 编辑版本 ID
├── catalog_item_id           -- 目录项 ID
├── cientity_id               -- 关联 CI ID
├── catalog_id                -- 目录 ID
├── is_snapshot               -- 是否快照
├── user_id                   -- 用户 ID
├── is_private                -- 是否私有
│
diagram_graph_version         -- 图版本
diagram_graph_lock            -- 图编辑锁
diagram_graph_version_transactiongroup -- 版本事务组
```

#### 5.3.4 图组件

```
diagram_widget                -- 图组件
diagram_dynamic_widget        -- 动态组件
diagram_source                -- 数据源
```

#### 5.3.5 审计

```
diagram_change_log            -- 变更日志
diagram_check_audit           -- 校验审计
```

### 5.4 图可视化实现（GraphViz 集成）

NeatLogic 使用框架层的 `GraphViz` 类生成拓扑图，已在 CMDB 中实际使用：

```java
// CMDB 中的使用示例: GetGraphTopoApi.java

import neatlogic.framework.graphviz.Graphviz;
import neatlogic.framework.graphviz.Link;
import neatlogic.framework.graphviz.Node;
import neatlogic.framework.graphviz.enums.LayoutType;

// 构建图
Graphviz.Builder gb = new Graphviz.Builder(LayoutType.get(layout));

// 添加节点
for (GraphVo graphVo : graphList) {
    Node.Builder nb = new Node.Builder("Graph_" + graphVo.getId());
    nb.withTooltip(graphVo.getName());
    nb.withLabel(graphVo.getName());
    nb.withImage(graphVo.getIcon());
    gb.addNode(nb.build());
}

// 添加边
for (GraphRelVo relVo : relList) {
    Link.Builder lb = new Link.Builder(
        "Graph_" + relVo.getSourceId(),
        "Graph_" + relVo.getTargetId()
    );
    lb.withLabel(relVo.getName());
    gb.addLink(lb.build());
}

// 返回图数据
JSONObject result = new JSONObject();
result.put("nodes", gb.getNodes());
result.put("links", gb.getLinks());
result.put("layout", layout);
```

### 5.5 拓扑图类型

| 类型 | 说明 | 实现 |
|------|------|------|
| **CMDB 拓扑** | CI 关系拓扑 | `GetCiTopoApi` + `GetCiEntityTopoApi` |
| **自定义视图拓扑** | 自定义视图数据拓扑 | `GetCustomViewDataCiEntityTopoApi` |
| **架构图** | 基于模板的架构图 | `diagram_template` + `diagram_graph` |
| **作业拓扑** | 自动化作业阶段拓扑 | `AutoexecJobPhaseTopoApi` + GraphViz |
| **Graph 图** | 自定义图 | `GetGraphTopoApi` + GraphViz |

### 5.6 模板自动填充

```
diagram_template 的 is_autofill 字段:
  - is_autofill = 1: 系统自动从 CMDB 获取 CI 关系构建图
  - is_autofill = 0: 手动配置图节点和边

自动填充流程:
  1. 选择起点 CI (ci_id)
  2. 根据 CI 关系（reltype）自动扩展
  3. 生成节点和边
  4. 应用模板样式
  5. 渲染为架构图
```

---

## 6. 对 Orion 系统的补充借鉴建议

### 6.1 Framework 层借鉴（P0）

NeatLogic 的 framework 层是最值得借鉴的部分——它是一套**完整的基础设施抽象**：

| 框架能力 | NeatLogic 实现 | Orion 建议 |
|----------|---------------|-----------|
| **注解驱动 REST** | `@AuthAction` + `@OperationType` + `IApiComponent` | 统一 Handler 装饰器模式 |
| **认证框架** | `AuthBase` + `AuthAction` + `AuthFactory` | Go 中间件链 + 权限注解 |
| **通知引擎** | `NotifyPolicyHandlerFactory` + 15+ 类 | 提取统一通知抽象层 |
| **调度框架** | `SchedulerManager` + `IJob` + `JobBase` | Cron 调度 + Job 抽象 |
| **表单引擎** | `FormVo` + `FormAttributeVo` + 数据转换 | 动态表单定义 + 代码生成 |
| **全文索引** | `FullTextIndexHandlerFactory` + ES 集成 | ES 索引抽象 + 多模块索引 |
| **全局搜索** | `GlobalSearchManager` + 6 模块索引 | 统一搜索入口 |
| **跨模块引用** | `CrossoverServiceFactory` + 接口工厂 | Go 依赖注入 + 服务发现 |
| **异步处理** | 4 种线程池 + 4 个 ThreadLocal 上下文 | Go context + worker pool |
| **SQL 动态生成** | `$sql` + `ExpressionVo` + `JoinVo` | Go SQL 构建器 |
| **图可视化** | `GraphViz.Builder` + Node/Link/Layer | 集成 graphviz 库 |
| **条件引擎** | `IConditionHandler` + `ConditionGroupBaseVo` | 条件 DSL + 表达式求值 |
| **导入导出** | `ImportExportHandlerFactory` + 10+ 类 | 统一导入导出框架 |
| **集成框架** | `IntegrationHandlerFactory` + 认证 | API 网关 + 集成抽象 |
| **全局锁** | `GlobalLockManager` + `GlobalLockHandlerFactory` | Redis 分布式锁 |

### 6.2 ITSM 流程引擎借鉴（P1）

| 借鉴点 | NeatLogic 做法 | Orion 建议 |
|--------|---------------|-----------|
| **流程定义** | JSON 配置驱动（`process.config`） | YAML/JSON 流程定义 |
| **步骤处理器工厂** | 每个步骤类型独立处理器 | 策略模式 + 工厂注册 |
| **SLA 管理** | 多层级 SLA（流程→步骤→任务） | 统一 SLA 引擎 |
| **审计粒度** | 步骤级 + 详情级审计 | 操作审计日志 |
| **条件引擎** | `ConditionGroupBaseVo` + 条件工厂 | 条件表达式引擎 |
| **表单引擎** | 动态表单 + 属性 + 版本 | 动态表单定义 |
| **工作中心** | `process_workcenter_*` 工作流中心 | 工作台 + 任务中心 |

### 6.3 前端借鉴（P1）

| 借鉴点 | NeatLogic 做法 | Orion 建议 |
|--------|---------------|-----------|
| **模块目录约定** | `api/` + `pages/` + `import.js` + `router.js` | 统一前端模块结构 |
| **组件化组织** | 按类型拆分 + 映射表 + 动态组件 | 避免大段 v-if，用组件映射 |
| **样式约束** | `common.less` 通用样式 + scoped | 统一 CSS 架构 |
| **全局组件** | 禁止重复 import | 全局注册 + 直接使用 |
| **API 配置** | `apiconfig.json` 统一管理 | 统一 API 配置 |

### 6.4 AI/RAG 借鉴（P1）

| 借鉴点 | NeatLogic 做法 | Orion 建议 |
|--------|---------------|-----------|
| **RAG 架构** | langchain4j + `AiServices` + `RetrievalAugmentor` | 评估 Go langchaingo |
| **检索器工厂** | 每个 dataset 一个 `ContentRetriever` | 检索器抽象 + 工厂 |
| **查询路由** | `LanguageModelQueryRouter` 自动选择 | 多数据源路由 |
| **Agent 执行器** | `AiAgentRunner.chatByAiServices()` | Agent 执行引擎 |
| **Embedding 集成** | 通过 Crossover 与告警/CMDB 集成 | 向量化能力抽象 |
| **前端集成** | 顶部导航 AI 聊天 + 独立管理页面 | 嵌入式 AI 助手 |

### 6.5 拓扑图借鉴（P2）

| 借鉴点 | NeatLogic 做法 | Orion 建议 |
|--------|---------------|-----------|
| **模板系统** | `diagram_template` + JSON 配置 | 图模板定义 |
| **自动填充** | 从 CMDB CI 关系自动构建图 | 从现有数据自动拓扑 |
| **版本管理** | `diagram_graph_version` + 编辑锁 | 图版本控制 |
| **GraphViz** | 框架层 `GraphViz.Builder` | 集成 graphviz |
| **多拓扑类型** | CI 拓扑 + 架构图 + 作业拓扑 | 多类型拓扑支持 |

### 6.6 CMDB DSL 借鉴（P1）

NeatLogic 的 CMDB 查询 DSL 是一个**亮点设计**，使用 ANTLR4 实现：

```
neatlogic.module.cmdb.dsl/
├── DslSearchManager      # DSL 搜索管理器
├── DslVisitor            # DSL 访问者（继承 CmdbDSLBaseVisitor）
├── core/
│   ├── SearchExpression  # 搜索表达式
│   ├── SearchItem        # 搜索项
│   ├── SelectFragment    # SELECT 片段（含 alias, select, attrCheckSet）
│   └── CalculateExpression # 计算表达式
└── parser/
    ├── CmdbDSLLexer      # 词法分析器（ANTLR4 生成）
    ├── CmdbDSLParser     # 语法分析器（ANTLR4 生成）
    ├── CmdbDSLBaseVisitor # 基础访问者
    └── CmdbDSLListener   # 监听者
```

**Orion 借鉴**: 如果 Orion 的 CMDB 模块需要高级查询能力，可以参考 DSL + ANTLR4 的实现方式。

---

## 附录

### A. 分析方法总结

| 模块 | 数据来源 | 分析深度 |
|------|---------|---------|
| **neatlogic-framework** | 1,415 条框架类引用（从 16 个模块逆向还原） | ★★★★★ |
| **neatlogic-itsm** | 107 张数据库表 + 80+ 框架 process 类引用 + change 模块集成代码 | ★★★★☆ |
| **neatlogic-web** | PROJECT_DEVELOPMENT_GUIDE 前端规范 + CODE-BUILD 前端搭建文档 | ★★★☆☆ |
| **neatlogic-ai** | PROJECT_DEVELOPMENT_GUIDE AI 规范 + Crossover 引用 + 数据库推断 | ★★★☆☆ |
| **neatlogic-diagram** | 22 张数据库表 + GraphViz 框架 + CMDB 拓扑 API 实际使用代码 | ★★★★☆ |

### B. 框架层完整类统计

| 框架包 | 唯一类数（估算） |
|--------|-----------------|
| `neatlogic.framework.alert` | 110+ |
| `neatlogic.framework.autoexec` | 60+ |
| `neatlogic.framework.cmdb` | 100+ |
| `neatlogic.framework.process` | 80+ |
| `neatlogic.framework.restful` | 20+ |
| `neatlogic.framework.util` | 30+ |
| `neatlogic.framework.common` | 30+ |
| `neatlogic.framework.notify` | 15+ |
| `neatlogic.framework.form` | 15+ |
| `neatlogic.framework.scheduler` | 12+ |
| `neatlogic.framework.integration` | 15+ |
| `neatlogic.framework.importexport` | 10+ |
| `neatlogic.framework.fulltextindex` | 10+ |
| `neatlogic.framework.globallock` | 5+ |
| `neatlogic.framework.datawarehouse` | 3+ |
| `neatlogic.framework.exception` | 50+ |
| 其他 | 50+ |
| **合计** | **500+ 类** |

---

> **文档维护**: 本补充分析文档与 `neatlogic-itom-deep-analysis-2026-07-22.md` 配合使用，共同构成 NeatLogic 全量分析报告。
> 500+ 框架类的完整 API 细节建议后续通过实际克隆 Git 仓库获取源码后进行逐类分析。
