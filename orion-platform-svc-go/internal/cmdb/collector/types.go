// ============================================================
// Collector Models — 采集器专用数据模型
// ============================================================
//
// 与 cmdb/models (平台 CMDB CI 模型) 的区别:
//   - 平台 models: CI/CR 的持久化模型 (Go struct + db tags)
//   - 本包: 采集器 SPI 中间格式 (CIRaw, CollectionTask 等)
//   - 采集器通过 Collect() 返回 CIRaw, 上层转换为平台 CI

package collector

import (
	"context"
	"time"
)

// ============================================================
// 枚举定义
// ============================================================

// CIType 配置项类型
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

// CIStatus 配置项状态
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
// 采集器 SPI 核心接口
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
	Status      CIStatus          `json:"status"`
	GroupID     *int64            `json:"group_id,omitempty"`
	Tags        map[string]any    `json:"tags"`
	Attributes  map[string]any    `json:"attributes"`
	EntityAttrs map[string]any    `json:"entity_attrs"` // CICientity 扩展属性
	Relations   []RawRelation     `json:"relations"`    // 推断关系
}

// RawRelation 原始关系 — 采集器推断的 CI 间关系
type RawRelation struct {
	SourceCI string `json:"source_ci"` // 源 CI 的标识 (名称或 UUID)
	TargetCI string `json:"target_ci"`
	Type     string `json:"type"` // 关系类型: "connected_to", "hosts", "depends_on"
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
	// Status 采集状态: success/failed
	Status      string        `json:"status"`
	Error       string        `json:"error"`
	RawCI       []CIRaw       `json:"raw_ci"` // 调试用，生产不入库
}
