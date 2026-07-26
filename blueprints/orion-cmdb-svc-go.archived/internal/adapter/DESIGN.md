# Orion CMDB 采集适配器 SPI 设计方案

## 1. 背景与目标

### 1.1 现状

Orion CMDB 服务（`blueprints/orion-cmdb-svc`）当前仅支持手动/半自动的 CI 数据录入，缺乏从外部系统（网络设备、数据库）自动采集的机制。

**参考标杆**: NeatLogic CMDB 采集系统拥有 120+ 厂商适配器（44 本地 + 82 远程），覆盖：
- 网络设备: Cisco/Huawei/H3C/Juniper
- 数据库: Oracle/MySQL/PostgreSQL/SQL Server/TiDB/达梦/金仓
- 中间件: Tomcat/WebLogic/WebSphere/Nginx
- 消息/缓存: Redis/Kafka/RabbitMQ
- 容器/云: Docker/K8s

### 1.2 设计目标

1. **SPI 接口**: 定义 `Collector` 接口，厂商适配器通过 `init()` 自动注册
2. **工厂架构**: `CollectorFactory` 管理所有适配器，支持按名称/厂商/类型查找
3. **首批覆盖**: 网络 (Cisco/Huawei/H3C) + 数据库 (MySQL/Oracle/PostgreSQL)
4. **扩展性**: 新厂商适配器只需实现接口 + 注册，无需修改核心代码

---

## 2. Collector 接口 SPI 定义

### 2.1 接口契约

```go
// Collector 采集器 SPI
// 每个厂商适配器必须实现此接口，并在 init() 中注册到 Factory。
type Collector interface {
    Name() string                  // 唯一标识: "cisco_ios", "mysql"
    Vendor() model.VendorType      // 厂商枚举: cisco, huawei, mysql
    Type() string                  // 设备类型: "network", "database"

    Ping(ctx, config) (bool, error)  // 快速探测目标可达性
    Validate(config) error           // 校验采集配置参数
    Collect(ctx, config) ([]CIRaw, error) // 执行采集，返回原始 CI
}
```

### 2.2 CIRaw — 采集中间格式

```go
type CIRaw struct {
    Name        string            // 设备名称 (如 "192.168.1.1", "mysql://localhost:3306")
    TypeHint    CIType            // CI 类型提示: server/network_device/database
    Status      CIStatus          // 状态: active/inactive/maintenance
    Attributes  map[string]any    // 动态属性 (JSONB): 厂商/版本/接口等
    EntityAttrs map[string]any    // 实体扩展属性 (对应 cmdb_cientity)
    Relations   []RawRelation     // 推断关系 (源/目标/关系类型)
}
```

### 2.3 设计原则

| 原则 | 说明 |
|------|------|
| **单一入口** | `Collect(ctx, config)` 是唯一采集方法 |
| **参数传递** | 配置通过 `map[string]any` 传递，不维护可变状态 |
| **线程安全** | Collect 必须线程安全，支持并发调用 |
| **超时控制** | 采集器必须尊重 `ctx.Done()` |
| **结果标准** | 返回 `[]CIRaw`，上层负责转换/入库 |

---

## 3. CollectorFactory — 注册中心

### 3.1 架构

```
CollectorFactory
    ├── index[name] -> Collector        // 按名称查找 (O(1))
    ├── vendor[vendor] -> [Collector...] // 按厂商查找
    ├── typ[type] -> [Collector...]     // 按类型查找
    └── all[] -> Collector              // 全部注册列表
```

### 3.2 方法

| 方法 | 说明 | 时间复杂度 |
|------|------|-----------|
| `Register(c Collector)` | 注册采集器 (init() 使用) | O(1) |
| `Get(name string)` | 按名称获取 | O(1) |
| `GetByVendor(vendor)` | 按厂商获取 | O(n) |
| `GetByType(type)` | 按类型获取 | O(n) |
| `All()` | 返回所有 | O(n) |
| `List()` | 返回名称列表 | O(n) |

### 3.3 注册方式

**自动注册** — 厂商适配器在各自包的 `init()` 中调用:

```go
// internal/adapter/network/cisco/cisco.go
func init() {
    collector.GlobalFactory.Register(&CiscoCollector{})
}
```

