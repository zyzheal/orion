// ============================================================
// Orion CMDB Collector — 核心数据模型
// ============================================================
//
// 参考: NeatLogic CMDB 80+ 表 + 120+ 采集适配器
// 当前 TS 版本: blueprints/orion-cmdb-svc/src/types/cmdb.ts
//
// 设计目标:
//   - 将 CN_001~CN_009 等 NeatLogic CMDB 表结构 Go 化
//   - 支持多厂商适配器通过 SPI 注入 CI 数据
//   - JSONB 动态属性，匹配 NeatLogic 的 attributes 模式

package model

import (
	"context"
	"time"
)

// ============================================================
// 枚举定义
// ============================================================

// CIType 配置项类型 — 对应 NeatLogic cmdb_citype
type CIType string

const (
	CITypeServer        CIType = "server"
	CITypeNetworkDevice CIType = "network_device"
	CITypeDatabase      CIType = "database"
	CITypeApplication   CIType = "application"
	CITypeStorage       CIType = "storage"
	CITypeContainer     CIType = "container"
	CITypeMiddleware    CIType = "middleware"
)

// CIStatus 配置项状态 — 对应 NeatLogic cmdb_ci.status
type CIStatus string

const (
	CIStatusActive        CIStatus = "active"
	CIStatusInactive      CIStatus = "inactive"
	CIStatusDecommissioned CIStatus = "decommissioned"
	CIStatusMaintenance   CIStatus = "maintenance"
)

// VendorType 厂商类型
type VendorType string

const (
	VendorCisco     VendorType = "cisco"
	VendorHuawei    VendorType = "huawei"
	VendorH3C       VendorType = "h3c"
	VendorJuniper   VendorType = "juniper"
	VendorMySQL     VendorType = "mysql"
	VendorOracle    VendorType = "oracle"
	VendorPostgreSQL VendorType = "postgresql"
)

// ============================================================
// 核心实体 — 对应 NeatLogic cmdb_ci
// ============================================================

// CI 配置项 (Configuration Item) — NeatLogic cmdb_ci 的 Go 映射
//
// NeatLogic 原始定义:
//   cmdb_ci(id, tenant_id, name, type_id, status, group_id, tags, attributes, created_at)
//
// Orion 差异:
//   - 用 Go struct 标签定义数据库字段
//   - attributes 使用 JSONB (PostgreSQL)，匹配 NeatLogic JSONB 模式
//   - 增加 version 字段用于乐观锁
type CI struct {
	ID          int64          `db:"id" json:"id"`
	TenantID    string         `db:"tenant_id" json:"tenant_id"`
	Name        string         `db:"name" json:"name"`
	TypeID      int64          `db:"type_id" json:"type_id"`        // 关联 CIType
	Status      CIStatus       `db:"status" json:"status"`
	GroupID     *int64         `db:"group_id" json:"group_id,omitempty"`
	Tags        map[string]any `db:"tags" json:"tags"`              // JSONB: ["tag1", "tag2"]
	Attributes  map[string]any `db:"attributes" json:"attributes"`  // JSONB: 动态属性
	Version     int64          `db:"version" json:"version"`        // 乐观锁
	CreatedAt   time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time      `db:"updated_at" json:"updated_at"`
}

// CICientity CI 实体属性 — 对应 NeatLogic cmdb_cientity
//
// 用途: 扩展 CI 的额外实体属性（非标准字段）
// 与 CI.Attributes 的区别: Attributes 是标准 CMDB 属性，Cientity 是特定领域的扩展
type CICientity struct {
	ID         int64          `db:"id" json:"id"`
	CIID       int64          `db:"ci_id" json:"ci_id"`
	TenantID   string         `db:"tenant_id" json:"tenant_id"`
	Attributes map[string]any `db:"attributes" json:"attributes"` // JSONB
}

// CITypeModel CI 类型定义 — 对应 NeatLogic cmdb_citype
type CITypeModel struct {
	ID          int64          `db:"id" json:"id"`
	Name        string         `db:"name" json:"name"`
	Description string         `db:"description" json:"description"`
	ParentID    *int64         `db:"parent_id" json:"parent_id"` // 类型继承
	Attributes  map[string]any `db:"attributes" json:"attributes"` // 属性定义
}

// CIRelation CI 关系 — 对应 NeatLogic cmdb_rel
type CIRelation struct {
	ID          int64  `db:"id" json:"id"`
	SourceID    int64  `db:"source_id" json:"source_id"`
	TargetID    int64  `db:"target_id" json:"target_id"`
	TypeID      int64  `db:"type_id" json:"type_id"`
	Name        string `db:"name" json:"name"`
}

// CIRelationType CI 关系类型 — 对应 NeatLogic cmdb_reltype
type CIRelationType struct {
	ID         int64  `db:"id" json:"id"`
	Name       string `db:"name" json:"name"`
	SourceType int64  `db:"source_type" json:"source_type"`
	TargetType int64  `db:"target_type" json:"target_type"`
}

// ============================================================
// 采集器 SPI 核心接口 — 设计核心
// ============================================================

