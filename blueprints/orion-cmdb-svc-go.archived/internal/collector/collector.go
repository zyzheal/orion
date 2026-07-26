// ============================================================
// Collector 接口 SPI — Service Provider Interface
// ============================================================
//
// 设计参考:
//   - NeatLogic CMDB 采集适配器 (120+ 厂商, Perl 脚本驱动)
//   - Go 社区 SPI 惯例 (io/fs, database/sql/driver)
//   - 当前 TS 版本: blueprints/orion-cmdb-svc/src/types/cmdb.ts
//
// 架构决策:
//   1. Collector 是 interface，通过 Factory 注册中心管理
//   2. Collect(ctx, config) 是唯一采集入口，返回 []CIRaw
//   3. 采集器通过 init() 自动注册到全局 Factory
//   4. 厂商适配器放在 adapter/ 子包，不污染核心包
//
// 扩展点:
//   - network/: Cisco/Huawei/H3C/Juniper (SNMP + SSH)
//   - database/: MySQL/Oracle/PostgreSQL (连接池 + SQL)
//   - middleware/: Tomcat/WebLogic/Nginx (后续扩展)
//   - cloud/: vCenter/AWS/Azure (后续扩展)

package collector

import (
	"context"
	"sync"

	"orion-cmdb-svc-go/internal/model"
)

// Collector 采集器 SPI
//
// 每个厂商适配器必须实现此接口，并在 init() 中注册到 Factory。
//
// 接口契约:
//   - Name() 返回唯一标识，如 "cisco_ios"、"mysql"
//   - Vendor() 返回厂商枚举，如 model.VendorCisco
//   - Type() 返回设备类型，如 "network"、"database"
//   - Ping() 快速探测目标是否可达（不执行完整采集）
//   - Validate() 校验采集配置参数
//   - Collect() 执行采集，返回原始 CI 数据
//
// 并发安全:
//   - Collect 必须实现线程安全，可能并发被多个采集任务调用
//   - 不建议在采集器中维护可变状态，配置通过参数传递
type Collector interface {
	Name() string
	Vendor() model.VendorType
	Type() string

	Ping(ctx context.Context, config map[string]any) (bool, error)
	Validate(config map[string]any) error
	Collect(ctx context.Context, config map[string]any) ([]model.CIRaw, error)
}

// ============================================================
// Factory 采集器注册中心
// ============================================================

// Factory 管理所有已注册的 Collector
//
// 使用方式:
//   - 全局单例: var GlobalFactory = NewFactory()
//   - 注册: factory.Register(new CiscoCollector())
//   - 查找: collector, ok := factory.Get("cisco_ios")
type Factory struct {
	mu      sync.RWMutex
	index   map[string]Collector           // name -> Collector
	vendor  map[model.VendorType][]Collector // vendor -> [Collector...]
	typ     map[string][]Collector         // type -> [Collector...]
	all     []Collector
}

// NewFactory 创建新的采集器工厂
func NewFactory() *Factory {
	return &Factory{
		index:  make(map[string]Collector),
		vendor: make(map[model.VendorType][]Collector),
		typ:    make(map[string][]Collector),
	}
}

// Register 注册采集器
func (f *Factory) Register(c Collector) {
	name := c.Name()

	f.mu.Lock()
	defer f.mu.Unlock()

	if _, exists := f.index[name]; exists {
		panic("collector already registered: " + name)
	}

	f.index[name] = c
	f.vendor[c.Vendor()] = append(f.vendor[c.Vendor()], c)
	f.typ[c.Type()] = append(f.typ[c.Type()], c)
	f.all = append(f.all, c)
}

// Get 按名称获取采集器
func (f *Factory) Get(name string) (Collector, bool) {
	f.mu.RLock()
	defer f.mu.RUnlock()
	c, ok := f.index[name]
	return c, ok
}

// GetByVendor 按厂商获取所有采集器
func (f *Factory) GetByVendor(vendor model.VendorType) []Collector {
	f.mu.RLock()
	defer f.mu.RUnlock()
	// 返回副本，防止调用方修改内部切片
	result := make([]Collector, len(f.vendor[vendor]))
	copy(result, f.vendor[vendor])
	return result
}

// GetByType 按类型获取所有采集器
func (f *Factory) GetByType(t string) []Collector {
	f.mu.RLock()
	defer f.mu.RUnlock()
	result := make([]Collector, len(f.typ[t]))
	copy(result, f.typ[t])
	return result
}

// All 返回所有已注册的采集器
func (f *Factory) All() []Collector {
	f.mu.RLock()
	defer f.mu.RUnlock()
	result := make([]Collector, len(f.all))
	copy(result, f.all)
	return result
}

// List 返回采集器名称列表
func (f *Factory) List() []string {
	f.mu.RLock()
	defer f.mu.RUnlock()
	result := make([]string, 0, len(f.index))
	for name := range f.index {
		result = append(result, name)
	}
	return result
}

// Count 返回已注册的采集器数量
func (f *Factory) Count() int {
	f.mu.RLock()
	defer f.mu.RUnlock()
	return len(f.index)
}

// ============================================================
// 全局工厂实例
// ============================================================

var (
	// GlobalFactory 全局采集器工厂
	// 用于采集器 init() 注册和采集任务查找
	GlobalFactory = NewFactory()

	// once 确保 GlobalFactory 只初始化一次
	once sync.Once
)

func init() {
	once.Do(func() {
		// 注意: 此处不做任何注册
		// 厂商适配器在各自包的 init() 中调用 GlobalFactory.Register()
		// 例如: internal/adapter/network/cisco/cisco.go
	})
}