**手动注册** — 运行时动态注册:

```go
factory.Register(&MyCustomCollector{})
```

---

## 4. 采集器实现

### 4.1 网络设备采集器 (SNMP/SSH)

#### Cisco IOS Collector

| 属性 | 值 |
|------|-----|
| **名称** | `cisco_ios` |
| **厂商** | `cisco` |
| **类型** | `network` |
| **传输** | SNMPv2c/v3 + SSH |
| **端口** | SNMP 161, SSH 22 |

**采集数据**:
- 系统信息: `sysDescr`, `sysName`, `sysUpTime`, `sysObjectID`
- 接口信息: `ifName`, `ifDescr`, `ifType`, `ifSpeed`, `ifOperStatus`
- 邻居关系: CDP (`CDPDeviceID`, `CDPDevicePort`)
- 资源状态: CPU/内存 (私有 MIB)

**SSH CLI 命令**:
```
show version
show interfaces description
show cdp neighbors detail
show running-config
```

**配置示例**:
```yaml
collector: cisco_ios
target:
  host: "192.168.1.1"
  community: "public"
  version: 2
ssh:
  username: "admin"
  password: "${CISCO_SSH_PASSWORD}"
  cli_mode: cisco_ios
scopes: [system, interface, neighbor, cpu, memory]
```

#### Huawei VRP Collector

| 属性 | 值 |
|------|-----|
| **名称** | `huawei_vrp` |
| **厂商** | `huawei` |
| **类型** | `network` |
| **传输** | SNMPv2c/v3 + SSH |

**私有 MIB** (华为专用):
- CPU: `1.3.6.1.4.1.2011.5.25.31.1.1.1.1.2`
- 内存: `1.3.6.1.4.1.2011.5.25.31.1.1.1.1.3`
- 温度: `1.3.6.1.4.1.2011.5.25.31.1.1.1.1.5`

**SSH CLI 命令** (VRP):
```
display version
display interface brief
display lldp neighbor
display current-configuration
```

#### H3C Comware Collector

| 属性 | 值 |
|------|-----|
| **名称** | `h3c_comware` |
| **厂商** | `h3c` |
| **类型** | `network` |
| **传输** | SNMPv2c/v3 + SSH |

**私有 MIB** (H3C 专用):
- CPU: `1.3.6.1.4.1.25506.2.1.1.1.1.1.3`
- 内存: `1.3.6.1.4.1.25506.2.1.1.1.1.1.4`
- 温度: `1.3.6.1.4.1.25506.2.1.1.1.1.1.5`

### 4.2 数据库采集器 (连接池/SQL)

#### MySQL Collector

| 属性 | 值 |
|------|-----|
| **名称** | `mysql` |
| **厂商** | `mysql` |
| **类型** | `database` |
| **驱动** | `github.com/go-sql-driver/mysql` |
| **端口** | 3306 |

**采集 SQL**:
```sql
SELECT VERSION()                              -- 版本
SELECT DATABASE()                             -- 当前库
SELECT * FROM information_schema.schemata    -- 数据库列表
SELECT * FROM information_schema.TABLES       -- 表信息
SHOW GLOBAL STATUS                            -- 状态
```

**CIRaw 结构**:
```go
CIRaw{
    Name: "mysql://192.168.1.10:3306",
    Attributes: {
        "vendor": "mysql",
        "version": "8.0.32",
        "databases": ["orion", "cmdb", "monitor"],
    },
    Relations: [{SourceCI: "mysql://...", TargetCI: "mysql://.../orion", Type: "contains"}],
}
```

#### PostgreSQL Collector

| 属性 | 值 |
|------|-----|
| **名称** | `postgresql` |
| **厂商** | `postgresql` |
| **驱动** | `github.com/jackc/pgx/v5/stdlib` |
| **端口** | 5432 |

**采集 SQL**:
```sql
SELECT version()
SELECT datname FROM pg_database
SELECT * FROM pg_stat_user_tables
SELECT * FROM pg_stat_activity
SELECT * FROM pg_settings
```

#### Oracle Collector