// Collector 采集器 SPI (Service Provider Interface)
//
// 设计参考: NeatLogic CMDB 采集 (44 本地 + 82 远程)
// 覆盖: Cisco/Huawei/H3C/Juniper | MySQL/Oracle/PG/SQL Server/TiDB
//
// SPI 原则:
//   1. 采集器通过 Register 注入 CollectorFactory
//   2. Collect(ctx, config) 是唯一采集入口
//   3. 返回 []CIRaw 供上层转换为 CI
//   4. 采集器之间解耦，可独立编译/部署
//
// 扩展点:
//   - Validate: 采集前参数校验
//   - Ping: 探测目标可达性
//   - Collect: 执行采集，返回原始 CI 数据
//   - Name: 返回采集器名称，用于日志和注册
type Collector interface {
	// Name 返回采集器名称 (唯一标识)
	// 示例: "cisco_ios", "huawei_vrp", "mysql", "oracle"
	Name() string

	// Vendor 返回厂商类型
	Vendor() VendorType

	// Type 返回采集器类型 (network / database / middleware / etc)
	Type() string

	// Ping 探测目标设备/数据库是否可达
	// 用于采集前的快速健康检查，不应执行完整采集
	Ping(ctx context.Context, config map[string]any) (bool, error)

	// Validate 校验采集配置参数
	// 在 Register 时也可调用，确保配置正确
	Validate(config map[string]any) error

	// Collect 执行采集，返回原始 CI 数据
	// 采集器负责:
	//   1. 连接到目标 (SNMP/SSH/SQL)
	//   2. 执行 MIB 查询 / SQL 语句
	//   3. 解析响应为标准 CIRaw
	//
	// 超时由上层通过 ctx 控制，采集器必须尊重 ctx.Done()
	Collect(ctx context.Context, config map[string]any) ([]CIRaw, error)
}

// CIRaw 原始 CI 数据 — 采集器返回的中间格式
//
// 采集器只需填充 Name/Attributes，上层负责:
//   - 类型映射 (Attributes 中的 type 字段 → CIType)
//   - 去重合并
//   - 事务入库
//   - 关系推断
type CIRaw struct {
	Name        string            `json:"name"`
	TypeHint    CIType            `json:"type_hint"`
	Status      CIStatus       `json:"status"`
	GroupID     *int64            `json:"group_id,omitempty"`
	Tags        map[string]any    `json:"tags"`
	Attributes  map[string]any    `json:"attributes"`
	EntityAttrs map[string]any    `json:"entity_attrs"` // CICientity 扩展属性
	Relations   []RawRelation     `json:"relations"`    // 推断关系
}

// RawRelation 原始关系 — 采集器推断的 CI 间关系
type RawRelation struct {
	SourceCI string `json:"source_ci"` // 源 CI 的标识 (名称或 UUID)
	TargetCI string `json:"target_ci"` // 目标 CI 的标识
	Type     string `json:"type"`      // 关系类型: "connected_to", "hosts", "depends_on"
}

// ============================================================
// 采集器工厂 (CollectorFactory) — 注册中心
// ============================================================

// Factory 采集器工厂 — 单例，负责管理所有注册的 Collector
//
// 设计参考: NeatLogic CollectorManager
// 注册方式: init() 函数自动注册 + Register() 手动注册
// 查找方式: Get(name) 按名称查找, GetByVendor(vendor) 按厂商查找
type Factory interface {
	// Register 注册采集器 (init() 中使用)
	Register(c Collector)

	// Get 按名称获取采集器
	Get(name string) (Collector, bool)

	// GetByVendor 按厂商获取所有采集器
	GetByVendor(vendor VendorType) []Collector

	// GetByType 按类型获取所有采集器 (network/database/middleware)
	GetByType(t string) []Collector

	// All 返回所有已注册的采集器
	All() []Collector

	// List 返回采集器名称列表
	List() []string
}

// ============================================================
// 采集任务 — 调度模型
// ============================================================

// CollectionTask 采集任务
type CollectionTask struct {
	ID           string                 `json:"id"`
	TenantID     string                 `json:"tenant_id"`
	Collector    string                 `json:"collector"`   // 采集器名称
	TargetConfig map[string]any         `json:"target_config"`
	Status       string                 `json:"status"`      // pending/running/success/failed
	Error        string                 `json:"error"`
	ResultCount  int                    `json:"result_count"`
	Schedule     string                 `json:"schedule"`    // CRON 表达式
	LastRunAt    *time.Time             `json:"last_run_at"`
	NextRunAt    *time.Time             `json:"next_run_at"`
	CreatedAt    time.Time              `json:"created_at"`
}

// CollectionResult 采集结果
type CollectionResult struct {
	TaskID      string        `json:"task_id"`
	StartTime   time.Time     `json:"start_time"`
	EndTime     time.Time     `json:"end_time"`
	CIInsert    int           `json:"ci_insert"`
	CIUpdate    int           `json:"ci_update"`
	CIRelations int           `json:"ci_relations"`
	Error       string        `json:"error"`
	RawCI       []CIRaw       `json:"raw_ci"` // 调试用，生产不入库
}