| 属性 | 值 |
|------|-----|
| **名称** | `oracle` |
| **厂商** | `oracle` |
| **驱动** | `github.com/go-goose/oracledb` |
| **端口** | 1521 |

**采集 SQL**:
```sql
SELECT BANNER FROM V$VERSION WHERE ROWNUM = 1
SELECT NAME FROM V$DATABASE
SELECT * FROM DBA_TABLESPACES
SELECT * FROM DBA_TABLES
SELECT * FROM V$SYSTEM_PARAMETER
```

---

## 5. 配置格式 (YAML)

### 5.1 采集任务配置

```yaml
collectors:
  - name: cisco-core-01
    collector: cisco_ios
    type: network
    vendor: cisco
    schedule: "0 */6 * * *"
    timeout: 30
    retries: 2

    target:
      host: "192.168.1.1"
      port: 161
      community: "public"
      version: 2

    ssh:
      host: "192.168.1.1"
      port: 22
      username: "admin"
      password: "${CISCO_SSH_PASSWORD}"
      cli_mode: cisco_ios

    scopes: [system, interface, neighbor, cpu, memory]
    tags:
      environment: prod
      site: beijing
```

### 5.2 全局配置

```yaml
global:
  tenant_id: "default"
  default_timeout: 30
  default_retries: 3
  max_parallel: 10
  batch_size: 100
  dedup_key: "attributes.vendor"
  log_level: "info"
```

---

## 6. 传输层 (Transport)

### 6.1 SNMP Transport

- **库**: `github.com/golang/snmp`
- **版本**: SNMPv1/v2c/v3
- **方法**: `Get`, `BulkGet`, `Walk`, `Ping`
- **OID 注册表**: `VendorOIDRegistry` 管理厂商特定 OID

### 6.2 SSH Transport

- **库**: `golang.org/x/crypto/ssh`
- **厂商模式**: `cisco_ios` / `huawei_vrp` / `h3c_comware` / `juniper_junos`
- **方法**: `Execute`, `ExecuteWithPrompt`
- **CLI 命令**: 按厂商定义不同 `show/display` 命令

### 6.3 SQL Transport

- **库**: `database/sql` + 厂商驱动
- **方言**: `mysql` / `postgresql` / `oracle`
- **连接池**: 支持 `MaxOpenConns`, `MaxIdleConns`, `ConnMaxLifetime`
- **方法**: `Query`, `QueryRow`, `Ping`

---

## 7. 扩展新厂商步骤

1. **创建适配器包**: `internal/adapter/<type>/<vendor>/<vendor>.go`
2. **实现 Collector 接口**: 实现 `Name`, `Vendor`, `Type`, `Ping`, `Validate`, `Collect`
3. **定义 OID/SQL 常量**: 厂商特定的 MIB OID 或 SQL 模板
4. **在 init() 注册**: `collector.GlobalFactory.Register(&MyCollector{})`
5. **编写测试**: `internal/adapter/<type>/<vendor>/<vendor>_test.go`
6. **配置 YAML**: 在 `config.yaml` 中添加采集任务

---

## 8. 与 NeatLogic 对比

| 维度 | NeatLogic | Orion | 备注 |
|------|-----------|-------|------|
| 适配器数量 | 120+ | 6 (首批) | 逐步扩展至 20+ |
| 脚本语言 | Perl | Go | Go 类型安全更好 |
| 配置方式 | 配置文件 | YAML | 更标准化 |
| 并发控制 | 单进程 | semaphore | 更可控 |
| 结果存储 | RDBMS | PostgreSQL JSONB | 更灵活 |

---

## 9. 下一步工作

| 优先级 | 任务 | 说明 |
|--------|------|------|
| P0 | 实现真实 SNMP/SSH 采集 | 替换 mock 实现 |
| P0 | 实现真实 SQL 采集 | 连接真实数据库 |
| P1 | 集成 go-cron 调度器 | CRON 表达式支持 |
| P1 | CI 数据入库 (PostgreSQL) | 从 CIRaw 到 cmdb_ci |
| P2 | 中间件适配器 (Tomcat/Nginx) | 扩展 scope |
| P2 | 云平台适配器 (vCenter/AWS) | 扩展 scope |
| P2 | 单元测试覆盖 | 每个适配器 >80% |
